/**
 * LiveRiderMap — Warehouse live rider tracking map
 *
 * Renders a Mapbox dark map with:
 *  • Pulsing dot per active rider (moves in real-time)
 *  • Teardrop destination pin per rider
 *  • Route line rider → destination (redraws on > 50 m movement)
 *
 * View modes (toggled top-left):
 *  • All Riders  — fits bounds to every active rider
 *  • Per Order   — click a rider dot or order row to zoom into one
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
    mapboxgl,
    createMapInstance,
    createColorMarker,
    updateRouteSource,
    calculateDistance,
    getMapboxToken,
} from '@popclozet/mapbox-core';
import type { ActiveRider } from '../hooks/useActiveRiders';

interface Props {
    riders: ActiveRider[];
    selectedOrderId?: string | null;
    onRiderClick?: (orderId: string) => void;
    viewMode: 'all' | 'single';
    onViewModeChange: (mode: 'all' | 'single') => void;
}

const RIDER_COLORS  = ['#8855F7', '#F7558E', '#55C1F7', '#F7A855', '#55F7A2'];
const REDRAW_KM     = 0.05; // 50 m

interface RiderEntry {
    marker:       mapboxgl.Marker;
    destMarker:   mapboxgl.Marker;
    popup:        mapboxgl.Popup;
    color:        string;
    lastRoutePos: { lat: number; lng: number } | null;
}

export const LiveRiderMap: React.FC<Props> = ({
    riders, selectedOrderId, onRiderClick, viewMode, onViewModeChange,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<mapboxgl.Map | null>(null);
    const entriesRef   = useRef<Map<string, RiderEntry>>(new Map());
    const token        = getMapboxToken();

    // Draw / update Mapbox Directions route for one rider
    const drawRiderRoute = useCallback(async (
        map: mapboxgl.Map,
        orderId: string,
        rLng: number, rLat: number,
        dLng: number, dLat: number,
        color: string,
    ) => {
        if (!token) return;
        try {
            const res  = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${rLng},${rLat};${dLng},${dLat}?geometries=geojson&access_token=${token}`);
            const json = await res.json();
            if (!json.routes?.length) return;
            updateRouteSource(map, `route-${orderId}`, `route-layer-${orderId}`, json.routes[0].geometry.coordinates, color);
        } catch { /* silent */ }
    }, [token]);

    // Fit map to all riders
    const fitAll = useCallback(() => {
        const map = mapRef.current;
        if (!map || !riders.length) return;
        if (riders.length === 1) { map.flyTo({ center: [riders[0].lng, riders[0].lat], zoom: 14 }); return; }
        const bounds = new mapboxgl.LngLatBounds();
        riders.forEach((r) => { bounds.extend([r.lng, r.lat]); bounds.extend([r.deliveryAddress.lng, r.deliveryAddress.lat]); });
        map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 600 });
    }, [riders]);

    // Fit map to a single rider
    const fitRider = useCallback((rider: ActiveRider) => {
        const map = mapRef.current;
        if (!map) return;
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([rider.lng, rider.lat]);
        bounds.extend([rider.deliveryAddress.lng, rider.deliveryAddress.lat]);
        map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 600 });
    }, []);

    // Sync markers/routes to current riders array
    const syncRiders = useCallback((map: mapboxgl.Map) => {
        const currentIds = new Set(riders.map((r) => r.orderId));

        // Remove stale
        entriesRef.current.forEach((entry, orderId) => {
            if (currentIds.has(orderId)) return;
            entry.marker.remove();
            entry.destMarker.remove();
            entry.popup.remove();
            if (map.getLayer(`route-layer-${orderId}`)) map.removeLayer(`route-layer-${orderId}`);
            if (map.getSource(`route-${orderId}`))      map.removeSource(`route-${orderId}`);
            entriesRef.current.delete(orderId);
        });

        riders.forEach((rider, idx) => {
            const color    = RIDER_COLORS[idx % RIDER_COLORS.length];
            const existing = entriesRef.current.get(rider.orderId);

            if (existing) {
                existing.marker.setLngLat([rider.lng, rider.lat]);
                existing.popup.setHTML(popupHTML(rider));

                if (!existing.lastRoutePos || calculateDistance(existing.lastRoutePos, { lat: rider.lat, lng: rider.lng }) > REDRAW_KM) {
                    existing.lastRoutePos = { lat: rider.lat, lng: rider.lng };
                    drawRiderRoute(map, rider.orderId, rider.lng, rider.lat, rider.deliveryAddress.lng, rider.deliveryAddress.lat, existing.color);
                }
            } else {
                // Create rider dot
                const el    = createColorMarker(color, 14, true);
                const popup = new mapboxgl.Popup({ offset: 18, closeButton: false, className: 'rider-popup' }).setHTML(popupHTML(rider));
                const rMarker = new mapboxgl.Marker(el).setLngLat([rider.lng, rider.lat]).setPopup(popup).addTo(map);
                el.addEventListener('click', () => onRiderClick?.(rider.orderId));

                // Create destination pin
                const dEl     = destMarkerEl(color);
                const dMarker = new mapboxgl.Marker(dEl).setLngLat([rider.deliveryAddress.lng, rider.deliveryAddress.lat]).addTo(map);

                entriesRef.current.set(rider.orderId, { marker: rMarker, destMarker: dMarker, popup, color, lastRoutePos: null });

                if (rider.deliveryAddress.lat && rider.deliveryAddress.lng) {
                    drawRiderRoute(map, rider.orderId, rider.lng, rider.lat, rider.deliveryAddress.lng, rider.deliveryAddress.lat, color);
                    entriesRef.current.get(rider.orderId)!.lastRoutePos = { lat: rider.lat, lng: rider.lng };
                }
            }
        });
    }, [riders, drawRiderRoute, onRiderClick]);

    // Init map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current || !token) return;
        const map = createMapInstance(containerRef.current, [72.9133, 19.1334], 12);
        mapRef.current = map;
        map.on('load', () => syncRiders(map));

        // Resize map whenever the container changes size (handles framer-motion height animation)
        const ro = new ResizeObserver(() => { map.resize(); });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            map.remove();
            mapRef.current = null;
            entriesRef.current.clear();
        };
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-sync when riders change
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        syncRiders(map);
    }, [riders, syncRiders]);

    // Fit bounds on view mode / selected order change
    useEffect(() => {
        if (viewMode === 'all') { fitAll(); return; }
        if (viewMode === 'single' && selectedOrderId) {
            const r = riders.find((r) => r.orderId === selectedOrderId);
            if (r) fitRider(r);
        }
    }, [viewMode, selectedOrderId, riders, fitAll, fitRider]);

    // Inject popup CSS once
    useEffect(() => {
        if (document.getElementById('rider-popup-style')) return;
        const s = document.createElement('style');
        s.id = 'rider-popup-style';
        s.textContent = `.rider-popup .mapboxgl-popup-content{background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;color:#e4e4e7;font-size:12px;box-shadow:0 4px 20px rgba(0,0,0,.5);min-width:180px}.rider-popup .mapboxgl-popup-tip{border-top-color:#1a1a1a}`;
        document.head.appendChild(s);
    }, []);

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden">
            <div ref={containerRef} className="w-full h-full" />

            {!token && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-card rounded-xl">
                    <p className="text-xs text-zinc-500">Map unavailable — Mapbox token missing</p>
                </div>
            )}

            {token && riders.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-card/80 backdrop-blur-sm rounded-xl">
                    <p className="text-zinc-500 text-sm font-medium">No active riders</p>
                    <p className="text-zinc-600 text-xs mt-1">Map populates once orders are picked up</p>
                </div>
            )}

            {/* View mode toggle */}
            {riders.length > 0 && (
                <div className="absolute top-3 left-3 flex rounded-lg overflow-hidden border border-white/10 text-[11px] font-semibold shadow-lg">
                    {(['all', 'single'] as const).map((mode) => (
                        <button key={mode} onClick={() => onViewModeChange(mode)}
                            className={`px-3 py-1.5 transition-colors ${viewMode === mode ? 'bg-[#8855F7] text-white' : 'bg-[#1a1a1a]/90 text-zinc-400 hover:text-zinc-200'}`}>
                            {mode === 'all' ? 'All Riders' : 'Per Order'}
                        </button>
                    ))}
                </div>
            )}

            {/* Live badge */}
            {riders.length > 0 && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a1a1a]/90 border border-white/10 text-[10px] font-semibold text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {riders.length} rider{riders.length !== 1 ? 's' : ''} live
                </div>
            )}
        </div>
    );
};

function popupHTML(rider: ActiveRider): string {
    const addr  = rider.deliveryAddress.full_address || '';
    const short = addr.length > 40 ? addr.slice(0, 40) + '…' : addr;
    const label = rider.orderStatus.replace(/_/g, ' ');
    return `<div style="line-height:1.5"><p style="font-weight:600;margin-bottom:4px;color:#fff">${rider.riderName}</p><p style="color:#a1a1aa;margin-bottom:2px">📦 #${rider.orderId.slice(0, 8)}</p><p style="color:#a1a1aa;margin-bottom:4px">📍 ${short}</p><span style="background:rgba(136,85,247,.15);color:#c4a0fa;padding:2px 7px;border-radius:999px;font-size:10px">${label}</span></div>`;
}

function destMarkerEl(color: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(0,0,0,.5);`;
    const inner = document.createElement('div');
    inner.style.cssText = `width:10px;height:10px;background:white;border-radius:50%;transform:rotate(45deg);`;
    el.appendChild(inner);
    return el;
}
