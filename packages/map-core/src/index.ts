/**
 * Mappls Core - Shared Map Utilities
 * 
 * @popclozet/map-core v1.0.0
 * 
 * Core map initialization and cleanup logic.
 */

import { mappls } from 'mappls-web-maps';
// No more imports from mapbox-gl
type MapboxMap = any;
type MapboxOptions = any;
type MarkerOptions = any;

const CONFIGURED_TOKEN = import.meta.env?.VITE_MAPPLS_REST_KEY || '';

export const configureMapbox = (token: string) => {
    // No-op for Mappls configuration, token is used at initialization
};

export const isMapboxAvailable = (): boolean => {
    return !!CONFIGURED_TOKEN;
};

export const getMapboxToken = (): string | undefined => {
    return CONFIGURED_TOKEN;
};

let mapInstance: MapboxMap | null = null;

/**
 * Initialize a Mappls map instance (wraps Mapbox GL).
 */
export const initializeMap = async (
    container: HTMLElement,
    center: [number, number],
    zoom: number = 14,
    token?: string
): Promise<MapboxMap> => {
    const activeToken = token || CONFIGURED_TOKEN;
    if (!activeToken) {
        throw new Error('Mappls access token is not configured');
    }

    if (!container.id) {
        container.id = `mappls-map-${Math.random().toString(36).substring(7)}`;
    }

    // Destroy existing instance if any
    const existingMap = (container as any)._mapplsMap;
    if (existingMap) {
        try { existingMap.remove(); } catch (_) { }
    }

    if (mapInstance) {
        destroyMap();
    }

    const mapObject = new mappls();

    return new Promise((resolve) => {
        mapObject.initialize(activeToken, { map: true }, () => {
            const map = mapObject.Map({
                id: container.id,
                center: [center[1], center[0]], // underlying Mapbox engine expects [lng, lat]
                zoom,
                addControl: true,
                attributionControl: false,
            }) as any; 

            mapInstance = map;
            (container as any)._mapplsMap = map;
            resolve(map);
        });
    });
};

export const destroyMap = (map?: MapboxMap | null): void => {
    const target = map || mapInstance;
    if (target) {
        try {
            target.remove();
        } catch (e) { }
        if (target === mapInstance) {
            mapInstance = null;
        }
    }
};

export const getMapInstance = (): MapboxMap | null => mapInstance;

export const drawRoute = async (
    map: MapboxMap,
    coordinates: number[][] // [lng, lat]
): Promise<void> => {
    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: coordinates as any,
        },
    };

    if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
    }

    map.addSource('route', {
        type: 'geojson',
        data: geojson,
    });

    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': '#8855F7',
            'line-width': 4,
            'line-opacity': 0.8,
        },
    });

    // We can use generic mapbox bounds logic
    if (coordinates.length > 1 && typeof map.fitBounds === 'function') {
          // manually fitting bounds if possible
          // since mapboxgl is not directly exposed as object
    }
};

export const drawRouteFromCoords = drawRoute;

// ==========================================
// IIT BOMBAY GEOFENCING
// ==========================================
export const SERVICE_CONFIG = {
    center: { lat: 19.1334, lng: 72.9133 }, // IIT Bombay
    radiusKm: 6,
    warehouseLocation: { lat: 19.1334, lng: 72.9133 },
};

