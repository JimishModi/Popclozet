import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft, Package, Phone, MessageCircle,
    MapPin, KeyRound, Truck, Clock, CheckCircle2,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { getOrderById } from "@/services/ordersService";
import { supabase } from "@popclozet/api-client";
import { OrderChat } from "@/components/map/OrderChat";
import deliveryPartnerAvatar from "@/assets/icons/delivery-partner-avatar.svg";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const STATUS_ORDER = ['return_scheduled', 'return_dispatched', 'return_picked_up', 'returned'];

const STATUS_STEPS = [
    { key: 'return_scheduled',  label: 'Return Scheduled',  Icon: Clock },
    { key: 'return_dispatched', label: 'Rider Assigned',    Icon: Truck },
    { key: 'return_picked_up',  label: 'Items Collected',   Icon: Package },
    { key: 'returned',          label: 'Return Complete',   Icon: CheckCircle2 },
];

const STATUS_LABEL: Record<string, string> = {
    return_scheduled:  'Pickup Scheduled',
    return_dispatched: 'Rider On the Way',
    return_picked_up:  'Items Collected',
    returned:          'Return Complete',
};

const RIDER_EN_ROUTE = ['return_dispatched', 'return_picked_up'];

export default function PickupTrackingPage() {
    const { pickupId } = useParams<{ pickupId: string }>();
    const navigate = useNavigate();

    const [order,        setOrder]       = useState<any>(null);
    const [items,        setItems]       = useState<any[]>([]);
    const [riderProfile, setRiderProfile] = useState<{ name: string; phone: string } | null>(null);
    const [loading,      setLoading]     = useState(true);
    const [showChat,     setShowChat]    = useState(false);

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

        const channel = supabase
            .channel(`pickup_tracking:${pickupId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${pickupId}`,
            }, async () => {
                const updated = await getOrderById(pickupId);
                if (updated) setOrder(updated);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [pickupId]);

    // Fetch rider whenever rider_id appears on order
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

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white" hideBottomNav>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                </div>
            </MobileShell>
        );
    }

    const currentStatusIdx = STATUS_ORDER.indexOf(order?.status ?? '');
    const showOtp   = order?.otp_return && RIDER_EN_ROUTE.includes(order?.status);
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
                        const stepIdx = STATUS_ORDER.indexOf(step.key);
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
                                        <p className="text-xs text-[#f2546d] mt-0.5 font-medium">Current Status</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>

                {/* ── Return OTP ── */}
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
                            {(order.otp_return as string).split('').map((digit, i) => (
                                <div
                                    key={i}
                                    className="flex-1 aspect-square max-w-[56px] flex items-center justify-center rounded-2xl bg-white/10 border border-[#f2546d]/30 text-white text-2xl font-black shadow-inner"
                                >
                                    {digit}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-400 text-center font-medium">
                            Share this code with the rider when they arrive to collect your items
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
                            <img src={deliveryPartnerAvatar} alt="Rider" className="w-14 h-14 flex-shrink-0" />
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
