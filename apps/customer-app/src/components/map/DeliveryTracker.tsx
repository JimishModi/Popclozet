// src/components/map/DeliveryTracker.tsx
// Real-time delivery tracking
//
// Customer app fix: rider_id arrives after the order loads, so
// useRiderLocation(null) was firing and never re-subscribing.
// Fixed by watching order.rider_id in a separate useEffect that
// calls the hook imperatively when the value becomes available.

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock, MapPin, CheckCircle, Truck, KeyRound, Copy, CheckCheck } from 'lucide-react';
import { supabase } from '@popclozet/api-client';
import { getOrderById, DeliveryOrder } from '@/services/deliveryService';
import { getHubById, RentalHub } from '@/services/hubService';
import { useDriverSimulation } from '@/hooks/useDriverSimulation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { OrderStatus } from '@popclozet/domain-contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackingData {
    current_lat: number;
    current_lng: number;
    driver_name?: string;
    vehicle_number?: string;
    eta_minutes?: number;
}

interface DeliveryTrackerProps {
    orderId: string;
    className?: string;
    onOrderLoad?: (order: DeliveryOrder) => void;
    onTrackingUpdate?: (tracking: TrackingData) => void;
}

// Extend DeliveryOrder locally to include otp_delivery + rider_id
interface DeliveryOrderWithOtp extends DeliveryOrder {
    otp_delivery?: string | null;
    rider_id?: string | null;
}


// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
    { status: 'confirmed', label: 'Order Confirmed', icon: <CheckCircle className="w-4 h-4" /> },
    { status: 'packed', label: 'Preparing', icon: <Package className="w-4 h-4" /> },
    { status: 'ready_for_pickup', label: 'Ready for Pickup', icon: <Package className="w-4 h-4" /> },
    { status: 'driver_arrived_warehouse', label: 'Rider at Warehouse', icon: <Truck className="w-4 h-4" /> },
    { status: 'order_picked_up', label: 'Package Collected', icon: <Package className="w-4 h-4" /> },
    { status: 'out_for_delivery', label: 'On the Way', icon: <MapPin className="w-4 h-4" /> },
    { status: 'delivered', label: 'Delivered', icon: <CheckCircle className="w-4 h-4" /> },
];

function getLogicalStepIndex(status?: string): number {
    if (!status) return -1;
    switch (status.toLowerCase()) {
        case 'pending': case 'confirmed': case 'pending_payment': case 'placed': return 0;
        case 'preparing': case 'packed': return 1;
        case 'ready_for_pickup': return 2;
        case 'driver_arrived_warehouse': return 3;
        case 'order_picked_up': case 'dispatched': return 4;
        case 'out_for_delivery': return 5;
        case 'delivered': case 'completed': return 6;
        default: return -1;
    }
}

const TRANSIT_STATUSES = new Set(['dispatched', 'out_for_delivery', 'order_picked_up']);