export const calculateDistance = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): number => {
    const R = 6371; 
    const dLat = (to.lat - from.lat) * (Math.PI / 180);
    const dLng = (to.lng - from.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(from.lat * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const isWithinServiceArea = (lat: number, lng: number): boolean => {
    return calculateDistance(SERVICE_CONFIG.center, { lat, lng }) <= SERVICE_CONFIG.radiusKm;
};

export const getWarehouseLocation = () => SERVICE_CONFIG.warehouseLocation;
export const getDistanceFromWarehouse = (lat: number, lng: number): number => {
    return calculateDistance(SERVICE_CONFIG.warehouseLocation, { lat, lng });
};

// ==========================================
// GEOLOCATION HELPERS
// ==========================================
export interface ReverseGeocodeResult {
    city: string;
    locality: string;
    fullAddress: string;
    state: string;
    country: string;
}

export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
    if (!CONFIGURED_TOKEN) return null;
    try {
        const url = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${CONFIGURED_TOKEN}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const res = data.results[0];
            return {
                city: res.city || 'Current location',
                locality: res.locality || res.city,
                fullAddress: res.formatted_address || `${res.locality}, ${res.city}`,
                state: res.state || '',
                country: 'India',
            };
        }
        return null;
    } catch {
        return null;
    }
};

export const getCurrentPosition = (options?: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options
        });
    });
};

export const autoDetectLocation = async () => {
    try {
        const position = await getCurrentPosition();
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const geocode = await reverseGeocode(lat, lng);

        return {
            lat,
            lng,
            city: geocode?.city || 'Current location',
            locality: geocode?.locality || geocode?.city || 'Current location',
            isInServiceArea: isWithinServiceArea(lat, lng),
        };
    } catch {
        return null;
    }
};

export const createMapInstance = async (
    container: HTMLElement,
    center: [number, number],
    zoom: number = 13
): Promise<MapboxMap> => {
    if (!CONFIGURED_TOKEN) throw new Error('Mappls access token is not configured');
    if (!container.id) {
        container.id = `mappls-map-${Math.random().toString(36).substring(7)}`;
    }
    const mapObject = new mappls();
    return new Promise((resolve) => {
        mapObject.initialize(CONFIGURED_TOKEN, { map: true }, () => {
            const map = mapObject.Map({
                id: container.id,
                center: [center[1], center[0]], // Mappls expects [lat, lng], callers pass [lng, lat]
                zoom,
                addControl: true,
                attributionControl: false,
            }) as any;
            resolve(map);
        });
    });
};

/**
 * Fetch driving route from Mappls Route API.
 * Returns GeoJSON coordinates array [[lng, lat], ...] or null on failure.
 */
export const fetchMapplsRoute = async (
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number
): Promise<number[][] | null> => {
    if (!CONFIGURED_TOKEN) return null;
    try {
        const url = `https://apis.mappls.com/advancedmaps/v1/${CONFIGURED_TOKEN}/route_adv/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&steps=false`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.routes?.[0]?.geometry?.coordinates ?? null;
    } catch (e) {
        console.warn('[map-core] Mappls Route API failed:', e);
        return null;
    }
};

