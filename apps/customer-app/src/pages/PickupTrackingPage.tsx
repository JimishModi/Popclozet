import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { thumbImage } from "@/lib/optimizeImage";
import {
    ChevronLeft, Package, Phone,
    MapPin, KeyRound, Truck, Clock,
    Loader2, 
    Zap, RefreshCw, CheckCircle, Home
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { getOrderById, requestImmediateReturn } from "@/services/ordersService";
import { toast } from "sonner";
import { supabase } from "@popclozet/api-client";
import { notifyOrderStatusChange } from "@/services/notificationService";
import { InstantBuyDrawer } from "@/components/returns/InstantBuyDrawer";
import {
    subscribeToRiderProximity,
    checkDeliveryProximity,
    distanceKm,
    type ProximityStatus,
} from "@/services/geofenceSubscription";


const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const CUSTOMER_STATUS_STEPS = [
    { key: 'return_requested',    label: 'Return Requested',     desc: 'Awaiting warehouse approval', Icon: Clock },
    { key: 'return_scheduled',    label: 'Return Approved',      desc: 'Finding a rider for pickup',  Icon: CheckCircle },
    { key: 'return_dispatched',   label: 'Rider On the Way',     desc: 'Rider heading to your location', Icon: Truck },
    { key: 'return_picked_up',    label: 'Items Picked Up',      desc: 'Rider collected your items',  Icon: Package },
];

const STATUS_LABEL: Record<string, string> = {
    return_requested:    'Pending Approval',
    return_scheduled:    'Finding Rider',
    return_dispatched:   'Rider On the Way',
    return_picked_up:    'Items Collected',
    return_at_warehouse: 'At Warehouse',
    returned:            'Return Complete',
    return_completed:    'Return Complete',
};

function getCustomerTimelineIndex(status?: string | null): number {
    switch (status) {
        case 'return_requested':
            return 0;
        case 'return_scheduled':
            return 1;
        case 'return_dispatched':
            return 2;
        case 'return_picked_up':
        case 'return_at_warehouse':
        case 'returned':
        case 'return_completed':
            return 3;
        default:
            return -1;
    }
}

export default function PickupTrackingPage() {
    const { pickupId } = useParams<{ pickupId: string }>();
    const navigate = useNavigate();

    const [order,           setOrder]          = useState<any>(null);
    const [items,           setItems]          = useState<any[]>([]);
    const [riderProfile,    setRiderProfile]   = useState<{ name: string; phone: string } | null>(null);
    const [loading,         setLoading]        = useState(true);
    const [showInstantBuy,  setShowInstantBuy] = useState(false);
    const [riderProximity,  setRiderProximity] = useState<ProximityStatus>('far');
    const [riderDistanceKm, setRiderDistanceKm] = useState<number | null>(null);
    const [riderLocation,   setRiderLocation]   = useState<{ lat: number; lng: number } | null>(null);

    const [instantReturnLoading, setInstantReturnLoading] = useState(false);
    const [showInstantReturnConfirm, setShowInstantReturnConfirm] = useState(false);
    const [findingDrivers, setFindingDrivers] = useState(false);
    const [noRidersAvailable, setNoRidersAvailable] = useState(false);
    const [warehouseNotified, setWarehouseNotified] = useState(false);

    const previousStatusRef = useRef<string | null>(null);
    const geofenceCleanupRef = useRef<(() => void) | null>(null);

    // Initial fetch + realtime subscription
    useEffect(() => {
        if (!pickupId) return;

        const fetchAll = async () => {
            try {
                const [orderData, itemsRes] = await Promise.all([
                    getOrderById(pickupId),
                    supabase
                        .from('order_items')
                        .select('*, products(*)')
                        .eq('order_id', pickupId),
                ]);

                setOrder(orderData);
                previousStatusRef.current = orderData?.status ?? null;
                if (itemsRes.data) setItems(itemsRes.data);

                if (orderData?.rider_id) {
                    const { data: rp } = await supabase
                        .from('rider_profiles')
                        .select('full_name, phone')
                        .eq('user_id', orderData.rider_id)
                        .single();
                    if (rp) setRiderProfile({ name: rp.full_name || 'Your Rider', phone: rp.phone || '' });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();

        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(`pickup_tracking:${pickupId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${pickupId}`,
                }, async () => {
                    const updated = await getOrderById(pickupId);
                    if (updated) {
                        if (previousStatusRef.current && updated.status !== previousStatusRef.current) {
                            notifyOrderStatusChange(updated.user_id, pickupId, updated.status!).catch(console.warn);
                        }
                        previousStatusRef.current = updated.status ?? null;
                        setOrder(updated);
                    }
                })
                .subscribe((status, err) => {
                    if (err) console.warn('[PickupTrackingPage] Realtime subscription error:', err);
                });
        } catch (err) {
            console.warn('[PickupTrackingPage] Failed to subscribe to realtime:', err);
        }

        return () => { if (channel) supabase.removeChannel(channel); };
    }, [pickupId]);

    // Fetch rider profile
    useEffect(() => {
        if (!order?.rider_id || riderProfile) return;
        supabase
            .from('rider_profiles')
            .select('full_name, phone')
            .eq('user_id', order.rider_id)
            .single()
            .then(({ data }) => {
                if (data) setRiderProfile({ name: data.full_name || 'Your Rider', phone: data.phone || '' });
            });
    }, [order?.rider_id]);

    // Geofence subscription
    useEffect(() => {
        if (geofenceCleanupRef.current) {
            geofenceCleanupRef.current();
            geofenceCleanupRef.current = null;
        }

        if (!order?.rider_id) return;
        if (!['return_dispatched'].includes(order?.status ?? '')) return;

        const destLat = order?.delivery_address?.latitude ?? null;
        const destLng = order?.delivery_address?.longitude ?? null;
        if (destLat == null || destLng == null) return;

        const cleanup = subscribeToRiderProximity(
            order.rider_id,
            destLat,
            destLng,
            {
                onProximityChange: (status: ProximityStatus, distKm: number) => {
                    setRiderProximity(status);
                    setRiderDistanceKm(distKm);
                },
                onLocationUpdate: (lat: number, lng: number) => {
                    setRiderLocation({ lat, lng });
                },
            }
        );

        geofenceCleanupRef.current = cleanup;

        supabase
            .from('rider_locations')
            .select('lat, lng')
            .eq('rider_id', order.rider_id)
            .maybeSingle()
            .then(({ data }) => {
                if (!data) return;
                setRiderLocation({ lat: data.lat, lng: data.lng });
                const dist = distanceKm(data.lat, data.lng, destLat, destLng);
                const status = checkDeliveryProximity(data.lat, data.lng, destLat, destLng);
                setRiderDistanceKm(dist);
                setRiderProximity(status);
            });

        return () => {
            if (geofenceCleanupRef.current) {
                geofenceCleanupRef.current();
                geofenceCleanupRef.current = null;
            }
        };
    }, [order?.rider_id, order?.status, order?.delivery_address]);

    const handleNotifyWarehouse = async () => {
        if (!pickupId) return;
        try {
            await supabase.rpc('notify_order_to_available_riders', { p_order_id: pickupId });
            await supabase.from('warehouse_activity_log').insert({
                action: 'rider_assignment_requested',
                entity_type: 'order',
                entity_id: pickupId,
                actor_id: order?.user_id ?? null,
                details: {
                    reason: 'no_riders_available',
                    customer_requested: true,
                    order_status: order?.status,
                },
            });
            setWarehouseNotified(true);
            toast.success('Request sent! Warehouse will assign a rider shortly.');
        } catch (err: any) {
            console.error('Notify warehouse error:', err);
            toast.error('Failed to send request');
        }
    };

    const handleInstantReturn = async () => {
        if (!pickupId) return;
        const status = order?.status;
        if (status !== 'delivered' && status !== 'in_use') return;

        try {
            setInstantReturnLoading(true);
            await requestImmediateReturn(pickupId, order?.delivery_address?.id ?? null);
            toast.success('Finding a rider for your return...');
        } catch (err: any) {
            console.error('Instant return error:', err);
            toast.error(err?.message || 'Failed to request instant return');
        } finally {
            setInstantReturnLoading(false);
        }
    };

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white" hideBottomNav>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                </div>
            </MobileShell>
        );
    }

    const currentStatusIdx = getCustomerTimelineIndex(order?.status);
    const showOtp = !!order?.otp_return && ['return_dispatched', 'return_picked_up', 'return_at_warehouse', 'returned', 'return_completed'].includes(order?.status ?? '');
    const isPreReturn = ['delivered', 'in_use'].includes(order?.status ?? '');
    const isPendingApproval = order?.status === 'return_requested';
    const needsRiderAssignment = order?.status === 'return_scheduled' && !order?.rider_id;

    const statusLabel = isPreReturn
        ? 'Ready to Return'
        : isPendingApproval
            ? 'Waiting for Approval'
            : needsRiderAssignment
                ? 'Finding Rider'
                : STATUS_LABEL[order?.status] ?? 'Return in Progress';

    const pickupAddress = order?.delivery_address?.full_address ?? '—';
    const returnDate    = order?.return_pickup_date ?? null;
    const returnSlot    = order?.return_time_slot ?? null;

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            <header className="sticky top-0 z-50 bg-[#111111]/90 backdrop-blur-lg px-5 py-4 border-b border-white/5 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 transition-all active:scale-95"
                >
                    <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white tracking-tight" style={dmSans}>Return Pickup</h1>
                    <p className="text-xs text-zinc-500 mt-0.5">#{(pickupId ?? '').slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-[#f2546d]/10 border border-[#f2546d]/20">
                    <span className="text-[#f2546d] text-[10px] font-black uppercase tracking-widest">{statusLabel}</span>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
                {needsRiderAssignment && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-5 mt-6 mb-6 p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 to-amber-900/10 border border-amber-500/25 shadow-xl"
                    >
                        {noRidersAvailable ? (
                            warehouseNotified ? (
                                <div className="flex flex-col items-center py-4">
                                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mb-4">
                                        <Clock className="w-7 h-7 text-emerald-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1" style={dmSans}>Request Sent!</h3>
                                    <p className="text-xs text-zinc-400 text-center mb-4">Our warehouse team has been notified.</p>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-lg font-bold text-white" style={dmSans}>No Riders Available</h3>
                                    <button
                                        onClick={handleNotifyWarehouse}
                                        className="w-full h-14 mt-4 rounded-2xl bg-amber-500 text-white font-bold"
                                    >
                                        Request Rider from Warehouse
                                    </button>
                                </>
                            )
                        ) : (
                            <div className="flex flex-col items-center py-4">
                                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-white" style={dmSans}>Finding Drivers...</h3>
                            </div>
                        )}
                    </motion.section>
                )}

                <section className="px-5 pt-6 pb-2">
                    {CUSTOMER_STATUS_STEPS.map((step, idx) => {
                        const isDone = currentStatusIdx >= idx && currentStatusIdx !== -1;
                        const isCurrent = currentStatusIdx === idx;
                        const { Icon } = step;
                        return (
                            <div key={step.key} className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                                        isDone ? 'bg-[#f2546d] border-[#f2546d] text-white' : 'bg-[#1a1a1a] border-zinc-700 text-zinc-600'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    {idx < CUSTOMER_STATUS_STEPS.length - 1 && (
                                        <div className={`w-0.5 h-6 mt-1 ${currentStatusIdx > idx ? 'bg-[#f2546d]' : 'bg-zinc-800'}`} />
                                    )}
                                </div>
                                <div className="pt-1.5 pb-6">
                                    <p className={`text-sm font-bold ${isDone ? 'text-white' : 'text-zinc-600'}`} style={dmSans}>{step.label}</p>
                                    {isCurrent && <p className="text-xs text-[#f2546d] mt-0.5 font-medium">{step.desc}</p>}
                                </div>
                            </div>
                        );
                    })}
                </section>

                {isPreReturn && (
                    <div className="mx-5 mb-6 flex justify-end">
                        <button
                            onClick={() => setShowInstantReturnConfirm(true)}
                            disabled={instantReturnLoading}
                            className="px-4 py-2.5 rounded-xl bg-[#f2546d]/10 border border-[#f2546d]/30 flex items-center gap-2 active:scale-95 transition-all text-[#f2546d]"
                        >
                            {instantReturnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            <span className="text-xs font-bold" style={dmSans}>{instantReturnLoading ? "Requesting..." : "Instant Return"}</span>
                        </button>
                    </div>
                )}

                {showOtp && (
                    <motion.section
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-5 mb-6 p-5 rounded-3xl bg-zinc-900 border border-[#f2546d]/30"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <KeyRound className="w-4 h-4 text-[#f2546d]" />
                            <span className="text-xs font-black text-[#f2546d] uppercase tracking-[0.2em]">Return Pickup OTP</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {(order.otp_return as string).split('').map((digit: string, i: number) => (
                                <div key={i} className="flex-1 aspect-square rounded-2xl bg-white/10 border border-[#f2546d]/30 text-white text-2xl font-black flex items-center justify-center">
                                    {digit}
                                </div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {items.length > 0 && (
                    <section className="mx-5 mb-6">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Items to Return</h3>
                        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-4 items-center p-4 border-b border-zinc-800 last:border-0">
                                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 overflow-hidden border border-white/5">
                                        {item.products?.images?.[0] && (
                                            <img src={thumbImage(item.products.images[0])} alt={item.products.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-white truncate uppercase tracking-tight" style={dmSans}>{item.products?.name}</p>
                                        <p className="text-xs text-zinc-500 font-bold">Size: {item.size}</p>
                                    </div>
                                    <p className="text-sm font-black text-white">₹{item.rental_price}</p>
                                </div>
                            ))}
                        </div>

                        {isPreReturn && !instantReturnLoading && (
                            <div className="mt-4">
                                <button
                                    onClick={() => setShowInstantBuy(true)}
                                    className="w-full py-3.5 rounded-2xl bg-[#f2546d]/10 border border-[#f2546d]/20 text-[#f2546d] font-bold text-sm tracking-tight active:scale-95 transition-all"
                                    style={dmSans}
                                >
                                    Instant Buy & Keep Items
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {riderProfile && (
                    <section className="mx-5 mb-6 p-5 rounded-3xl bg-zinc-900 border border-zinc-800">
                        <div className="flex items-center gap-4">
                            <Truck className="w-6 h-6 text-[#f2546d]" />
                            <div className="flex-1">
                                <p className="text-base font-bold text-white" style={dmSans}>{riderProfile.name}</p>
                                <p className="text-sm text-zinc-400">is coming to collect your items</p>
                            </div>
                        </div>
                    </section>
                )}

                <section className="mx-5 mb-6 p-5 rounded-3xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Pickup Details</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-[#f2546d] mt-0.5" />
                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Address</p>
                                <p className="text-sm text-white mt-1">{pickupAddress}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Clock className="w-4 h-4 text-[#f2546d] mt-0.5" />
                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Scheduled Time</p>
                                <p className="text-sm text-white mt-1">
                                    {returnDate ? new Date(returnDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Instant Pickup'}
                                    {returnSlot && returnSlot !== 'Immediate' ? ` • ${returnSlot}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-5 mb-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-semibold text-white mb-3">Need Help?</h3>
                    <div className="flex gap-3">
                        <a href="tel:+919426878548" className="flex-1 py-3 text-center bg-zinc-800 rounded-xl text-white text-sm font-medium">Call</a>
                    </div>
                </section>

                {(order?.status === 'returned' || order?.status === 'return_completed') && (
                    <div className="mx-5 mt-6 mb-4">
                        <button onClick={() => navigate('/home')} className="w-full py-4 rounded-2xl bg-[#f2546d] text-white font-black uppercase tracking-tighter">
                            Home
                        </button>
                    </div>
                )}
            </main>

            <InstantBuyDrawer
                isOpen={showInstantBuy}
                onClose={() => setShowInstantBuy(false)}
                orderId={pickupId!}
                items={items}
                onSuccess={() => setShowInstantBuy(false)}
            />

            {/* ── Instant Return Confirmation Modal ── */}
            {showInstantReturnConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center px-3"
                    style={{ paddingBottom: 'var(--mobile-bottom-nav-offset)' }}
                >
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowInstantReturnConfirm(false)}
                    />
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        className="relative w-full max-w-[430px] bg-zinc-900 border border-zinc-800 rounded-t-3xl px-4 pt-4 sm:px-6 sm:pt-6 overflow-y-auto"
                        style={{
                            maxHeight: 'calc(var(--mobile-overlay-max-height) - var(--mobile-bottom-nav-offset))',
                            paddingBottom: 'var(--mobile-overlay-padding-bottom)',
                        }}
                    >
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-4" />
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#f2546d]/10 border border-[#f2546d]/20 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-[#f2546d]" />
                            </div>
                            <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight" style={dmSans}>
                                Confirm Instant Return
                            </h3>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium leading-relaxed mb-5 sm:mb-6" style={dmSans}>
                            Are you sure you want to return your items instantly? A rider will be assigned to pick them up shortly.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => setShowInstantReturnConfirm(false)}
                                className="flex-1 py-3 rounded-2xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-bold tracking-wide active:scale-95 transition-all"
                                style={dmSans}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { setShowInstantReturnConfirm(false); handleInstantReturn(); }}
                                disabled={instantReturnLoading}
                                className="flex-1 py-3 rounded-2xl bg-[#f2546d] text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                                style={dmSans}
                            >
                                {instantReturnLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Zap className="w-4 h-4" />
                                )}
                                {instantReturnLoading ? "Requesting..." : "Yes, Return Now"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </MobileShell>
    );
}
