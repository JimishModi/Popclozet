/**
 * Mappls Core - Shared Map Utilities
 * 
 * @popclozet/map-core v1.0.0
 * 
 * Core map initialization and cleanup logic.
 */

type MapboxMap = any;

declare var mappls: any;

export const isMapboxAvailable = () => typeof window !== 'undefined' && !!(window as any).mappls;

// Expose mapboxgl lazily since Mappls might load it dynamically
export const mapboxgl = typeof window !== 'undefined' ? new Proxy({}, {
    get: (_, prop) => {
        if (typeof window !== 'undefined' && (window as any).mapboxgl) {
            return (window as any).mapboxgl[prop];
        }
        return undefined;
    }
}) as any : {} as any;

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

async function edgeFetch(action: string, body: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/location`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action, ...body }),
    });
    return res.json();
}

export const searchAddress = async (query: string, lat?: number, lng?: number) => {
    try {
        const body: any = { query };
        if (lat !== undefined && lng !== undefined) {
            body.lat = lat;
            body.lng = lng;
        }
        return await edgeFetch('search', body);
    } catch (e) {
        console.error('Failed to search address:', e);
        return [];
    }
};



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
    center: { lat: 19.1305, lng: 72.9135 }, // Hostel 2, IIT Bombay
    radiusKm: 6,
    warehouseLocation: { lat: 19.1305, lng: 72.9135 },
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
    try {
        const data = await edgeFetch('reverse', { lat, lng });
        if (!data || !data.formatted_address) return null;
        return {
            city: data.city || 'Current location',
            locality: data.city || 'Current location',
            fullAddress: data.formatted_address,
            state: data.state || '',
            country: 'India',
        };
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
    try {
        const data = await edgeFetch('directions', {
            origin: `${startLng},${startLat}`,
            destination: `${endLng},${endLat}`,
        });
        if (!data || !data.routes?.[0]?.geometry?.coordinates) return null;
        return data.routes[0].geometry.coordinates;
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

export const createMapInstance = async (
    container: HTMLElement,
    center: [number, number],
    zoom: number = 13
): Promise<MapboxMap> => {
    const tokenData = await edgeFetch('token', {});
    const activeToken = tokenData?.token;
    if (!activeToken) throw new Error('Mappls access token not available');

    if (!container.id) {
        container.id = `mappls-map-${Math.random().toString(36).substring(7)}`;
    }
    const mapObject = new mappls();
    return new Promise((resolve) => {
        mapObject.initialize(activeToken, { map: true }, () => {
            const map = mapObject.Map({
                id: container.id,
                center: [center[1], center[0]],
                zoom,
                addControl: true,
                attributionControl: false,
            }) as any;
            resolve(map);
        });
    });
};


