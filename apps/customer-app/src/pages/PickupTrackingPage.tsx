import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft, Package, Phone, MessageCircle,
    MapPin, KeyRound, Truck, Clock, CheckCircle2,
    Navigation, Loader2, ExternalLink, Building2,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { getOrderById } from "@/services/ordersService";
import { supabase } from "@popclozet/api-client";
import { OrderChat } from "@/components/map/OrderChat";
import { notifyOrderStatusChange } from "@/services/notificationService";
import {
    subscribeToRiderProximity,
    checkDeliveryProximity,
    distanceKm,
    type ProximityStatus,
} from "@/services/geofenceSubscription";


const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const STATUS_ORDER = ['return_scheduled', 'return_dispatched', 'return_picked_up', 'return_at_warehouse', 'returned'];
const DISPLAY_ORDER = ['return_scheduled', 'return_dispatched', 'return_picked_up'];

const STATUS_STEPS = [
    { key: 'return_scheduled',    label: 'Return Scheduled',  Icon: Clock },
    { key: 'return_dispatched',   label: 'Rider On the Way',  Icon: Truck },
    { key: 'return_picked_up',    label: 'Item Handover',     Icon: Package },
];

const STATUS_LABEL: Record<string, string> = {
    return_scheduled:    'Pickup Scheduled',
    return_dispatched:   'Rider On the Way',
    return_picked_up:    'Handover Complete',
    return_at_warehouse: 'Handover Complete',
    returned:            'Handover Complete',
};

