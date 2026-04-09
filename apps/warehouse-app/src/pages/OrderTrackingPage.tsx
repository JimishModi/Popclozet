/**
 * Order Tracking Page — Warehouse App
 * Full-screen live map showing rider position for a single dispatched order.
 * Uses Leaflet + CartoDB Dark Matter tiles — no API key required.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, Clock, MapPin, Truck, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
    const mapRef = useRef<L.Map | null>(null);
    const riderMarkerRef = useRef<L.Marker | null>(null);
    const destMarkerRef = useRef<L.Marker | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // Initialize Leaflet map once loading is finished and container is in DOM
    useEffect(() => {
        if (isLoading || !mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [19.1367, 72.9125], // Default: warehouse area (Mumbai)
            zoom: 13,
            zoomControl: false,         // Hide default +/- buttons (pinch-to-zoom on mobile)
            attributionControl: false,  // Clean UI
        });

        // CartoDB Dark Matter tiles — free, no API key, dark theme
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
            crossOrigin: true,
        }).addTo(map);

        mapRef.current = map;

        // Give the browser one frame to compute flex layout before Leaflet reads dimensions
        const rafId = requestAnimationFrame(() => map.invalidateSize());

        setMapReady(true);

        return () => {
            setMapReady(false);
            cancelAnimationFrame(rafId);
            riderMarkerRef.current = null;
            destMarkerRef.current = null;
            map.remove();
            mapRef.current = null;
        };
    }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!mapReady || !tracking || !mapRef.current) return;
        const map = mapRef.current;

        if (!riderMarkerRef.current) {
            // First time tracking data arrives — create markers and fit map
            const riderIcon = L.divIcon({
                className: '',
                html: `<div style="
                    width:18px;height:18px;border-radius:50%;
                    background:#3b82f6;border:2px solid white;
                    box-shadow:0 0 0 6px rgba(59,130,246,0.25);
                "></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            });
            riderMarkerRef.current = L.marker([tracking.riderLat, tracking.riderLng], { icon: riderIcon }).addTo(map);

            if (tracking.destLat && tracking.destLng) {
                const destIcon = L.divIcon({
                    className: '',
                    html: `<div style="
                        width:14px;height:14px;border-radius:50%;
                        background:#ef4444;border:2px solid white;
                        box-shadow:0 2px 8px rgba(0,0,0,0.5);
                    "></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                });
                destMarkerRef.current = L.marker([tracking.destLat, tracking.destLng], { icon: destIcon }).addTo(map);

                // Fit to show both rider + destination
                map.fitBounds(
                    L.latLngBounds(
                        [tracking.riderLat, tracking.riderLng],
                        [tracking.destLat, tracking.destLng]
                    ),
                    { padding: [60, 60], maxZoom: 14 }
                );
            } else {
                map.setView([tracking.riderLat, tracking.riderLng], 15);
            }
        } else {
            // Subsequent updates — just move the rider dot
            riderMarkerRef.current.setLatLng([tracking.riderLat, tracking.riderLng]);
        }
    }, [mapReady, tracking?.riderLat, tracking?.riderLng]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="absolute top-0 left-0 right-0 z-[9999] px-4 pt-4 pb-2 flex items-center gap-3">
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

            {/* Map container — fills remaining space */}
            <div
                ref={mapContainerRef}
                className="flex-1"
                style={{ background: '#0a0a0a', minHeight: 0 }}
            />

            {/* No tracking state — covers map while rider hasn't started */}
            {noTracking && (
                <div className="absolute inset-0 flex items-center justify-center z-[500] bg-[#0a0a0a]">
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
                    className="absolute bottom-0 left-0 right-0 z-[9999] bg-[#111]/95 backdrop-blur-md border-t border-zinc-800 rounded-t-2xl px-4 pt-4 pb-6"
                >
                    {/* Order type badge + last update */}
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