const SIMULATED_DRIVER: Pick<TrackingData, 'driver_name' | 'vehicle_number' | 'eta_minutes'> = {
    driver_name: 'Ravi Kumar (Simulated)',
    vehicle_number: 'MH-02-AB-1234',
    eta_minutes: 15,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryTracker({
    orderId,
    className,
    onOrderLoad,
    onTrackingUpdate,
}: DeliveryTrackerProps) {
    const [order, setOrder] = useState<DeliveryOrderWithOtp | null>(null);
    const [hub, setHub] = useState<RentalHub | null>(null);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [otpCopied, setOtpCopied] = useState(false);

    const onOrderLoadRef = useRef(onOrderLoad);
    const onTrackingUpdateRef = useRef(onTrackingUpdate);
    useEffect(() => { onOrderLoadRef.current = onOrderLoad; }, [onOrderLoad]);
    useEffect(() => { onTrackingUpdateRef.current = onTrackingUpdate; }, [onTrackingUpdate]);

    // ── Fetch order + hub ────────────────────────────────────────────────────

    const fetchOrder = useCallback(async (signal: AbortSignal) => {
        setError(null);
        try {
            // Fetch order including otp_delivery field
            const { data: raw, error: fetchErr } = await supabase
                .from('orders')
                .select('*, otp_delivery')
                .eq('id', orderId)
                .single();

            if (fetchErr) throw fetchErr;
            if (signal.aborted) return;

            // If status is out_for_delivery but no OTP exists, generate one
            if (raw && ['out_for_delivery', 'dispatched'].includes(raw.status) && !raw.otp_delivery) {
                const otp = String(Math.floor(1000 + Math.random() * 9000));
                await supabase.from('orders').update({ otp_delivery: otp }).eq('id', raw.id);
                raw.otp_delivery = otp;
            }

            const orderData = raw as unknown as DeliveryOrderWithOtp;
            if (signal.aborted) return;

            setOrder(orderData);
            if (orderData) onOrderLoadRef.current?.(orderData as DeliveryOrder);

            if (orderData?.hub_id) {
                const hubData = await getHubById(orderData.hub_id);
                if (!signal.aborted) setHub(hubData);
            }
        } catch (err) {
            if (!signal.aborted) {
                setError('Failed to load order. Please try again.');
                console.error('[DeliveryTracker] fetchOrder error:', err);
            }
        }
    }, [orderId]);

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        fetchOrder(controller.signal).finally(() => {
            if (!controller.signal.aborted) setIsLoading(false);
        });

        const orderChannel: RealtimeChannel = supabase
            .channel(`order_status:${orderId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
                (payload) => {
                    const newOrder = payload.new as DeliveryOrderWithOtp;
                    setOrder(newOrder);
                    onOrderLoadRef.current?.(newOrder as DeliveryOrder);
                },
            )
            .subscribe();

        return () => {
            controller.abort();
            supabase.removeChannel(orderChannel);
        };
    }, [orderId, fetchOrder]);

    // ── Bug fix: subscribe to rider location when rider_id becomes available ──
    //
    // The original called useRiderLocation(order?.rider_id) but hooks can't
    // be called conditionally and the hook didn't re-subscribe when rider_id
    // changed from null → a UUID. We use a manual subscription here instead.

    useEffect(() => {
        const riderId = order?.rider_id;
        if (!riderId) return;

        // Initial fetch
        supabase
            .from('rider_locations')
            .select('*')
            .eq('rider_id', riderId)
            .maybeSingle()
            .then(({ data }) => {
                if (!data) return;
                const next: TrackingData = {
                    current_lat: data.lat,
                    current_lng: data.lng,
                };
                setTracking(next);
                onTrackingUpdateRef.current?.(next);
            });

        // Real-time subscription
        const channel = supabase
            .channel(`rider_location:${riderId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rider_locations',
                filter: `rider_id=eq.${riderId}`,
            }, (payload) => {
                const data = payload.new as any;
                const next: TrackingData = {
                    current_lat: data.lat,
                    current_lng: data.lng,
                };
                setTracking(next);
                onTrackingUpdateRef.current?.(next);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [order?.rider_id]);

    // ── Derived values ────────────────────────────────────────────────────────

    const currentStepIndex = useMemo(() => getLogicalStepIndex(order?.status), [order?.status]);

    const userLocation = useMemo(() => {
        const snap = order?.delivery_address_snapshot;
        return snap ? { lat: snap.lat, lng: snap.lng } : null;
    }, [order?.delivery_address_snapshot]);

    const hubLocation = useMemo(
        () => (hub ? { lat: hub.lat, lng: hub.lng } : null), [hub],
    );

    const { routeOrigin, routeDestination } = useMemo(() => {
        const isDelivery = order?.order_type === 'delivery';
        return {
            routeOrigin: isDelivery ? hubLocation : userLocation,
            routeDestination: isDelivery ? userLocation : hubLocation,
        };
    }, [order?.order_type, hubLocation, userLocation]);

    const isTransitStatus = useMemo(
        () => TRANSIT_STATUSES.has(order?.status ?? ''), [order?.status],
    );

    const shouldSimulate = useMemo(
        () => !tracking && !!order && !!hub && !!routeOrigin && !!routeDestination,
        [tracking, order, hub, routeOrigin, routeDestination],
    );

    // ── Simulation fallback ───────────────────────────────────────────────────

    const { vehicleLocation: simulatedVehicle } = useDriverSimulation({
        origin: routeOrigin,
        destination: routeDestination,
        isActive: shouldSimulate && isTransitStatus,
    });

    useEffect(() => {
        if (!shouldSimulate || !isTransitStatus || !simulatedVehicle) return;

        const simTracking: TrackingData = {
            current_lat: simulatedVehicle.lat,
            current_lng: simulatedVehicle.lng,
            ...SIMULATED_DRIVER,
        };
        onTrackingUpdateRef.current?.(simTracking);
        // Note: we intentionally don't call setTracking here — simulated data
        // must never overwrite a real tracking record that arrives later.
    }, [simulatedVehicle, shouldSimulate, isTransitStatus]);

    // ── Copy OTP ──────────────────────────────────────────────────────────────

    const handleCopyOtp = useCallback(async () => {
        if (!order?.otp_delivery) return;
        try {
            await navigator.clipboard.writeText(order.otp_delivery);
            setOtpCopied(true);
            setTimeout(() => setOtpCopied(false), 2_000);
        } catch {
            // clipboard unavailable — OTP is already visible on screen
        }
    }, [order?.otp_delivery]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 space-y-3">
                <p className="text-zinc-400">{error}</p>
                <button
                    onClick={() => {
                        const controller = new AbortController();
                        setIsLoading(true);
                        fetchOrder(controller.signal).finally(() => setIsLoading(false));
                    }}
                    className="text-sm text-[#ff4d6d] hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!order) {
        return <div className="text-center py-8"><p className="text-zinc-400">Order not found</p></div>;
    }

    const progressPct = currentStepIndex < 0
        ? 0
        : (currentStepIndex / (STATUS_STEPS.length - 1)) * 100;

    // Show OTP card when rider is out for delivery or has arrived at customer
    const showOtpCard = !!(order?.otp_delivery) && [
        'out_for_delivery', 'dispatched', 'order_picked_up',
    ].includes(order?.status ?? '');

    return (
        <div className={className}>
            {/* ── Finding Rider State ── */}
            {order.status === 'ready_for_pickup' && !order.rider_id && (
                <div className="mb-5 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 overflow-hidden relative">
                    <motion.div
                        className="absolute inset-0 bg-blue-500/10 pointer-events-none"
                        animate={{ opacity: [0.1, 0.4, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                <Truck size={20} className="text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-white flex items-center gap-1">
                                    Finding a Rider
                                    <span className="flex">
                                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}>.</motion.span>
                                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                                    </span>
                                </h4>
                                <p className="text-xs text-blue-200/80 mt-0.5">Broadcasting your order to nearby riders...</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delivery OTP card ── */}
            {showOtpCard && (
                <div className="mb-5 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <KeyRound size={16} className="text-indigo-400" />
                            <div>
                                <p className="text-xs font-semibold text-indigo-300">Your Delivery Code</p>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Show this to the rider when they arrive
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-mono font-bold tracking-[0.2em] text-white">
                                {order.otp_delivery}
                            </span>
                            <button
                                onClick={handleCopyOtp}
                                className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
                                title="Copy code"
                            >
                                {otpCopied
                                    ? <CheckCheck size={14} className="text-emerald-400" />
                                    : <Copy size={14} />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Status timeline ── */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-zinc-400">Order Status</h3>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/30">
                        #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                </div>

                <div className="relative">
                    <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-zinc-800" />
                    <motion.div
                        className="absolute left-[18px] top-6 w-0.5 bg-[#ff4d6d]"
                        style={{ originY: 0 }}
                        initial={{ height: 0 }}
                        animate={{ height: `${progressPct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />

                    <div className="space-y-6">
                        {STATUS_STEPS.map((step, index) => {
                            const isActive = index <= currentStepIndex;
                            const isCurrent = index === currentStepIndex;
                            return (
                                <div key={step.status} className="flex items-center gap-4">
                                    <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-[#ff4d6d] text-white' : 'bg-zinc-800 text-zinc-500'
                                        }`}>
                                        {step.icon}
                                        {isCurrent && (
                                            <span className="absolute inset-0 rounded-full bg-[#ff4d6d] animate-ping opacity-25" />
                                        )}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                                            {step.label}
                                        </p>
                                        {isCurrent && order.estimated_delivery_at && (
                                            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                                                <Clock className="w-3 h-3" />
                                                ETA: {new Date(order.estimated_delivery_at).toLocaleTimeString([], {
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Delivery address ── */}
            {order.delivery_address_snapshot && (
                <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-[#ff4d6d] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-white">Delivery Address</p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                {order.delivery_address_snapshot.full_address}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DeliveryTracker;