export const createColorMarker = (
    color: string,
    size: number = 14,
    pulse: boolean = false
): HTMLElement => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:relative;width:${size + 8}px;height:${size + 8}px;display:flex;align-items:center;justify-content:center;`;

    if (pulse) {
        const ring = document.createElement('div');
        ring.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:mapPulse 1.8s ease-out infinite;`;
        wrapper.appendChild(ring);
    }

    const dot = document.createElement('div');
    dot.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.45);position:relative;z-index:1;`;
    wrapper.appendChild(dot);
    return wrapper;
};

export const updateRouteSource = (
    map: MapboxMap,
    sourceId: string,
    layerId: string,
    coordinates: [number, number][],
    color: string = '#8855F7'
): void => {
    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
    };

    if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as any).setData(geojson);
    } else {
        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.75 },
        });
    }
};

/**
 * mapboxgl Shim - Satisfies current app dependencies on Mapbox classes/values
 * Maps Mapbox-style calls to the underlying Mappls/Mapbox instance.
 */
export const mapboxgl: any = {
    Map: class {
        constructor() {
            console.warn('mapboxgl.Map called directly. Use initializeMap() instead.');
        }
    },
    Marker: class {
        _lngLat: [number, number] = [0, 0];
        _options: any;
        _element: HTMLElement | null = null;
        _marker: any = null;

        constructor(options?: any) {
            this._options = options || {};
            if (options?.element) {
                this._element = options.element;
            }
        }

        setLngLat(lngLat: [number, number] | { lng: number; lat: number }) {
            const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
            this._lngLat = [lng, lat];
            
            if (this._marker) {
                try {
                    // Try Mappls style first
                    if (typeof this._marker.setPosition === 'function') {
                        this._marker.setPosition({ lat, lng });
                    } else if (typeof this._marker.setLngLat === 'function') {
                        // Standard Mapbox style
                        this._marker.setLngLat([lng, lat]);
                    }
                } catch (e) {
                    console.error('[MapboxShim] Failed to update marker position:', e);
                }
            }
            return this;
        }

        getLngLat() {
            if (this._marker) return this._marker.getLngLat();
            return { lng: this._lngLat[0], lat: this._lngLat[1] };
        }

        getElement() {
            return this._element || (this._marker ? this._marker.getElement() : null);
        }

        setPopup(popup: any) {
            if (this._marker) this._marker.setPopup(popup);
            return this;
        }

        addTo(map: any) {
            try {
                const MarkerClass = (window as any).mapboxgl?.Marker || (window as any).mappls?.Marker;
                if (!MarkerClass) throw new Error('No Marker class found');

                // Mappls v3 style: uses 'map' and 'position' in constructor
                if ((window as any).mappls && MarkerClass === (window as any).mappls.Marker) {
                    const mOptions: any = {
                        map,
                        position: { lat: this._lngLat[1], lng: this._lngLat[0] },
                        draggable: this._options.draggable || false,
                        ...this._options
                    };
                    if (this._element) mOptions.html = this._element.innerHTML;
                    
                    this._marker = new MarkerClass(mOptions);
                } else {
                    // Mapbox style: uses setLngLat and addTo(map)
                    this._marker = new MarkerClass(this._options)
                        .setLngLat(this._lngLat)
                        .addTo(map);
                }
            } catch (e) {
                console.error('[MapboxShim] Failed to add marker:', e);
            }
            return this;
        }

        remove() {
            if (this._marker) this._marker.remove();
            return this;
        }

        on(event: string, cb: Function) {
            if (this._marker) this._marker.on(event, cb);
            return this;
        }
    },
    Popup: class {
        _content: string = '';
        _lngLat: [number, number] = [0, 0];
        _popup: any = null;
        _options: any;

        constructor(options?: any) {
            this._options = options || {};
        }

        setHTML(html: string) {
            this._content = html;
            if (this._popup) this._popup.setHTML(html);
            return this;
        }

        setLngLat(lngLat: [number, number] | { lng: number; lat: number }) {
            if (Array.isArray(lngLat)) {
                this._lngLat = lngLat as [number, number];
            } else {
                this._lngLat = [lngLat.lng, lngLat.lat];
            }
            if (this._popup) this._popup.setLngLat(this._lngLat);
            return this;
        }

        addTo(map: any) {
            const PopupClass = (window as any).mapboxgl?.Popup || (window as any).mappls?.Popup;
            if (PopupClass) {
                this._popup = new PopupClass(this._options)
                    .setLngLat(this._lngLat)
                    .setHTML(this._content)
                    .addTo(map);
            }
            return this;
        }

        remove() {
            if (this._popup) this._popup.remove();
            return this;
        }
    },
    LngLatBounds: class {
        _sw: [number, number] = [180, 90];
        _ne: [number, number] = [-180, -90];

        extend(lngLat: [number, number] | { lng: number; lat: number }) {
            const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
            this._sw = [Math.min(this._sw[0], lng), Math.min(this._sw[1], lat)];
            this._ne = [Math.max(this._ne[0], lng), Math.max(this._ne[1], lat)];
            return this;
        }

        toArray() {
            return [this._sw, this._ne];
        }
        
        getSouthWest() { return { lng: this._sw[0], lat: this._sw[1] }; }
        getNorthEast() { return { lng: this._ne[0], lat: this._ne[1] }; }
    },
    GeolocateControl: class {
        constructor() { }
        on() { return this; }
        addTo() { return this; }
    }
};