export default function PickupTrackingPage() {
    const { pickupId } = useParams<{ pickupId: string }>();
    const navigate = useNavigate();

    const [order,           setOrder]          = useState<any>(null);
    const [items,           setItems]          = useState<any[]>([]);
    const [riderProfile,    setRiderProfile]   = useState<{ name: string; phone: string } | null>(null);
    const [loading,         setLoading]        = useState(true);
    const [showChat,        setShowChat]       = useState(false);
    const [riderProximity,  setRiderProximity] = useState<ProximityStatus>('far');
    const [riderDistanceKm, setRiderDistanceKm] = useState<number | null>(null);
    const [riderLocation,   setRiderLocation]   = useState<{ lat: number; lng: number } | null>(null);

    const previousStatusRef = useRef<string | null>(null);
    const geofenceCleanupRef = useRef<(() => void) | null>(null);

    // ── Initial fetch + realtime subscription ──
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

        // Realtime subscription for order changes (status + OTP field updates)
        const channel = supabase
            .channel(`pickup_tracking:${pickupId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${pickupId}`,
            }, async () => {
                const updated = await getOrderById(pickupId);
                if (updated) {
                    // Fire notification on status change
                    if (previousStatusRef.current && updated.status !== previousStatusRef.current) {
                        notifyOrderStatusChange(updated.user_id, pickupId, updated.status!).catch(console.warn);
                    }
                    previousStatusRef.current = updated.status ?? null;
                    setOrder(updated);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [pickupId]);

    // ── Fetch rider whenever rider_id appears on order ──
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

    // ── Geofence: subscribe to rider proximity ──
    useEffect(() => {
        // Clean up previous geofence subscription
        if (geofenceCleanupRef.current) {
            geofenceCleanupRef.current();
            geofenceCleanupRef.current = null;
        }

        // Only subscribe when rider is dispatched and we have coordinates
        if (!order?.rider_id) return;
        if (!['return_dispatched'].includes(order?.status ?? '')) return;

        // Get customer destination from order address
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

        // ── Initial proximity check ──
        // The realtime subscription only fires on future updates. If the rider is
        // already nearby when this page loads (or when the user hard-reloads), the
        // OTP would never appear. Fetch the rider's current location immediately and
        // seed the proximity + distance state so the OTP shows without a reload.
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

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white" hideBottomNav>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                </div>
            </MobileShell>
        );
    }

    const rawStatusIdx = STATUS_ORDER.indexOf(order?.status ?? '');
    // Clamp the status index to the DISPLAY_ORDER range (0-2)
    const currentStatusIdx = rawStatusIdx > 2 ? 2 : rawStatusIdx;

    // OTP is only shown when:
    // 1. The order has an otp_return value
    // 2. The status is return_dispatched (rider on the way)
    // 3. The rider is NEARBY (geofence — within ~100m)
    // OR when status is return_picked_up (rider already collected → customer needs to see it was used)
    const riderIsNearby = riderProximity === 'nearby';
    const showOtp = order?.otp_return && (
        (order?.status === 'return_dispatched' && riderIsNearby) ||
        (rawStatusIdx >= 2 && rawStatusIdx < 5) // return_picked_up, return_at_warehouse
    );

    // Show the rider-approaching card when dispatched but not yet nearby
    const showRiderApproaching = order?.status === 'return_dispatched' && !riderIsNearby && order?.otp_return;

    const statusLabel = STATUS_LABEL[order?.status] ?? 'Return in Progress';
    const pickupAddress = order?.delivery_address?.full_address ?? '—';
    const returnDate    = order?.return_pickup_date ?? null;
    const returnSlot    = order?.return_time_slot ?? null;

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            {/* Header */}
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

                {/* ── Status Timeline ── */}
                <section className="px-5 pt-6 pb-2">
                    {STATUS_STEPS.map((step, idx) => {
                        const stepIdx = DISPLAY_ORDER.indexOf(step.key);
                        const isDone    = currentStatusIdx >= stepIdx && currentStatusIdx !== -1;
                        const isCurrent = currentStatusIdx === stepIdx;
                        const { Icon } = step;
                        return (
                            <div key={step.key} className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                                        isDone
                                            ? 'bg-[#f2546d] border-[#f2546d] text-white'
                                            : 'bg-[#1a1a1a] border-zinc-700 text-zinc-600'
                                    } ${isCurrent ? 'shadow-lg shadow-[#f2546d]/30' : ''}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    {idx < STATUS_STEPS.length - 1 && (
                                        <div className={`w-0.5 h-8 mt-1 transition-colors ${
                                            currentStatusIdx > stepIdx ? 'bg-[#f2546d]' : 'bg-zinc-800'
                                        }`} />
                                    )}
                                </div>
                                <div className="pt-1.5 pb-8">
                                    <p className={`text-sm font-bold ${isDone ? 'text-white' : 'text-zinc-600'}`} style={dmSans}>
                                        {step.label}
                                    </p>
                                    {isCurrent && (
                                        <p className="text-xs text-[#f2546d] mt-0.5 font-medium">{isDone && currentStatusIdx === 2 ? 'Completed' : 'Current Status'}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>

                {/* ── Rider Live Location Map (shown during return_dispatched) ── */}
                {order?.status === 'return_dispatched' && riderLocation && (
                    <motion.section
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-5 mb-6 rounded-3xl overflow-hidden border border-zinc-800 shadow-xl"
                    >
                        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-zinc-900">
                            <div className="flex items-center gap-2">
                                <Navigation className="w-4 h-4 text-[#f2546d]" />
                                <span className="text-xs font-black text-white uppercase tracking-[0.15em]">
                                    Rider Live Location
                                </span>
                            </div>
                            <a
                                href={`https://www.google.com/maps?q=${riderLocation.lat},${riderLocation.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] font-bold text-[#f2546d] uppercase tracking-widest"
                            >
                                Open Maps <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                        <iframe
                            src={`https://maps.google.com/maps?q=${riderLocation.lat},${riderLocation.lng}&zoom=15&output=embed`}
                            width="100%"
                            height="200"
                            style={{ border: 0, display: 'block' }}
                            loading="lazy"
                            title="Rider location"
                        />
                    </motion.section>
                )}

                {/* ── Rider Approaching Card (before OTP is revealed) ── */}
                {showRiderApproaching && (
                    <motion.section
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-5 mb-6 p-5 rounded-3xl bg-gradient-to-br from-blue-500/15 to-blue-900/10 border border-blue-500/25 shadow-xl"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Navigation className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-black text-blue-400 uppercase tracking-[0.2em]">Rider Approaching</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                <Truck className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-white text-sm font-bold" style={dmSans}>
                                    {riderDistanceKm !== null
                                        ? `Rider is ${riderDistanceKm < 1 ? `${Math.round(riderDistanceKm * 1000)}m` : `${riderDistanceKm.toFixed(1)}km`} away`
                                        : 'Rider is on the way'
                                    }
                                </p>
                                <p className="text-zinc-400 text-xs mt-0.5">
                                    OTP will appear when your rider arrives at your location
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                            <p className="text-xs text-blue-300/70 font-medium">Waiting for rider to arrive...</p>
                        </div>
                    </motion.section>
                )}

                {/* ── Return OTP — only shown when rider is nearby (geofence-gated) ── */}
                {showOtp && (
                    <motion.section
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-5 mb-6 p-5 rounded-3xl bg-gradient-to-br from-[#f2546d]/20 to-pink-900/10 border border-[#f2546d]/30 shadow-xl shadow-[#f2546d]/10"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <KeyRound className="w-4 h-4 text-[#f2546d]" />
                            <span className="text-xs font-black text-[#f2546d] uppercase tracking-[0.2em]">Return Pickup OTP</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            {(order.otp_return as string).split('').map((digit: string, i: number) => (
                                <div
                                    key={i}
                                    className="flex-1 aspect-square max-w-[56px] flex items-center justify-center rounded-2xl bg-white/10 border border-[#f2546d]/30 text-white text-2xl font-black shadow-inner"
                                >
                                    {digit}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-400 text-center font-medium">
                            Share this code with the rider to hand over your items
                        </p>
                    </motion.section>
                )}

                {/* ── Items to Return ── */}
                {items.length > 0 && (
                    <section className="mx-5 mb-6">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">Items to Return</h3>
                        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                            {items.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-4 items-center p-4 ${idx < items.length - 1 ? 'border-b border-zinc-800' : ''}`}
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-white/5">
                                        {item.products?.images?.[0] ? (
                                            <img src={item.products.images[0]} alt={item.products.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-6 h-6 text-zinc-700" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-white truncate uppercase tracking-tight" style={dmSans}>
                                            {item.products?.name || 'Item'}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-0.5 font-bold uppercase tracking-widest">
                                            Size: {item.size}
                                        </p>
                                    </div>
                                    <p className="text-sm font-black text-white">₹{item.rental_price}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Rider Card ── */}
                {riderProfile && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-5 mb-6 p-5 rounded-3xl bg-zinc-900 border border-zinc-800"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Your Rider</span>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Active</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#f2546d]/20 border border-[#f2546d]/30 flex items-center justify-center flex-shrink-0">
                                <Truck className="w-6 h-6 text-[#f2546d]" />
                            </div>
                            <div className="flex-1">
                                <p className="text-base font-bold text-white" style={dmSans}>{riderProfile.name}</p>
                                <p className="text-sm text-zinc-400 mt-0.5">is coming to collect your items</p>
                            </div>
                            {riderProfile.phone ? (
                                <a
                                    href={`tel:${riderProfile.phone}`}
                                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg active:scale-90 transition-all"
                                >
                                    <Phone className="w-5 h-5 text-black" />
                                </a>
                            ) : (
                                <button
                                    onClick={() => { window.location.href = 'tel:+918000155299'; }}
                                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg active:scale-90 transition-all"
                                >
                                    <Phone className="w-5 h-5 text-black" />
                                </button>
                            )}
                        </div>
                    </motion.section>
                )}

                {/* ── Pickup Details ── */}
                <section className="mx-5 mb-6 p-5 rounded-3xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Pickup Details</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-[#f2546d] mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Address</p>
                                <p className="text-sm text-white mt-1 leading-relaxed">{pickupAddress}</p>
                            </div>
                        </div>
                        {(returnDate || returnSlot) && (
                            <div className="flex items-start gap-3">
                                <Clock className="w-4 h-4 text-[#f2546d] mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Scheduled Slot</p>
                                    <p className="text-sm text-white mt-1">
                                        {returnDate
                                            ? new Date(returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : ''}
                                        {returnSlot ? ` • ${returnSlot}` : ''}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Need Help ── */}
                <section className="mx-5 mb-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-semibold text-white mb-3">Need Help?</h3>
                    <div className="flex gap-3">
                        <a
                            href="tel:+918000155299"
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <Phone className="w-4 h-4" />
                            Call
                        </a>
                        <button
                            onClick={() => setShowChat(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Chat
                        </button>
                    </div>
                </section>

                <div className="mx-5">
                    <a
                        href={`mailto:popclozet@gmail.com?subject=Issue with Return #${pickupId}`}
                        className="w-full flex items-center justify-center py-3 rounded-xl bg-zinc-900 border border-[#f2546d]/30 text-sm text-[#f2546d] hover:bg-[#f2546d]/10 transition-colors"
                    >
                        Report an Issue
                    </a>
                </div>
            </main>

            {/* Chat Drawer */}
            <AnimatePresence>
                {showChat && pickupId && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
                        <div className="absolute inset-0" onClick={() => setShowChat(false)} />
                        <OrderChat orderId={pickupId} onClose={() => setShowChat(false)} />
                    </div>
                )}
            </AnimatePresence>
        </MobileShell>
    );
}
