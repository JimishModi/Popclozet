/**
 * Warehouse Navigation Page
 *
 * Refactored to use global LocationContext for persistent GPS tracking.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import { isMapboxAvailable, initializeMap, drawRoute, calculateDistance, mapboxgl, fetchMapplsRoute } from '@popclozet/map-core';
import { useToast } from '@/contexts/ToastContext';
import { useLocation } from '@/contexts/LocationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    markOrderPickedUp,
    markAsDispatched,
    markAsOutForDelivery,
    riderDropOffReturn,
    sendMessageToCustomer,
    verifyWarehouseOtp,
    releaseOrder,
    updateRiderLocation,
    PREDEFINED_MESSAGES,
} from '@/services/riderOrderService';
import {
    MapPin, Navigation, Package, CheckCircle,
    MessageCircle, Truck, ChevronRight, X, KeyRound, Loader2,
} from 'lucide-react';

const GPS_BROADCAST_INTERVAL_MS = 5_000;
const GPS_MOVE_THRESHOLD_M = 50;

function haversineMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6_371_000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WAREHOUSE_LOCATION: [number, number] = [72.9135, 19.1305]; // Hostel 2, IIT Bombay
const WAREHOUSE_ADDRESS = 'Hostel 2, IIT Bombay, Powai, Mumbai';

type PickupStep = 'navigating' | 'arrived' | 'picked_up';

const STEP_ORDER: PickupStep[] = [
    'navigating', 'arrived', 'picked_up',
];

const STEP_CONFIG: Record<PickupStep, { badge: string; badgeColor: string; icon: React.ElementType }> = {
    navigating: { badge: 'Navigate to Warehouse', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Navigation },
    arrived: { badge: 'Arrived at Warehouse', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: MapPin },
    picked_up: { badge: 'Ready to Deliver', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Truck },
};

function statusToStep(status: string): PickupStep {
    switch (status) {
        case 'rider_assigned': return 'navigating';
        case 'driver_arrived_warehouse': return 'arrived';
        case 'order_picked_up':
        case 'dispatched':
        case 'out_for_delivery': return 'picked_up';
        default: return 'navigating';
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarehouseOrder {
    id: string;
    status: string;
    user_id: string;
    total_amount?: number;
    warehouse_otp?: string | null;
    addresses?: { full_address: string; latitude: number; longitude: number };
    order_items?: Array<{ id: string; product_id: string; size?: string; rental_price?: number }>;
}

async function insertNotification(payload: {
    user_id: string; type: string; title: string; body: string; order_id: string;
}) {
    const { error } = await supabase.from('notifications').insert({ ...payload, is_read: false });
    if (error) console.error('[Notification] insert failed:', error);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WarehouseNavigationPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    const { location: globalLocation } = useLocation();
    const navigate = useNavigate();

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    const [order, setOrder] = useState<WarehouseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [step, setStep] = useState<PickupStep>('navigating');
    const [actionLoading, setActionLoading] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpVerifying, setOtpVerifying] = useState(false);
    
    // Persist returnOtp in sessionStorage so a page reload doesn't lose the warehouse OTP
    const returnOtpStorageKey = id ? `returnOtp_${id}` : null;
    const [returnOtp, setReturnOtpState] = useState<string | null>(() => {
        if (!id) return null;
        return sessionStorage.getItem(`returnOtp_${id}`) ?? null;
    });
    const setReturnOtp = (otp: string | null) => {
        setReturnOtpState(otp);
        if (returnOtpStorageKey) {
            if (otp) sessionStorage.setItem(returnOtpStorageKey, otp);
            else sessionStorage.removeItem(returnOtpStorageKey);
        }
    };
    const [isCancelling, setIsCancelling] = useState(false);

    // GPS broadcast refs (background — no re-render)
    const gpsBroadcastTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastBroadcastPos  = useRef<{ lat: number; lng: number } | null>(null);

    const showToastRef = useRef(showToast);
    const navigateRef = useRef(navigate);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);
    useEffect(() => { navigateRef.current = navigate; }, [navigate]);

    const riderName = useMemo(
        () => (profile as unknown as { full_name?: string } | null)?.full_name,
        [profile],
    );
    const isReturnFlow = useMemo(
        () => ['return_picked_up', 'return_at_warehouse', 'returned', 'return_completed'].includes(order?.status ?? ''),
        [order?.status],
    );

    // ── useMemo for step config ──

    const currentStepCfg = useMemo(() => {
        if (!isReturnFlow) return STEP_CONFIG[step];
        switch (step) {
            case 'navigating':
                return {
                    badge: 'Return Drop-off',
                    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
                    icon: Truck,
                };
            case 'picked_up':
                return {
                    badge: 'Return Received',
                    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    icon: CheckCircle,
                };
            default:
                return STEP_CONFIG[step];
        }
    }, [isReturnFlow, step]);

    // ── Fetch order ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const fetch = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, status, user_id, total_amount, warehouse_otp, addresses:delivery_address_id(full_address, latitude, longitude), order_items(*)')
                    .eq('id', id)
                    .single();
                if (error || !data) throw error ?? new Error('Order not found');
                if (cancelled) return;
                setOrder(data as unknown as WarehouseOrder);
                // Set step based on current status
                if (['returned', 'return_completed'].includes(data.status)) {
                    setStep('picked_up');
                } else if (data.status === 'return_at_warehouse') {
                    setStep('picked_up');
                } else if (data.status === 'driver_arrived_warehouse') {
                    setStep('arrived');
                } else if (data.status === 'order_picked_up' || data.status === 'dispatched' || data.status === 'out_for_delivery') {
                    setStep('picked_up');
                } else {
                    setStep('navigating');
                }
            } catch (err) {
                if (cancelled) return;
                console.error('[WarehouseNav] fetchOrder:', err);
                showToastRef.current('Order not found', 'error');
                navigateRef.current('/');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetch();
        return () => { cancelled = true; };
    }, [id]);

    // ── Sync global location to local state ──────────────────────────────────────

    useEffect(() => {
        if (globalLocation) {
            const coords: [number, number] = [globalLocation.longitude, globalLocation.latitude];
            setRiderLocation(coords);
        }
    }, [globalLocation]);

    // ── GPS background broadcast → warehouse app can see rider approaching ─────

    useEffect(() => {
        if (!user?.id || !order || !globalLocation) return;
        const activeStatuses = ['rider_assigned', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 'out_for_delivery'];
        if (!activeStatuses.includes(order.status)) return;

        gpsBroadcastTimer.current = setInterval(() => {
            if (!user?.id || !globalLocation) return;
            const curr = { lat: globalLocation.latitude, lng: globalLocation.longitude };
            const last = lastBroadcastPos.current;
            if (last && haversineMetres(last, curr) < GPS_MOVE_THRESHOLD_M) return;
            lastBroadcastPos.current = curr;
            updateRiderLocation(user.id, curr.lat, curr.lng, globalLocation.heading ?? undefined, globalLocation.speed ?? undefined);
        }, GPS_BROADCAST_INTERVAL_MS);

        return () => {
            if (gpsBroadcastTimer.current) { clearInterval(gpsBroadcastTimer.current); gpsBroadcastTimer.current = null; }
        };
    }, [user?.id, order?.status, globalLocation]);

    // ── Open in Google Maps ────────────────────────────────────────────────────

    const handleOpenGoogleMaps = useCallback(() => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(WAREHOUSE_ADDRESS)}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

    // ── Map ────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!riderLocation || !mapRef.current) return;
        if (!isMapboxAvailable()) return; // checks VITE_MAPPLS_REST_KEY
        if (mapInstance.current) return;

        let mounted = true;

        (async () => {
            try {
                const map = await initializeMap(mapRef.current!, riderLocation, 13);

                if (!mounted) {
                    map.remove();
                    return;
                }
                mapInstance.current = map;

                const setupMap = async () => {
                    let routeDrawn = false;

                    if (riderLocation) {
                        try {
                            const [rLng, rLat] = riderLocation;
                            const [wLng, wLat] = WAREHOUSE_LOCATION;
                            const routeCoords = await fetchMapplsRoute(rLng, rLat, wLng, wLat);
                            if (routeCoords?.length) {
                                await drawRoute(map, routeCoords);
                                routeDrawn = true;
                            }
                        } catch (err) {
                            console.warn('[WarehouseNav] Mappls Route API failed:', err);
                        }
                    }

                    if (!routeDrawn) {
                        await drawRoute(map, [riderLocation!, WAREHOUSE_LOCATION]);
                    }

                    try {
                        const geolocate = new (mapboxgl.GeolocateControl as any)({
                            positionOptions: { enableHighAccuracy: true },
                            trackUserLocation: true,
                            showUserHeading: true,
                        });
                        map.addControl(geolocate);
                    } catch { /* mapboxgl shim — GeolocateControl is a no-op */ }

                    setMapReady(true);
                };

                if (map.loaded && map.loaded()) {
                    setupMap();
                } else if (map.on) {
                    map.on('load', setupMap);
                }
            } catch (e) {
                console.error('[WarehouseNav] Map init failed:', e);
            }
        })();

        return () => {
            mounted = false;
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, [riderLocation?.[0], riderLocation?.[1]]);

    // ── Actions ────────────────────────────────────────────────────────────────

    const handleDropOffReturn = useCallback(async () => {
        if (!id || !user?.id || !order) return;
        setActionLoading(true);
        try {
            const result = await riderDropOffReturn(id, user.id);
            if (!result.success) throw new Error(result.message);

            setReturnOtp(result.otp || null);

            await insertNotification({
                user_id: order.user_id,
                type: 'return_at_warehouse',
                title: '🏬 Return arrived at warehouse',
                body: 'Your return has arrived at the warehouse and is being processed.',
                order_id: id,
            });

            showToast('Return dropped off! Show the OTP to warehouse staff.', 'success');
            setStep('picked_up');
        } catch (err: any) {
            showToast(err.message || 'Failed to drop off return', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [id, user?.id, order, showToast]);

    const handleConfirmArrival = useCallback(() => {
        if (!id || !user?.id) return;

        if (riderLocation) {
            const distance = calculateDistance(
                { lng: riderLocation[0], lat: riderLocation[1] },
                { lng: WAREHOUSE_LOCATION[0], lat: WAREHOUSE_LOCATION[1] }
            );
            if (distance > 0.2) {
                const proceed = window.confirm(`You are ${distance.toFixed(2)}km away. Proceed only if at Hostel 2.`);
                if (!proceed) return;
            }
        }

        if (isReturnFlow) {
            void handleDropOffReturn();
            return;
        }

        setOtpValue('');
        setShowOtpModal(true);
    }, [id, user?.id, riderLocation, isReturnFlow, handleDropOffReturn]);

    const handleVerifyOtp = useCallback(async () => {
        if (!id || !user?.id) return;
        if (otpValue.length !== 6) { showToast('Please enter a 6-digit PIN', 'error'); return; }

        setOtpVerifying(true);
        try {
            const result = await verifyWarehouseOtp(id, otpValue, user.id);
            if (!result.success) throw new Error(result.message);

            showToast('Arrival verified! Now confirm the pickup.', 'success');
            setStep('arrived');
            setOrder(prev => prev ? { ...prev, status: 'driver_arrived_warehouse' } : prev);
            setShowOtpModal(false);
        } catch (err: any) {
            showToast(err.message || 'Failed to verify PIN', 'error');
        } finally {
            setOtpVerifying(false);
        }
    }, [id, user?.id, otpValue, showToast]);

    const handleConfirmPickup = useCallback(async () => {
        if (!id || !user?.id || !order) return;
        setActionLoading(true);
        try {
            const result = await markOrderPickedUp(id, user.id);
            if (!result.success) throw new Error(result.message);
            setStep('picked_up');
            setOrder(prev => prev ? { ...prev, status: 'order_picked_up' } : prev);
            showToast('Order picked up! Ready to deliver.', 'success');
            await insertNotification({
                user_id: order.user_id,
                type: 'order_picked_up',
                title: '✅ Package picked up!',
                body: `${riderName ?? 'Your rider'} has collected your package and will deliver it shortly.`,
                order_id: id,
            });
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Failed to confirm pickup', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [id, user?.id, order, riderName, showToast]);

    const handleStartNavigation = useCallback(async () => {
        if (!id || !user?.id || !order) return;
        setActionLoading(true);

        try {
            if (order.status === 'order_picked_up') {
                const dispatchResult = await markAsDispatched(id, user.id);
                if (!dispatchResult.success) throw new Error(dispatchResult.message);
            }

            if (order.status !== 'out_for_delivery') {
                const result = await markAsOutForDelivery(id, user.id);
                if (!result.success) throw new Error(result.message);
            }

            if (order?.user_id) {
                const rName = (profile as any)?.full_name || 'Your rider';
                await supabase.from('notifications').insert({
                    user_id: order.user_id,
                    type: 'out_for_delivery',
                    title: '🚗 Your package is on the way!',
                    body: `${rName} has picked up your package and is heading to you. Have your delivery code ready.`,
                    order_id: id,
                    is_read: false,
                });
            }

            showToast('On the way! Navigating to customer.', 'success');
            navigate(`/delivery/${id}`);
        } catch (err: any) {
            showToast(err.message || 'Failed to start navigation', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [id, user?.id, order, profile, showToast, navigate]);

    const handleCancelDelivery = useCallback(async () => {
        if (!id || !user?.id) return;
        const confirm = window.confirm('Are you sure you want to cancel this delivery? It will be reassigned to another rider.');
        if (!confirm) return;

        setIsCancelling(true);
        try {
            const result = await releaseOrder(id, user.id);
            if (!result.success) throw new Error(result.message);
            showToast('Delivery cancelled. You can now accept other orders.', 'success');
            navigate('/');
        } catch (err: any) {
            showToast(err.message || 'Failed to cancel delivery', 'error');
        } finally {
            setIsCancelling(false);
        }
    }, [id, user?.id, showToast, navigate]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!id || !order?.user_id) return;
        setActionLoading(true);
        try {
            await sendMessageToCustomer(id, order.user_id, message, riderName);
            showToast('Message sent!', 'success');
            setMessageSent(true);
            setShowMessageModal(false);
        } catch {
            showToast('Failed to send message', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [id, order?.user_id, riderName, showToast]);

    // ── Render helpers ─────────────────────────────────────────────────────────

    const ActionSpinner = () => (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    );
    const primaryBtn = (gradient: string) =>
        `w-full py-3.5 rounded-xl bg-gradient-to-r ${gradient} text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50`;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader size="lg" text="Loading warehouse pickup..." />
            </div>
        );
    }
    if (!order) return null;

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            <div ref={mapRef} className="flex-1" />

            {!riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 pb-32">
                    <div className="text-center space-y-4 px-6">
                        <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                            <MapPin size={28} className="text-zinc-500" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Getting your location...</h2>
                        <p className="text-zinc-400 text-sm">Please allow GPS access to enable navigation</p>
                        <div className="w-6 h-6 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                </div>
            )}

            {!mapReady && riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                    <Loader size="lg" text="Loading map..." />
                </div>
            )}

            <motion.div
                initial={{ y: 200, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute bottom-6 left-4 right-4 bg-zinc-900/60 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 overflow-hidden"
            >
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <div className="px-6 pt-6 pb-2 relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${currentStepCfg.badgeColor}`}>
                            {currentStepCfg.badge}
                        </span>
                        {order.total_amount != null && (
                            <span className="text-[10px] font-bold text-white/40 ml-auto tracking-widest">₹{order.total_amount}</span>
                        )}
                    </div>
                    {/* Progress Steps */}
                    <div className="flex items-center gap-1.5 mb-5">
                        {STEP_ORDER.map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${STEP_ORDER.indexOf(step) >= i
                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                        : 'bg-white/5'
                                    }`} />
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                            <MapPin size={16} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Warehouse</p>
                            <p className="text-xs text-white font-medium line-clamp-1">{WAREHOUSE_ADDRESS}</p>
                        </div>
                    </div>

                    {['rider_assigned', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 'out_for_delivery'].includes(order?.status ?? '') && (
                        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 w-fit">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live GPS Active</p>
                        </div>
                    )}
                    <p className="text-[10px] font-bold text-white/20 mb-4 tracking-widest">ORDER #{order.id.slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="px-6 pb-6 space-y-2.5">
                    <AnimatePresence mode="wait">
                        {step === 'navigating' && isReturnFlow && (
                            <motion.div key="navigating-return" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                                <button
                                    onClick={() => handleDropOffReturn()}
                                    disabled={actionLoading}
                                    className={primaryBtn('from-indigo-600 to-indigo-500')}
                                >
                                    {actionLoading ? <ActionSpinner /> : <><CheckCircle size={18} /> Drop-off Return at Warehouse</>}
                                </button>
                            </motion.div>
                        )}
                        {step === 'navigating' && !isReturnFlow && (
                            <motion.div key="navigating" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                                <button
                                    onClick={handleOpenGoogleMaps}
                                    className="w-full py-3 rounded-xl bg-[#4285F4] hover:bg-[#3b78e7] active:scale-[0.98] transition-all text-white font-semibold text-sm flex items-center justify-center gap-2"
                                >
                                    <Navigation size={16} />
                                    Open in Google Maps
                                </button>
                                <button onClick={handleConfirmArrival} disabled={actionLoading || isCancelling} className={primaryBtn('from-blue-600 to-blue-500')}>
                                    {actionLoading ? <ActionSpinner /> : <><CheckCircle size={18} /> I've Arrived at Warehouse</>}
                                </button>
                                <button onClick={handleCancelDelivery} disabled={isCancelling || actionLoading} className="w-full py-2 text-sm text-zinc-500 font-medium hover:text-red-400 transition-colors">
                                    {isCancelling ? 'Cancelling...' : 'Cancel Delivery'}
                                </button>
                            </motion.div>
                        )}
                        {step === 'arrived' && !isReturnFlow && (
                            <motion.div key="arrived" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                                <button onClick={handleConfirmPickup} disabled={actionLoading || isCancelling} className={primaryBtn('from-emerald-600 to-emerald-500')}>
                                    {actionLoading ? <ActionSpinner /> : <><Package size={18} /> Confirm Order Pickup</>}
                                </button>
                                <button onClick={handleCancelDelivery} disabled={isCancelling || actionLoading} className="w-full py-2 text-sm text-zinc-500 font-medium hover:text-red-400 transition-colors">
                                    {isCancelling ? 'Cancelling...' : 'Cancel Delivery'}
                                </button>
                            </motion.div>
                        )}
                        {step === 'picked_up' && !isReturnFlow && (
                            <motion.div key="start-nav" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
                                <button
                                    onClick={handleStartNavigation}
                                    disabled={actionLoading}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-blue-500/20"
                                >
                                    {actionLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Navigation size={18} />
                                            Head to Customer
                                            <ChevronRight size={16} />
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setShowMessageModal(true)}
                                    disabled={messageSent}
                                    className={`w-full py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${messageSent
                                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                            : 'border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800'
                                        }`}
                                >
                                    <MessageCircle size={16} />
                                    {messageSent ? 'Message Sent ✓' : 'Message Customer'}
                                </button>
                            </motion.div>
                        )}
                        {step === 'picked_up' && isReturnFlow && (
                            <motion.div key="return-dropoff" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                                {(returnOtp ?? order?.warehouse_otp) ? (
                                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 text-center">
                                        <KeyRound size={24} className="mx-auto text-blue-400 mb-2" />
                                        <p className="text-white font-semibold text-sm mb-1">Warehouse Verification OTP</p>
                                        <p className="text-zinc-400 text-xs mb-3">Show this code to warehouse staff</p>
                                        <div className="text-4xl font-mono font-bold text-white tracking-[0.3em] bg-black/50 rounded-xl py-3 px-4 border border-zinc-800">
                                            {returnOtp ?? order?.warehouse_otp}
                                        </div>
                                        <p className="text-zinc-500 text-xs mt-3">Expires in 15 minutes</p>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                                        <CheckCircle size={22} className="mx-auto text-emerald-400 mb-2" />
                                        <p className="text-white font-semibold">Return dropped off at warehouse</p>
                                        <p className="text-zinc-400 text-sm mt-1">Waiting for warehouse to verify...</p>
                                    </div>
                                )}
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800 text-sm font-medium transition-all"
                                >
                                    Back to Dashboard
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Message Modal */}
            <AnimatePresence>
                {showMessageModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                            <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10">
                                <h3 className="font-bold text-white uppercase tracking-widest text-xs">Update Customer</h3>
                                <button onClick={() => setShowMessageModal(false)} className="p-2 text-zinc-500 hover:text-white rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-3 relative z-10">
                                {PREDEFINED_MESSAGES.map((msg, i) => (
                                    <button key={i} onClick={() => handleSendMessage(msg)} disabled={actionLoading}
                                        className="w-full text-left p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors text-sm text-zinc-300 disabled:opacity-50">
                                        "{msg}"
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* OTP Modal */}
            <AnimatePresence>
                {showOtpModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    <KeyRound size={18} className="text-blue-400" /> Verify Arrival
                                </h3>
                                <button onClick={() => { if (!otpVerifying) setShowOtpModal(false); }} disabled={otpVerifying}
                                    className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-50">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-5 text-center">
                                <p className="text-sm text-zinc-400">
                                    Ask the warehouse staff for the 6-digit Arrival PIN to confirm you are at the correct location.
                                </p>
                                <input type="text" inputMode="numeric" pattern="\d*" maxLength={6}
                                    value={otpValue} onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                    autoFocus placeholder="000000"
                                    className="w-full text-center text-4xl font-mono font-bold tracking-[0.2em] bg-black border border-zinc-800 rounded-xl py-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-800"
                                />
                                <button onClick={handleVerifyOtp} disabled={otpValue.length !== 6 || otpVerifying}
                                    className={primaryBtn('from-blue-600 to-blue-500')}>
                                    {otpVerifying ? <><Loader2 size={18} className="animate-spin" /> Verifying...</> : 'Verify PIN'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WarehouseNavigationPage;
