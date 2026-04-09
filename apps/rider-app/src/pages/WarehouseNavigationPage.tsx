import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
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
    subscribeToOrderUpdates,
    PREDEFINED_MESSAGES,
} from '@/services/riderOrderService';
import {
    MapPin, Navigation, Package, CheckCircle,
    MessageCircle, Truck, ChevronRight, X, KeyRound, Loader2, ScanLine,
} from 'lucide-react';
import { QRScannerOverlay } from '@/components/QRScannerOverlay';

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
    order_items?: Array<{ id: string; product_id: string; size?: string; rental_price?: number; products?: { name: string; images: string[] } }>;
}

async function insertNotification(payload: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    order_id: string;
}) {
    return supabase.from('notifications').insert({
        ...payload,
        is_read: false,
    });
}
// ─── Component ────────────────────────────────────────────────────────────────

export const WarehouseNavigationPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    const { location: globalLocation } = useLocation();
    const navigate = useNavigate();

    const [order, setOrder] = useState<WarehouseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
    const [step, setStep] = useState<PickupStep>('navigating');
    const [actionLoading, setActionLoading] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpVerifying, setOtpVerifying] = useState(false);

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
    const [showQRScanner, setShowQRScanner] = useState(false);

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

    const currentStepCfg = useMemo(() => {
        if (!isReturnFlow) return STEP_CONFIG[step];
        switch (step) {
            case 'navigating':
                return {
                    badge: 'Return Drop-off',
                    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
                    icon: Truck,
                };
            case 'arrived':
                return {
                    badge: 'At Warehouse',
                    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    icon: MapPin,
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

    // ── Navigation Stats ─────────────────────────────────────────────────────────

    const distanceToWarehouse = useMemo(() => {
        if (!globalLocation) return null;
        return haversineMetres(
            { lat: globalLocation.latitude, lng: globalLocation.longitude },
            { lat: WAREHOUSE_LOCATION[1], lng: WAREHOUSE_LOCATION[0] }
        );
    }, [globalLocation]);

    const etaMinutes = useMemo(() => {
        if (!distanceToWarehouse) return null;
        return Math.max(1, Math.round((distanceToWarehouse / 1000) * 3));
    }, [distanceToWarehouse]);

    // ── Fetch order ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const fetch = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, status, user_id, total_amount, warehouse_otp, addresses:delivery_address_id(full_address, latitude, longitude), order_items(*, products(name, images))')
                    .eq('id', id)
                    .single();
                if (error || !data) throw error ?? new Error('Order not found');
                if (cancelled) return;
                setOrder(data as unknown as WarehouseOrder);
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

    useEffect(() => {
        if (!id) return;
        const unsub = subscribeToOrderUpdates(id, (status) => {
            setOrder(prev => prev ? { ...prev, status } : prev);
            if (['returned', 'return_completed'].includes(status)) {
                showToastRef.current('Return processed by warehouse!', 'success');
                navigateRef.current('/');
            }
        });
        return () => { void unsub(); };
    }, [id]);

    useEffect(() => {
        if (globalLocation) {
            const coords: [number, number] = [globalLocation.longitude, globalLocation.latitude];
            setRiderLocation(coords);
        }
    }, [globalLocation]);

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

    const handleOpenGoogleMaps = useCallback(() => {
        // Use precise coordinates (lat,lng) — more reliable than text address
        const destination = `${WAREHOUSE_LOCATION[1]},${WAREHOUSE_LOCATION[0]}`;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

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

        if (distanceToWarehouse && distanceToWarehouse > 200) {
            const proceed = window.confirm(`You are ${(distanceToWarehouse/1000).toFixed(2)}km away. Proceed only if at Hostel 2.`);
            if (!proceed) return;
        }

        if (isReturnFlow) {
            // Advance to 'arrived' first — OTP is generated only when rider confirms drop-off
            setStep('arrived');
            return;
        }

        setOtpValue('');
        setShowOtpModal(true);
    }, [id, user?.id, distanceToWarehouse, isReturnFlow]);

    const handleVerifyOtp = useCallback(async () => {
        if (!id || !user?.id) return;
        if (otpValue.length !== 6) { showToast('Please enter a 6-digit PIN', 'error'); return; }

        setOtpVerifying(true);
        console.log(`[handleVerifyOtp] Verifying PIN for order ${id} with PIN ${otpValue} by rider ${user.id}`);
        try {
            const result = await verifyWarehouseOtp(id, otpValue, user.id);
            console.log(`[handleVerifyOtp] Result:`, result);

            if (!result || !result.success) {
                const errMsg = result?.message || 'Failed to verify PIN (Unknown error)';
                throw new Error(errMsg);
            }

            showToast('Arrival verified! Now confirm the pickup.', 'success');
            setStep('arrived');
            setOrder(prev => prev ? { ...prev, status: 'driver_arrived_warehouse' } : prev);
            setShowOtpModal(false);
        } catch (err: any) {
            console.error(`[handleVerifyOtp] Error:`, err);
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
        `w-full py-4 rounded-2xl bg-gradient-to-r ${gradient} text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl`;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader size="lg" text="Entering Warehouse Flow..." />
            </div>
        );
    }
    if (!order) return null;

    return (
        <div className="fixed inset-0 bg-[#080808] flex flex-col font-sans">
            <div className="flex-1 overflow-y-auto px-6 pt-12 pb-48 space-y-8">

                {/* Header & Status */}
                <div className="flex items-center justify-between">
                    <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{currentStepCfg.badge}</span>
                    </motion.div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-zinc-600 tracking-wider">ORD #{order.id.slice(0, 8).toUpperCase()}</span>
                        <button
                            onClick={() => setShowQRScanner(true)}
                            className="w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
                            aria-label="Scan QR Code"
                        >
                            <ScanLine size={15} className="text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Navigation Stats */}
                <section className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 blur-3xl opacity-50" />
                    <div className="relative grid grid-cols-2 gap-4">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md">
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">To Warehouse</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">{distanceToWarehouse ? (distanceToWarehouse / 1000).toFixed(1) : '--'}</span>
                                <span className="text-xs font-bold text-zinc-500">KM</span>
                            </div>
                        </motion.div>
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md">
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Est. Arrival</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">{etaMinutes ?? '--'}</span>
                                <span className="text-xs font-bold text-zinc-500">MINS</span>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Progress Visual */}
                <section className="space-y-4 px-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <span>You</span>
                        <span>Warehouse</span>
                    </div>
                    <div className="relative h-12 flex items-center">
                        <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ transformOrigin: 'left' }} className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                        </div>
                        <div className="absolute left-0 w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
                            <Navigation size={14} className="text-blue-400 rotate-45" />
                        </div>
                        <div className="absolute right-0 w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-2xl">
                            <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping absolute opacity-50" />
                            <MapPin size={18} className="text-blue-500 relative" />
                        </div>
                    </div>
                </section>

                {/* Warehouse Location Card */}
                <section className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-8 space-y-4">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <MapPin size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Pickup Point</h3>
                            <p className="text-lg font-bold text-white leading-tight">Popclozet Warehouse</p>
                        </div>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed bg-black/30 p-4 rounded-2xl border border-white/5">{WAREHOUSE_ADDRESS}</p>
                    <button onClick={handleOpenGoogleMaps} className="w-full py-4 bg-zinc-800/50 hover:bg-zinc-800 border border-white/10 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
                        <Navigation size={18} fill="currentColor" />
                        Navigate in Google Maps
                    </button>
                </section>

                {/* Items to Pickup */}
                <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">Package Contents</h3>
                    <div className="grid gap-3">
                        {order.order_items?.map((item: any, idx: number) => (
                            <motion.div key={item.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-white/5">
                                    {item.products?.images?.[0] ? <img src={item.products.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-full h-full p-3 text-zinc-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{item.products?.name || 'Unknown Item'}</p>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Size: {item.size || 'One Size'}</p>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-tighter">1x</div>
                            </motion.div>
                        ))}
                    </div>
                </section>

            </div>

            {/* Bottom Actions */}
            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent pt-12">
                <AnimatePresence mode="wait">
                    {step === 'navigating' && isReturnFlow && (
                        <motion.div key="navigating-return" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <button onClick={handleConfirmArrival} disabled={actionLoading} className={primaryBtn('from-indigo-600 to-indigo-500 shadow-indigo-500/20')}>
                                {actionLoading ? <ActionSpinner /> : <><MapPin size={18} /> I've Arrived at Warehouse</>}
                            </button>
                        </motion.div>
                    )}
                    {step === 'arrived' && isReturnFlow && (
                        <motion.div key="arrived-return" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <button onClick={handleDropOffReturn} disabled={actionLoading} className={primaryBtn('from-emerald-600 to-emerald-500 shadow-emerald-500/20')}>
                                {actionLoading ? <ActionSpinner /> : <><CheckCircle size={18} /> Confirm Drop-off &amp; Get OTP</>}
                            </button>
                        </motion.div>
                    )}
                    {step === 'navigating' && !isReturnFlow && (
                        <motion.div key="navigating" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                            <button onClick={handleConfirmArrival} disabled={actionLoading || isCancelling} className={primaryBtn('from-blue-600 to-blue-500 shadow-blue-500/20')}>
                                {actionLoading ? <ActionSpinner /> : <><CheckCircle size={18} /> I've Arrived</>}
                            </button>
                            <button onClick={handleCancelDelivery} disabled={isCancelling || actionLoading} className="w-full py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-red-400 transition-colors">
                                {isCancelling ? 'Resigning...' : 'Resign from Order'}
                            </button>
                        </motion.div>
                    )}
                    {step === 'arrived' && !isReturnFlow && (
                        <motion.div key="arrived" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            <button onClick={handleConfirmPickup} disabled={actionLoading} className={primaryBtn('from-emerald-600 to-emerald-500 shadow-emerald-500/20')}>
                                {actionLoading ? <ActionSpinner /> : <><Package size={18} /> Confirm Pickup</>}
                            </button>
                        </motion.div>
                    )}
                    {step === 'picked_up' && !isReturnFlow && (
                        <motion.div key="head-to-cust" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                            <button onClick={handleStartNavigation} disabled={actionLoading} className={primaryBtn('from-blue-600 to-indigo-700 shadow-blue-600/30')}>
                                {actionLoading ? <ActionSpinner /> : <><Navigation size={18} /> Start Delivery</>}
                            </button>
                            <button onClick={() => setShowMessageModal(true)} disabled={messageSent} className="w-full py-3 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400 bg-zinc-900/50 flex items-center justify-center gap-2">
                                <MessageCircle size={16} />
                                {messageSent ? 'Message Sent' : 'Update Customer'}
                            </button>
                        </motion.div>
                    )}
                    {step === 'picked_up' && isReturnFlow && (
                        <motion.div key="return-otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                            {(returnOtp ?? order?.warehouse_otp) ? (
                                <div className="rounded-[2rem] border border-blue-500/20 bg-blue-500/10 p-6 text-center backdrop-blur-xl">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Verification Code</p>
                                    <div className="text-5xl font-mono font-black text-white tracking-[0.2em] mb-2">{returnOtp ?? order?.warehouse_otp}</div>
                                    <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400">
                                        <Loader2 size={14} className="animate-spin text-blue-400" />
                                        <p className="text-[10px] uppercase font-bold">Waiting for warehouse validation...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
                                    <p className="text-white font-bold">Drop-off Recorded</p>
                                    <p className="text-emerald-500/60 text-xs mt-1">Waiting for warehouse validation</p>
                                </div>
                            )}
                            <button onClick={() => navigate('/')} className="w-full py-4 rounded-2xl bg-zinc-900 border border-white/5 text-white font-bold text-sm">Return to Dashboard</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* OTP Modal */}
            <AnimatePresence>
                {showOtpModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-zinc-900 border border-white/5 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-8 space-y-6 text-center">
                                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Security Pin</p>
                                <p className="text-sm text-zinc-400 leading-relaxed px-4">Ask warehouse staff for the 6-digit Arrival PIN</p>
                                <input type="text" inputMode="numeric" pattern="\d*" maxLength={6} value={otpValue} onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))} autoFocus placeholder="000000" className="w-full text-center text-4xl font-mono font-black tracking-[0.2em] bg-black border border-white/5 rounded-2xl py-6 text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-800" />
                                <button onClick={handleVerifyOtp} disabled={otpValue.length !== 6 || otpVerifying} className={primaryBtn('from-blue-600 to-blue-500')}>
                                    {otpVerifying ? <ActionSpinner /> : 'Verify & Enter'}
                                </button>
                                <button onClick={() => setShowOtpModal(false)} className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Cancel</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

             {/* Message Modal */}
             <AnimatePresence>
                {showMessageModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-zinc-900 border border-white/5 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-6">
                            <h3 className="font-black text-zinc-500 uppercase tracking-widest text-[10px] mb-6 px-2">Update Customer</h3>
                            <div className="space-y-3">
                                {PREDEFINED_MESSAGES.map((msg, i) => (
                                    <button key={i} onClick={() => handleSendMessage(msg)} disabled={actionLoading}
                                        className="w-full text-left p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-sm text-zinc-300 disabled:opacity-50">
                                        "{msg}"
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setShowMessageModal(false)} className="w-full mt-6 py-2 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Close</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QR Scanner */}
            {showQRScanner && <QRScannerOverlay onClose={() => setShowQRScanner(false)} />}
        </div>
    );
};

export default WarehouseNavigationPage;
