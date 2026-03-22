/**
 * Delivery Navigation Page
 *
 * 3-step flow:
 *   1. navigating  — map shown, rider drives to customer
 *   2. arrived     — "Location Reached" tapped; OTP input appears inline
 *   3. done        — OTP verified, order marked delivered, navigate home
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import { isMapboxAvailable, initializeMap, drawRoute, calculateDistance, mapboxgl } from '@popclozet/mapbox-core';
import { useToast } from '@/contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, MapPin, KeyRound, Loader2, CheckCircle, X } from 'lucide-react';
import { releaseOrder } from '@/services/riderOrderService';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStep = 'navigating' | 'arrived' | 'done';

interface DeliveryAddress {
    full_address: string;
    latitude: number;
    longitude: number;
}

interface DeliveryOrder {
    id: string;
    status: string;
    user_id: string;
    order_type?: string | null;
    otp_delivery?: string;
    otp_return?: string;
    addresses: DeliveryAddress | null;
}

// ─── Notification helpers ─────────────────────────────────────────────────────

async function insertNotification(payload: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    order_id: string;
}) {
    const { error } = await supabase
        .from('notifications')
        .insert({ ...payload, is_read: false });
    if (error) console.error('[DeliveryNav] notification insert failed:', error.message);
}

async function notifyWarehouse(orderId: string, type: string, title: string, body: string) {
    const { data: staff } = await supabase
        .from('warehouse_profiles')
        .select('user_id');

    if (!staff?.length) return;

    const rows = staff.map((s) => ({
        user_id: s.user_id,
        type,
        title,
        body,
        order_id: orderId,
        is_read: false,
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.error('[DeliveryNav] warehouse notification failed:', error.message);
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const primaryBtn = (gradient: string) =>
    `w-full py-3.5 rounded-xl bg-gradient-to-r ${gradient} text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50`;

// ─── Component ────────────────────────────────────────────────────────────────

export const DeliveryNavigationPage: React.FC = () => {
    const { id }        = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    const navigate      = useNavigate();

    // Stable refs so callbacks don't go stale
    const showToastRef = useRef(showToast);
    const navigateRef  = useRef(navigate);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);
    useEffect(() => { navigateRef.current  = navigate;  }, [navigate]);

    // Map
    const mapRef      = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    // State
    const [order, setOrder]               = useState<DeliveryOrder | null>(null);
    const [loading, setLoading]           = useState(true);
    const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady]         = useState(false);
    const [step, setStep]                 = useState<DeliveryStep>('navigating');
    const [actionLoading, setActionLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // OTP
    const [otpValue, setOtpValue]       = useState('');
    const [otpVerifying, setOtpVerifying] = useState(false);

    const riderName = useMemo(
        () => (profile as unknown as { full_name?: string } | null)?.full_name,
        [profile],
    );
    const isReturnFlow = useMemo(
        () => ['return_scheduled', 'return_dispatched', 'return_picked_up', 'returned'].includes(order?.status ?? ''),
        [order?.status],
    );

    // ── Fetch order ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        const fetchOrder = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, status, user_id, order_type, otp_delivery, otp_return, addresses:delivery_address_id(full_address, latitude, longitude)')
                    .eq('id', id)
                    .single();

                if (error || !data) throw error ?? new Error('Order not found');
                if (cancelled) return;
                setOrder(data as unknown as DeliveryOrder);
            } catch (err) {
                if (cancelled) return;
                console.error('[DeliveryNav] fetchOrder:', err);
                showToastRef.current('Order not found', 'error');
                navigateRef.current('/');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchOrder();
        return () => { cancelled = true; };
    }, [id]);

    // ── Geolocation (user-triggered) ───────────────────────────────────────────

    const startNavigation = useCallback(() => {
        if (!navigator.geolocation) {
            showToastRef.current('GPS not supported', 'error');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setRiderLocation(coords);
                // High-accuracy follow-up
                navigator.geolocation.getCurrentPosition(
                    (high) => setRiderLocation([high.coords.longitude, high.coords.latitude]),
                    () => {},
                    { enableHighAccuracy: true, timeout: 15_000 },
                );
            },
            () => showToastRef.current('Failed to get location', 'error'),
            { enableHighAccuracy: false, timeout: 5_000, maximumAge: 300_000 },
        );
    }, []);

    useEffect(() => {
        startNavigation();
    }, [startNavigation]);

    // ── Derived values ─────────────────────────────────────────────────────────

    const destination = useMemo<[number, number] | null>(() => {
        const addr = order?.addresses;
        if (!addr) return null;
        return [addr.longitude, addr.latitude];
    }, [order?.addresses]);

    const deliveryAddress = useMemo(
        () => order?.addresses?.full_address ?? 'Delivery Address',
        [order?.addresses?.full_address],
    );

    // ── Map init ───────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!riderLocation || !mapRef.current || !destination) return;
        if (!isMapboxAvailable() || !import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) return;
        if (mapInstance.current) return;

        let map: mapboxgl.Map;
        try {
            map = initializeMap(mapRef.current, riderLocation, 15);
        } catch (e) {
            console.warn('[DeliveryNav] Map init failed, retrying on clean container:', e);
            if (mapRef.current) mapRef.current.innerHTML = '';
            map = initializeMap(mapRef.current, riderLocation, 15);
        }

        mapInstance.current = map;
        map.on('load', async () => {
            await drawRoute(map, riderLocation, destination);
            
            // Add native geolocation control for live tracking
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);
            
            setMapReady(true);
        });

        return () => { 
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [riderLocation?.[0], riderLocation?.[1], destination]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Step 1: Rider arrived at customer location ────────────────────────────

    const handleLocationReached = useCallback(async () => {
        if (!id || !user?.id || !order) return;
        
        if (riderLocation && destination) {
            const distance = calculateDistance(
                { lng: riderLocation[0], lat: riderLocation[1] },
                { lng: destination[0], lat: destination[1] }
            );
            if (distance > 0.5) {
                const proceed = window.confirm('Warning: You appear to be far from the customer location. Are you sure you have arrived?');
                if (!proceed) return;
            }
        }
        
        setActionLoading(true);

        try {
            // Notify customer to have OTP ready
            await insertNotification({
                user_id:  order.user_id,
                type:     'rider_arrived',
                title:    isReturnFlow ? '🛵 Your pickup rider has arrived!' : '🛵 Your rider has arrived!',
                body:     isReturnFlow
                    ? `${riderName ?? 'Your rider'} is at your location. Please share your return pickup code.`
                    : `${riderName ?? 'Your rider'} is at your location. Please share your delivery code.`,
                order_id: id,
            });

            // Notify warehouse
            await notifyWarehouse(
                id,
                isReturnFlow ? 'rider_at_return_pickup' : 'rider_at_customer',
                isReturnFlow ? '📍 Rider at return pickup location' : '📍 Rider at customer location',
                isReturnFlow
                    ? `Rider is at the customer pickup address for return order #${id.slice(0, 8).toUpperCase()}`
                    : `Rider is at the delivery address for order #${id.slice(0, 8).toUpperCase()}`,
            );

            setStep('arrived');
            setOtpValue('');
            showToastRef.current(
                isReturnFlow
                    ? 'Customer notified. Ask for their return pickup code.'
                    : 'Customer notified! Ask for their 4-digit delivery code.',
                'success',
            );
        } catch (err) {
            console.error('[DeliveryNav] locationReached:', err);
            showToastRef.current('Failed to notify customer', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [id, user?.id, order, riderName, isReturnFlow]);

    // ── Step 2: Verify delivery OTP ───────────────────────────────────────────

    const handleVerifyDeliveryOtp = useCallback(async () => {
        if (!id || !user?.id || !order) return;
        if (otpValue.length !== 4) {
            showToastRef.current('Please enter the 4-digit code from the customer app', 'error');
            return;
        }

        setOtpVerifying(true);
        try {
            // Use the verify_order_otp RPC which validates + transitions to 'delivered'
            const { data, error } = await supabase.rpc('verify_order_otp', {
                p_order_id: id,
                p_otp_code: otpValue,
                p_otp_type: isReturnFlow ? 'return' : 'delivery',
                p_actor_id: user.id,
            });

            if (error) throw new Error(error.message);
            if (!(data as any)?.success) throw new Error((data as any)?.message ?? 'Incorrect code');

            // Notify customer of successful delivery
            await insertNotification({
                user_id:  order.user_id,
                type:     isReturnFlow ? 'return_collected' : 'order_delivered',
                title:    isReturnFlow ? '✅ Return collected!' : '✅ Order delivered!',
                body:     isReturnFlow
                    ? `${riderName ?? 'Your rider'} has collected your return and is heading back to the warehouse.`
                    : `Your order has been delivered by ${riderName ?? 'your rider'}. Enjoy your rental!`,
                order_id: id,
            });

            // Notify warehouse
            await notifyWarehouse(
                id,
                isReturnFlow ? 'return_collected' : 'order_delivered',
                isReturnFlow ? '✅ Return collected from customer' : '✅ Order delivered successfully',
                isReturnFlow
                    ? `Return order #${id.slice(0, 8).toUpperCase()} has been collected and is heading back to the warehouse.`
                    : `Order #${id.slice(0, 8).toUpperCase()} has been delivered to the customer.`,
            );

            showToastRef.current(
                isReturnFlow ? 'Return collected. Head back to the warehouse.' : 'Delivery confirmed! Great job.', 
                'success',
            );
            setStep('done');

            setTimeout(() => {
                navigateRef.current(isReturnFlow ? `/warehouse/${id}` : '/');
            }, 1_500);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to verify code';
            console.error('[DeliveryNav] verifyDeliveryOtp:', err);
            showToastRef.current(message, 'error');
        } finally {
            setOtpVerifying(false);
        }
    }, [id, user?.id, order, otpValue, riderName, isReturnFlow]);

    const handleCancelDelivery = useCallback(async () => {
        if (!id || !user?.id) return;
        const confirm = window.confirm('Are you sure you want to cancel this delivery? It will be reassigned to another rider.');
        if (!confirm) return;

        setIsCancelling(true);
        try {
            const result = await releaseOrder(id, user.id);
            if (!result.success) throw new Error(result.message);
            showToastRef.current('Delivery cancelled. You can now accept other orders.', 'success');
            navigateRef.current('/');
        } catch (err: any) {
            showToastRef.current(err.message || 'Failed to cancel delivery', 'error');
        } finally {
            setIsCancelling(false);
        }
    }, [id, user?.id]);

    // ── Render ─────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader size="lg" text="Loading delivery..." />
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {/* Map */}
            <div ref={mapRef} className="flex-1" />

            {/* Start Navigation overlay — shows if GPS permission is missing or loading */}
            {!riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 pb-32">
                    <div className="text-center space-y-4 px-6">
                        <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                            <MapPin size={28} className="text-zinc-500" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Location Access Needed</h2>
                        <p className="text-zinc-400 text-sm">Please allow GPS access to enable navigation</p>
                        <button
                            onClick={startNavigation}
                            className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200"
                        >
                            Enable Location
                        </button>
                    </div>
                </div>
            )}

            {/* Map loading overlay */}
            {!mapReady && riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                    <Loader size="lg" text="Loading navigation..." />
                </div>
            )}

            {/* Bottom panel */}
            <motion.div
                initial={{ y: 120 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-3xl border-t border-zinc-800 shadow-2xl z-20 px-5 pt-4 pb-8"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                </div>

                <div className="flex items-start gap-2 mb-5">
                    <MapPin size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-zinc-300">{deliveryAddress}</p>
                </div>

                {/* Step actions */}
                <AnimatePresence mode="wait">

                    {/* Step 1: navigating — "Arrived at Location" button (enabled once GPS acquired) */}
                    {step === 'navigating' && (
                        <motion.div
                            key="navigating"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <button
                                onClick={handleLocationReached}
                                disabled={actionLoading || !riderLocation}
                                className={primaryBtn('from-indigo-600 to-indigo-500')}
                            >
                                {actionLoading
                                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><MapPin size={18} /> {isReturnFlow ? 'Arrived for Return Pickup' : 'Arrived at Location'}</>
                                }
                            </button>
                            <button
                                onClick={handleCancelDelivery}
                                disabled={isCancelling || actionLoading}
                                className="w-full py-2 text-sm text-zinc-500 font-medium hover:text-red-400 transition-colors mt-2"
                            >
                                {isCancelling ? 'Cancelling...' : 'Cancel Delivery'}
                            </button>
                            {!riderLocation && (
                                <p className="text-center text-xs text-zinc-500 mt-2">
                                    Tap "Start Navigation" above to enable GPS first
                                </p>
                            )}
                        </motion.div>
                    )}

                    {/* Step 2: arrived — OTP input */}
                    {step === 'arrived' && (
                        <motion.div
                            key="otp"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                                <div className="flex items-center gap-2">
                                    <KeyRound size={16} className="text-indigo-400" />
                                    <p className="text-sm font-semibold text-white">
                                        {isReturnFlow ? "Enter Customer's Return Code" : "Enter Customer's Delivery Code"}
                                    </p>
                                </div>
                                <p className="text-xs text-zinc-400">
                                {isReturnFlow
                                    ? 'Ask the customer for the 4-digit return code shown on their tracking page.'
                                    : 'Ask the customer for the 4-digit code shown on their tracking page.'}
                                </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={4}
                                value={otpValue}
                                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                                placeholder="0000"
                                className="w-full text-center text-5xl font-mono font-bold tracking-[0.3em] bg-black border border-zinc-800 rounded-xl py-5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-800"
                            />
                                <button
                                    onClick={handleVerifyDeliveryOtp}
                                    disabled={otpValue.length !== 4 || otpVerifying}
                                    className={primaryBtn('from-indigo-600 to-indigo-500')}
                                >
                                    {otpVerifying
                                        ? <><Loader2 size={18} className="animate-spin" /> Verifying...</>
                                        : (isReturnFlow ? 'Verify & Collect Return' : 'Verify & Mark Delivered')
                                    }
                                </button>
                            </motion.div>
                    )}

                    {/* Step 3: done */}
                    {step === 'done' && (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-3 py-4"
                        >
                            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                <CheckCircle size={28} className="text-emerald-400" />
                            </div>
                            <p className="text-white font-semibold">
                                {isReturnFlow ? 'Return Collected!' : 'Delivery Complete!'}
                            </p>
                            <p className="text-zinc-400 text-sm">
                                {isReturnFlow ? 'Navigating back to the warehouse...' : 'Returning to dashboard...'}
                            </p>
                        </motion.div>
                    )}

                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default DeliveryNavigationPage;
