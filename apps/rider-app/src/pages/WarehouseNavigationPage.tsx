/**
 * Warehouse Navigation Page
 *
 * Bug 4 fix: handleVerifyOtp now transitions to 'arrived' (not 'dispatched')
 *   and does NOT navigate away. The rider must still physically confirm pickup
 *   and dispatch before proceeding to delivery.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import { isMapboxAvailable, initializeMap, drawRoute, calculateDistance, mapboxgl } from '@popclozet/mapbox-core';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    markOrderPickedUp,
    markAsOutForDelivery,
    sendMessageToCustomer,
    verifyWarehouseOtp,
    releaseOrder,
    PREDEFINED_MESSAGES,
} from '@/services/riderOrderService';
import {
    MapPin, Navigation, Package, CheckCircle,
    MessageCircle, Truck, ChevronRight, X, KeyRound, Loader2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const WAREHOUSE_LOCATION: [number, number] = [72.9135, 19.1305]; // Hostel 2, IIT Bombay
const WAREHOUSE_ADDRESS = 'Hostel 2, IIT Bombay, Powai, Mumbai';

type PickupStep = 'navigating' | 'arrived' | 'picked_up';

const STEP_ORDER: PickupStep[] = [
    'navigating', 'arrived', 'picked_up',
];

const STEP_CONFIG: Record<PickupStep, { badge: string; badgeColor: string; icon: React.ElementType }> = {
    navigating: { badge: 'Navigate to Warehouse', badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Navigation },
    arrived: { badge: 'Arrived at Warehouse', badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: MapPin },
    picked_up: { badge: 'Package Collected — Ready to Deliver', badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: Truck },
};

function statusToStep(status: string): PickupStep {
    switch (status) {
        case 'driver_arrived_warehouse': return 'arrived';
        case 'order_picked_up':
        case 'dispatched': // Treat dispatched as picked_up for UI purposes
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
    const navigate = useNavigate();

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

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
    const [isCancelling, setIsCancelling] = useState(false);

    const showToastRef = useRef(showToast);
    const navigateRef = useRef(navigate);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);
    useEffect(() => { navigateRef.current = navigate; }, [navigate]);

    const riderName = useMemo(
        () => (profile as Record<string, unknown> | null)?.full_name as string | undefined,
        [profile],
    );

    // ── Fetch order ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const fetch = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, status, user_id, total_amount, addresses:delivery_address_id(full_address, latitude, longitude), order_items(*)')
                    .eq('id', id)
                    .single();
                if (error || !data) throw error ?? new Error('Order not found');
                if (cancelled) return;
                setOrder(data as unknown as WarehouseOrder);
                // Set step based on current status
                if (data.status === 'driver_arrived_warehouse') {
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

    // ── GPS ────────────────────────────────────────────────────────────────────

    const startNavigation = useCallback(() => {
        if (!navigator.geolocation) { showToast('GPS not supported', 'error'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => setRiderLocation([pos.coords.longitude, pos.coords.latitude]),
            () => showToast('Failed to get location', 'error'),
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
        );
    }, [showToast]);

    useEffect(() => {
        startNavigation();
    }, [startNavigation]);

    // ── Map ────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!riderLocation || !mapRef.current) return;
        if (!isMapboxAvailable() || !import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) return;
        if (mapInstance.current) return;

        let map: any;
        try {
            map = initializeMap(mapRef.current, riderLocation, 13);
        } catch (e) {
            console.warn('[WarehouseNav] Map init failed, retrying on clean container:', e);
            // Clear any stale mapbox state on the DOM node
            if (mapRef.current) {
                mapRef.current.innerHTML = '';
            }
            try {
                map = initializeMap(mapRef.current, riderLocation, 13);
            } catch (e2) {
                console.error('[WarehouseNav] Map init failed twice:', e2);
                return;
            }
        }

        mapInstance.current = map;
        map.on('load', async () => {
            await drawRoute(map, riderLocation, WAREHOUSE_LOCATION);

            // Add native geolocation control for live tracking
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);

            setMapReady(true);
        });
        return () => { mapInstance.current?.remove(); mapInstance.current = null; };
    }, [riderLocation?.[0], riderLocation?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

    const stepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

    // ── Actions ────────────────────────────────────────────────────────────────

    const handleConfirmArrival = useCallback(() => {
        if (!id || !user?.id) return;

        if (riderLocation) {
            const distance = calculateDistance(
                { lng: riderLocation[0], lat: riderLocation[1] },
                { lng: WAREHOUSE_LOCATION[0], lat: WAREHOUSE_LOCATION[1] }
            );
            if (distance > 0.2) { // Tighter radius but still allowing some drift
                const proceed = window.confirm(`You are ${distance.toFixed(2)}km away. Proceed only if at Hostel 2.`);
                if (!proceed) return;
            }
        }

        setOtpValue('');
        setShowOtpModal(true);
    }, [id, user?.id, riderLocation, showToast]);

    const handleVerifyOtp = useCallback(async () => {
        if (!id || !user?.id) return;
        if (otpValue.length !== 6) { showToast('Please enter a 6-digit PIN', 'error'); return; }

        setOtpVerifying(true);
        try {
            const result = await verifyWarehouseOtp(id, otpValue, user.id);
            if (!result.success) throw new Error(result.message);

            // OTP verified = rider confirmed arrival at warehouse.
            // Show "Confirm Pickup" next — do NOT navigate away yet.
            showToast('Arrival verified! Now confirm the pickup.', 'success');
            setStep('arrived');
            setShowOtpModal(false);
        } catch (err: any) {
            console.error('[Rider] Failed to verify OTP:', err);
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

    /**
     * After Confirm Pickup, single tap starts delivery:
     * marks order as out_for_delivery + notifies customer + navigates to delivery map
     */
    const handleStartNavigation = useCallback(async () => {
        if (!id || !user?.id || !order) return;
        setActionLoading(true);

        try {
            const result = await markAsOutForDelivery(id, user.id);
            if (!result.success) throw new Error(result.message);

            // Notify customer — their OTP card will now appear
            if (order?.user_id) {
                const riderName = (profile as any)?.full_name || 'Your rider';
                await supabase.from('notifications').insert({
                    user_id: order.user_id,
                    type: 'out_for_delivery',
                    title: '🚗 Your package is on the way!',
                    body: `${riderName} has picked up your package and is heading to you. Have your delivery code ready.`,
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
    const MessageButton = () => (
        <button
            onClick={() => setShowMessageModal(true)}
            disabled={messageSent}
            className={`w-full py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${messageSent
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                : 'border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800'
                }`}
        >
            <MessageCircle size={16} />
            {messageSent ? 'Message Sent ✓' : 'Send Message to Customer'}
        </button>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader size="lg" text="Loading warehouse pickup..." />
            </div>
        );
    }
    if (!order) return null;

    const currentStepCfg = STEP_CONFIG[step];

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            <div ref={mapRef} className="flex-1" />

            {!riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 pb-32">
                    <div className="text-center space-y-4 px-6">
                        <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                            <MapPin size={28} className="text-zinc-500" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Location Access Needed</h2>
                        <p className="text-zinc-400 text-sm">Please allow GPS access to enable navigation</p>
                        <button onClick={startNavigation} className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200">
                            Enable Location
                        </button>
                    </div>
                </div>
            )}

            {!mapReady && riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                    <Loader size="lg" text="Loading map..." />
                </div>
            )}

            <motion.div
                initial={{ y: 200 }} animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute bottom-6 left-4 right-4 bg-[#0f0f0f] rounded-3xl border border-zinc-800/80 shadow-2xl z-20"
            >
                <div className="px-6 pt-5 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${currentStepCfg.badgeColor}`}>
                            {currentStepCfg.badge}
                        </span>
                        {order.total_amount != null && (
                            <span className="text-[10px] text-zinc-500 ml-auto">₹{order.total_amount}</span>
                        )}
                    </div>
                    {/* Progress Steps */}
                    <div className="flex items-center gap-1 mb-4">
                        {STEP_ORDER.map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${STEP_ORDER.indexOf(step) >= i
                                        ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                                        : 'bg-zinc-800'
                                    }`} />
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex items-start gap-2 mb-4">
                        <MapPin size={14} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-zinc-400">{WAREHOUSE_ADDRESS}</p>
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 mb-3">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="px-6 pb-6 space-y-2.5">
                    <AnimatePresence mode="wait">
                        {step === 'navigating' && (
                            <motion.div key="navigating" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                                <button onClick={handleConfirmArrival} disabled={actionLoading || isCancelling} className={primaryBtn('from-blue-600 to-blue-500')}>
                                    {actionLoading ? <ActionSpinner /> : <><CheckCircle size={18} /> I've Arrived at Warehouse</>}
                                </button>
                                <button onClick={handleCancelDelivery} disabled={isCancelling || actionLoading} className="w-full py-2 text-sm text-zinc-500 font-medium hover:text-red-400 transition-colors">
                                    {isCancelling ? 'Cancelling...' : 'Cancel Delivery'}
                                </button>
                            </motion.div>
                        )}
                        {step === 'arrived' && (
                            <motion.div key="arrived" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                                <button onClick={handleConfirmPickup} disabled={actionLoading || isCancelling} className={primaryBtn('from-emerald-600 to-emerald-500')}>
                                    {actionLoading ? <ActionSpinner /> : <><Package size={18} /> Confirm Order Pickup</>}
                                </button>
                                <button onClick={handleCancelDelivery} disabled={isCancelling || actionLoading} className="w-full py-2 text-sm text-zinc-500 font-medium hover:text-red-400 transition-colors">
                                    {isCancelling ? 'Cancelling...' : 'Cancel Delivery'}
                                </button>
                            </motion.div>
                        )}
                        {step === 'picked_up' && (
                            <motion.div key="start-nav" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
                                {/* Primary: Start Navigation → heads to customer */}
                                <button
                                    onClick={handleStartNavigation}
                                    disabled={actionLoading}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
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

                                {/* Optional: message customer */}
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
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Message Modal */}
            <AnimatePresence>
                {showMessageModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <h3 className="font-semibold text-white">Send Update to Customer</h3>
                                <button onClick={() => setShowMessageModal(false)} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 space-y-3">
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
