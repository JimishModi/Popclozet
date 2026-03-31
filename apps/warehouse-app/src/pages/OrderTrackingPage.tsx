/**
 * Order Tracking Page — Warehouse App
 * Full-screen live map showing rider position + route for a single dispatched order.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, Clock, MapPin, Truck, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    isMapboxAvailable,
    initializeMap,
    mapboxgl,
} from '@popclozet/map-core';
import { useOrderTracking } from '../hooks/useOrderTracking';

const ORDER_TYPE_LABEL: Record<string, string> = {
    delivery: 'Delivery',
    pickup: 'Pickup',
    return: 'Return',
};

const ORDER_TYPE_COLOR: Record<string, string> = {
    delivery: 'bg-blue-500/15 text-blue-400',
    pickup: 'bg-emerald-500/15 text-emerald-400',
    return: 'bg-amber-500/15 text-amber-400',
};

export function OrderTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { tracking, isLoading, isLive } = useOrderTracking(orderId);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const riderMarkerRef = useRef<any>(null);
    const destMarkerRef = useRef<any>(null);

    // Init map once we have coordinates
    useEffect(() => {
        if (!tracking || !mapContainerRef.current) return;
        if (!isMapboxAvailable()) return;
        if (mapRef.current) return;
        
        let mounted = true;

        (async () => {
            try {
                const map = await initializeMap(
                    mapContainerRef.current!,
                    [tracking.riderLng, tracking.riderLat],
                    14
                );
                
                if (!mounted) {
                    map.remove();
                    return;
                }
                
                mapRef.current = map;

                const setupMap = () => {
                    // Rider marker — blue dot with pulsing ring
                    const riderEl = document.createElement('div');
                    riderEl.className = 'rider-marker';
                    riderEl.innerHTML = `
                        <div style="
                            width:18px;height:18px;border-radius:50%;
                            background:#3b82f6;border:2px solid white;
                            box-shadow:0 0 0 4px rgba(59,130,246,0.3);
                            position:relative;
                        "></div>`;

                    riderMarkerRef.current = new mapboxgl.Marker({ element: riderEl, anchor: 'center' })
                        .setLngLat([tracking.riderLng, tracking.riderLat])
                        .addTo(map);

                    // Destination marker — red pin
                    if (tracking.destLat && tracking.destLng) {
                        const destEl = document.createElement('div');
                        destEl.innerHTML = `
                            <div style="
                                width:14px;height:14px;border-radius:50%;
                                background:#ef4444;border:2px solid white;
                                box-shadow:0 2px 8px rgba(0,0,0,0.4);
                            "></div>`;

                        destMarkerRef.current = new mapboxgl.Marker({ element: destEl, anchor: 'center' })
                            .setLngLat([tracking.destLng, tracking.destLat])
                            .addTo(map);

                        // Auto-fit map to show both markers
                        const bounds = new mapboxgl.LngLatBounds()
                            .extend([tracking.riderLng, tracking.riderLat])
                            .extend([tracking.destLng, tracking.destLat]);
                        
                        // We check map.fitBounds to be safe just in case the wrapper behaves slightly differently
                        if (map.fitBounds) map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
                    }
                };
                
                if (map.loaded && map.loaded()) {
                    setupMap();
                } else if (map.on) {
                    map.on('load', setupMap);
                }
            } catch (err) {
                console.error('Failed to initialize OrderTrackingMap', err);
            }
        })();

        return () => {
            mounted = false;
            riderMarkerRef.current?.remove();
            destMarkerRef.current?.remove();
            mapRef.current?.remove();
            mapRef.current = null;
            riderMarkerRef.current = null;
            destMarkerRef.current = null;
        };
    }, [tracking?.riderLat, tracking?.riderLng]);

    // Update rider marker + route source on every position update
    useEffect(() => {
        if (!tracking || !mapRef.current) return;

        const map = mapRef.current;

        // Move rider marker
        riderMarkerRef.current?.setLngLat([tracking.riderLng, tracking.riderLat]);
    }, [tracking?.riderLat, tracking?.riderLng]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center z-50">
                <div className="text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-zinc-400 text-sm">Loading tracking...</p>
                </div>
            </div>
        );
    }

    const noTracking = !tracking || !tracking.riderLat;

    return (
        <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 pb-2 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-full bg-black/70 backdrop-blur border border-zinc-800"
                >
                    <ArrowLeft size={18} className="text-white" />
                </button>
                <div className="flex-1 bg-black/70 backdrop-blur rounded-2xl px-3 py-2 border border-zinc-800">
                    <p className="text-[10px] text-zinc-500">Tracking Order</p>
                    <p className="text-xs font-mono text-zinc-300">#{orderId?.slice(0, 8)}</p>
                </div>
                {/* Live indicator */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border backdrop-blur ${isLive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-800/70 border-zinc-700'}`}>
                    <Radio size={12} className={isLive ? 'text-emerald-400' : 'text-zinc-500'} />
                    <span className={`text-[10px] font-semibold ${isLive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {isLive ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            {/* Map */}
            <div ref={mapContainerRef} className="flex-1" />

            {/* No tracking state */}
            {noTracking && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0a]">
                    <div className="text-center space-y-3 px-8">
                        <Truck size={40} className="mx-auto text-zinc-600" />
                        <p className="text-white font-semibold">Rider not broadcasting yet</p>
                        <p className="text-zinc-500 text-sm">Location updates will appear once the rider starts navigation on their device.</p>
                    </div>
                </div>
            )}

            {/* Bottom info strip */}
            {tracking && (
                <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="absolute bottom-0 left-0 right-0 bg-[#111]/95 backdrop-blur-md border-t border-zinc-800 rounded-t-2xl px-4 pt-4 pb-6"
                >
                    {/* Order type badge */}
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ORDER_TYPE_COLOR[tracking.orderType] ?? ORDER_TYPE_COLOR.delivery}`}>
                            {ORDER_TYPE_LABEL[tracking.orderType] ?? tracking.orderType}
                        </span>
                        {tracking.lastUpdated && (
                            <p className="text-[10px] text-zinc-600">
                                Updated {new Date(tracking.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>

                    <div className="flex items-start gap-4">
                        {/* ETA */}
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-blue-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-zinc-500">ETA</p>
                                <p className="text-base font-bold text-white leading-none">
                                    {tracking.etaMinutes != null ? `${tracking.etaMinutes} min` : '—'}
                                </p>
                            </div>
                        </div>

                        <div className="w-px h-10 bg-zinc-800 self-center" />

                        {/* Rider info */}
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Navigation size={14} className="text-zinc-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-zinc-500">Rider</p>
                                <p className="text-sm font-semibold text-white truncate leading-none">
                                    {tracking.driverName ?? 'Unknown'}
                                </p>
                                {tracking.vehicleNumber && (
                                    <p className="text-[10px] text-zinc-500">{tracking.vehicleNumber}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Destination address */}
                    {tracking.destAddress && (
                        <div className="mt-3 flex items-start gap-2 bg-zinc-900 rounded-xl px-3 py-2.5">
                            <MapPin size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-zinc-400 line-clamp-2">{tracking.destAddress}</p>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
