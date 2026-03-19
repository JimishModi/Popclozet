import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { ChevronDown, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { getOrderById, scheduleReturn } from '@/services/ordersService';
import { useAuth } from '@/context/SupabaseAuthContext';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

/* ─── Time‑slot mock ─── */
interface TimeSlot {
    id: string;
    label: string;
    discount: number;
}
const TIME_SLOTS: TimeSlot[] = [
    { id: 'a', label: '10 am - 11 am', discount: 50 },
    { id: 'b', label: '12 pm - 1 pm', discount: 50 },
    { id: 'c', label: '3 pm - 4 pm', discount: 30 },
    { id: 'd', label: '5 pm - 6 pm', discount: 30 },
    { id: 'e', label: '7 pm - 8 pm', discount: 20 },
    { id: 'f', label: '9 pm - 10 pm', discount: 20 },
];

/* ─── Back‑arrow icon ─── */
const BackArrow = () => (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
        <path d="M8.5 1L1.5 8L8.5 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ScheduleReturnPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { user, profile } = useAuth();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState<string>('c');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
        } else {
            setLoading(false);
            toast.error("No order ID found");
        }
    }, [orderId]);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const data = await getOrderById(orderId!);
            setOrder(data);
        } catch (error) {
            console.error("Fetch order error:", error);
            toast.error("Failed to load order details");
        } finally {
            setLoading(false);
        }
    };

    const handleReturn = async () => {
        if (!orderId) return;
        try {
            setSubmitting(true);
            const slotLabel = TIME_SLOTS.find(s => s.id === selectedSlot)?.label || '3 pm - 4 pm';
            // Defaulting to tomorrow for pickup in this mock-to-real transition
            const pickupDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
            
            await scheduleReturn(orderId, pickupDate, slotLabel);
            
            toast.success("Return scheduled! A rider will reach out soon.");
            navigate('/closet');
        } catch (error) {
            console.error("Schedule return error:", error);
            toast.error("Failed to schedule return");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
            </MobileShell>
        );
    }

    if (!order) {
        return (
            <MobileShell className="bg-[#111111] text-white flex flex-col items-center justify-center px-6">
                <p className="text-zinc-400 mb-6">Order not found</p>
                <button onClick={() => navigate('/closet')} className="px-6 py-2 bg-[#f2546d] rounded-xl font-bold">Back to Closet</button>
            </MobileShell>
        );
    }

    const itemsCount = order.order_items?.length || 0;
    const firstItem = order.order_items?.[0];

    return (
        <MobileShell className="bg-[#111111] text-white">
            {/* ── Pink glow ── */}
            <div
                className="pointer-events-none absolute top-[-59px] left-[-33px] w-[145px] h-[137px]"
                style={{
                    borderRadius: '72.66px / 68.56px',
                    transform: 'rotate(23deg)',
                    filter: 'blur(200px)',
                    background:
                        'linear-gradient(90deg, rgba(242,84,109,1) 0%, rgba(255,96,120,1) 46%, rgba(97,22,36,1) 88%)',
                }}
            />

            {/* ── HEADER ── */}
            <div className="flex items-center gap-4 px-6 pt-16 pb-4">
                <button onClick={() => navigate(-1)} className="shrink-0">
                    <BackArrow />
                </button>
                <h1
                    className="text-2xl font-semibold text-white tracking-[-0.72px]"
                    style={dmSans}
                >
                    Schedule Return
                </h1>
            </div>

            <main className="flex-1 overflow-y-auto px-5 pb-28">
                {/* ═══════════════ OUTFIT SUMMARY ═══════════════ */}
                <section className="mt-4">
                    <div className="flex items-baseline gap-3">
                        <h2
                            className="text-2xl font-semibold text-white tracking-[-0.72px]"
                            style={dmSans}
                        >
                            {itemsCount > 1 ? 'Multi-item Rental' : 'Haldi Outfit'}
                        </h2>
                        <span
                            className="text-lg font-normal text-[#f2546d] tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                        </span>
                    </div>

                    {/* Item cards row */}
                    <div className="flex gap-2 mt-4">
                        <div className="relative w-24 h-36 rounded-lg bg-[#8d303f] overflow-hidden shrink-0 border border-white/10">
                            {order.order_items?.[0]?.product?.image_url ? (
                                <img src={order.order_items[0].product.image_url} className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-1 rounded-lg bg-[#313131]" />
                            )}
                        </div>

                        <div className="flex-1 rounded-lg bg-[#232323] p-2 flex gap-2 overflow-x-auto no-scrollbar">
                            {order.order_items?.slice(1).map((item: any, idx: number) => (
                                <div
                                    key={idx}
                                    className="w-20 h-[104px] rounded-lg bg-[#313131] shrink-0 overflow-hidden border border-white/5"
                                >
                                    {item.product?.image_url && <img src={item.product.image_url} className="w-full h-full object-cover" />}
                                </div>
                            ))}
                            {itemsCount === 1 && (
                                <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
                                    Single item order
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <div className="h-px bg-[#484848] mt-6" />

                {/* ═══════════════ RETURN TIME‑SLOT ═══════════════ */}
                <section className="mt-4">
                    <div className="flex items-baseline gap-3">
                        <h3
                            className="text-lg font-black text-white tracking-[-0.54px]"
                            style={dmSans}
                        >
                            Return Time-slot
                        </h3>
                        <span
                            className="text-sm font-semibold text-[#f2546d] tracking-[-0.42px]"
                            style={dmSans}
                        >
                            Discounts on preferred slots
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-6">
                        {TIME_SLOTS.map((slot) => {
                            const isSelected = selectedSlot === slot.id;
                            return (
                                <motion.div
                                    key={slot.id}
                                    whileTap={{ scale: 0.96 }}
                                    className="relative"
                                >
                                    <div className="absolute -top-2.5 -right-1 flex items-center justify-center bg-[#8d303f] rounded-full px-2 py-0.5 z-10 border border-white/10">
                                        <span className="text-[10px] font-bold text-white">- ₹ {slot.discount}</span>
                                    </div>

                                    <button
                                        onClick={() => setSelectedSlot(slot.id)}
                                        className={`w-full h-[48px] rounded-xl border transition-all ${isSelected
                                                ? 'bg-[#f2546d] border-[#ff8597] shadow-[0_0_15px_rgba(242,84,109,0.3)]'
                                                : 'bg-[#19191b] border-[#484848] text-zinc-400'
                                            }`}
                                    >
                                        <span className="text-sm font-bold tracking-tight">{slot.label}</span>
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                <div className="h-px bg-[#484848] mt-8" />

                {/* ═══════════════ USER INFO ═══════════════ */}
                <section className="mt-6 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">My Information</h3>
                            <Pencil className="w-4 h-4 text-zinc-500" />
                        </div>
                        <p className="text-base font-medium text-zinc-300">{profile?.full_name || user?.user_metadata?.full_name || 'Amogh Shete'}</p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Contact Details</h3>
                            <Pencil className="w-4 h-4 text-zinc-500" />
                        </div>
                        <p className="text-base font-medium text-zinc-300">{profile?.email || user?.email || 'sheteamogh@gmail.com'}</p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Pickup Address</h3>
                            <Pencil className="w-4 h-4 text-zinc-500" />
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            IIT Bombay, Powai, Mumbai 400076<br/>
                            Maharashtra, India
                        </p>
                    </div>
                </section>
            </main>

            <div className="sticky bottom-0 px-5 py-6 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent">
                <button
                    disabled={submitting}
                    onClick={handleReturn}
                    className="w-full h-14 rounded-2xl bg-[#f2546d] flex items-center justify-center gap-3 shadow-lg shadow-[#f2546d]/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {submitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <span className="text-lg font-bold text-white">Schedule Return</span>
                    )}
                </button>
            </div>
        </MobileShell>
    );
};

export default ScheduleReturnPage;
