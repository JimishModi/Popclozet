import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Package } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { getOrderById } from "@/services/ordersService";
import { supabase } from "@popclozet/api-client";
import deliveryPartnerAvatar from "@/assets/icons/delivery-partner-avatar.svg";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const PhoneCallIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none">
        <path
            d="M12.96 1a1 1 0 0 1 1-1c2.65.003 5.19 1.057 7.07 2.932A10.01 10.01 0 0 1 23.96 10a1 1 0 1 1-2 0c0-2.12-.85-4.15-2.35-5.65A7.99 7.99 0 0 0 13.96 2a1 1 0 0 1-1-1ZM13.96 6a4 4 0 0 1 4 4 1 1 0 1 0 2 0 6 6 0 0 0-6-6 1 1 0 1 0 0 2Zm9.09 10.74c.58.58.9 1.37.9 2.19s-.32 1.6-.9 2.19l-.91 1.05c-8.19 7.84-28.12-12.08-20.4-20.3l1.15-1a3.07 3.07 0 0 1 4.33.04l1.88 2.44c.55.58.86 1.35.86 2.14a3.03 3.03 0 0 1-.87 2.14l-1.16 1.46c.64 1.56 1.58 2.97 2.77 4.16a14.8 14.8 0 0 0 4.16 2.78l1.47-1.16a3.04 3.04 0 0 1 4.28-.01l2.44 1.88Z"
            fill="currentColor"
        />
    </svg>
);

// Statuses where the rider is on the way to pick up
const RIDER_EN_ROUTE_STATUSES = ['return_dispatched', 'return_picked_up'];

export default function PickupTrackingPage() {
    // Route is /pickup-tracking/:pickupId
    const { pickupId } = useParams<{ pickupId: string }>();
    const navigate = useNavigate();

    const [order, setOrder] = useState<any>(null);
    const [riderProfile, setRiderProfile] = useState<{ name: string; phone: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!pickupId) return;

        const fetchOrder = async () => {
            try {
                const data = await getOrderById(pickupId);
                setOrder(data);
                if (data?.rider_id) {
                    const { data: rp } = await supabase
                        .from('rider_profiles')
                        .select('full_name, phone')
                        .eq('user_id', data.rider_id)
                        .single();
                    if (rp) setRiderProfile({ name: rp.full_name || 'Your Rider', phone: rp.phone || '' });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();

        // Subscribe to real-time order status changes
        const channel = supabase
            .channel(`pickup_order:${pickupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${pickupId}`,
                },
                async () => {
                    const updated = await getOrderById(pickupId);
                    if (updated) setOrder(updated);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [pickupId]);

    const address = order?.delivery_address?.full_address ?? '—';
    const showOtp = order?.otp_return && RIDER_EN_ROUTE_STATUSES.includes(order?.status);

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white" hideBottomNav>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                </div>
            </MobileShell>
        );
    }

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            <main className="flex-1 overflow-y-auto flex flex-col">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg px-5 py-4 border-b border-white/5 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-xl font-bold text-white tracking-tight" style={dmSans}>Return Pickup</h1>
                </header>

                {/* Map placeholder */}
                <section className="relative h-[200px] flex-shrink-0 bg-gradient-to-br from-[#1a1a1a] to-black rounded-b-3xl mb-6">
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[100px] pointer-events-none z-10"
                        style={{ background: "radial-gradient(circle, rgba(242,84,109,0.3) 0%, rgba(0,0,0,0) 70%)" }}
                    />
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
                        <Package className="w-10 h-10 text-zinc-600 mb-2" />
                        <p className="text-zinc-500 text-sm">Rider on the way</p>
                    </div>
                </section>

                {/* Status banner */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex flex-col items-center justify-center py-5 bg-[#f2546d]"
                >
                    <span className="text-xl font-semibold text-white tracking-tight" style={dmSans}>
                        {order?.status === 'return_picked_up' ? 'Items Collected' : 'Rider Coming to Pick Up'}
                    </span>
                    <span className="text-sm text-white/80 mt-1" style={dmSans}>
                        Order #{(pickupId ?? '').slice(0, 8).toUpperCase()}
                    </span>
                </motion.div>

                {/* Return OTP card */}
                {showOtp && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-5 mt-6 p-5 rounded-3xl bg-gradient-to-br from-[#f2546d]/20 to-pink-900/10 border border-[#f2546d]/30 shadow-xl"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 text-[#f2546d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span className="text-xs font-black text-[#f2546d] uppercase tracking-[0.2em]">Return Pickup OTP</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            {order.otp_return.split('').map((digit: string, i: number) => (
                                <div key={i} className="flex-1 aspect-square max-w-[56px] flex items-center justify-center rounded-2xl bg-white/10 border border-[#f2546d]/30 text-white text-2xl font-black shadow-inner">
                                    {digit}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-400 text-center font-medium">
                            Share this code with the rider when they arrive to collect your items
                        </p>
                    </motion.div>
                )}

                {/* Rider info */}
                <section className="px-5 mt-6 flex items-center gap-4">
                    <img src={deliveryPartnerAvatar} alt="Rider" className="w-[64px] h-[64px] flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xl text-white font-bold tracking-tight" style={dmSans}>
                            {riderProfile?.name ?? 'Rider Assigned'}
                        </p>
                        <p className="text-sm text-zinc-400 mt-0.5">is your pickup rider</p>
                    </div>
                    {riderProfile?.phone ? (
                        <a href={`tel:${riderProfile.phone}`} className="flex-shrink-0">
                            <PhoneCallIcon className="w-6 h-6 text-[#f2546d]" />
                        </a>
                    ) : (
                        <button onClick={() => window.location.href = 'tel:+918000155299'} className="flex-shrink-0">
                            <PhoneCallIcon className="w-6 h-6 text-[#f2546d]" />
                        </button>
                    )}
                </section>

                {/* Address */}
                <section className="px-5 mt-6">
                    <h3 className="text-base font-black text-white tracking-tight mb-2" style={dmSans}>Pickup Address</h3>
                    <p className="text-sm text-[#b4b4b4] leading-relaxed" style={dmSans}>{address}</p>
                </section>

                <div className="flex-1" />

                {/* Bottom buttons */}
                <div className="flex gap-4 px-5 pb-8 pt-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl border border-[#484848] bg-transparent"
                    >
                        <span className="text-base font-semibold text-white" style={dmSans}>Go Back</span>
                    </button>
                    <button
                        onClick={() => navigate("/")}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl bg-[#f2546d]"
                    >
                        <span className="text-base font-semibold text-white" style={dmSans}>Home</span>
                    </button>
                </div>
            </main>
        </MobileShell>
    );
}
