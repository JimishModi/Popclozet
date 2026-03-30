import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { Heart, ShoppingBag, Package, Clock, CalendarClock, Zap, MapPin, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@popclozet/api-client';
import { requestImmediateReturn, getMySavedAddresses, type SavedAddressRecord } from '@/services/ordersService';
import { toast } from 'sonner';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

interface LiveRentalItem {
    id: string;            // order_items id
    orderId: string;       // order id
    productId: string;
    title: string;
    brand: string;
    image: string;
    rentalPrice: number;
    originalPrice: number;
    buyPrice: number | null;
    size: string;
    rentalStartDate: string;
    rentalEndDate: string;
    daysLeft: number;
    returnToday: boolean;
    status: string;
    type: 'current' | 'future';
    arrivalDays?: number;
}

/* Small countdown/return icon (inline SVG) */
const CountdownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" />
        <path d="M12 7v5l3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const LiveClosetPage: React.FC = () => {
    const navigate = useNavigate();
    const { totalItems } = useCart();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rentals, setRentals] = useState<LiveRentalItem[]>([]);
    const [returnNowModal, setReturnNowModal] = useState<{ orderId: string; title: string } | null>(null);
    const [returnNowAddresses, setReturnNowAddresses] = useState<SavedAddressRecord[]>([]);
    const [returnNowAddressId, setReturnNowAddressId] = useState<string>('');
    const [returnNowSubmitting, setReturnNowSubmitting] = useState(false);

    useEffect(() => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        const fetchActiveRentals = async () => {
            try {
                // Fetch orders that are currently "with the user" or in transit to them
                const { data: orders, error } = await supabase
                    .from('orders')
                    .select(`
                        id, status, rental_start_date, rental_end_date, total_amount,
                        delivery_eta, created_at,
                        order_items (
                            id, product_id, size, rental_price, pricing_plan,
                            products (id, name, brand, images, rental_price, buy_price)
                        )
                    `)
                    .eq('user_id', user.id)
                    .in('status', [
                        'confirmed', 'packed', 'ready_for_pickup',
                        'dispatched', 'out_for_delivery',
                        'delivered', 'in_use'
                    ])
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('[LiveCloset] Error fetching orders:', error);
                    setLoading(false);
                    return;
                }

                const now = new Date();
                const items: LiveRentalItem[] = [];

                for (const order of (orders ?? [])) {
                    const isDelivered = ['delivered', 'in_use'].includes(order.status);
                    const isInTransit = ['dispatched', 'out_for_delivery'].includes(order.status);
                    const isPending = ['confirmed', 'packed', 'ready_for_pickup'].includes(order.status);

                    const endDate = order.rental_end_date ? new Date(order.rental_end_date) : null;
                    const startDate = order.rental_start_date ? new Date(order.rental_start_date) : null;
                    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                    const returnToday = daysLeft === 0 && isDelivered;

                    // Estimate arrival days for undelivered orders
                    let arrivalDays = 0;
                    if (isPending || isInTransit) {
                        const eta = order.delivery_eta ? new Date(order.delivery_eta) : null;
                        if (eta) {
                            arrivalDays = Math.max(0, Math.ceil((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                        } else {
                            arrivalDays = isPending ? 2 : 1; // Reasonable defaults
                        }
                    }

                    for (const item of (order.order_items ?? [])) {
                        const product = item.products as any;
                        if (!product) continue;

                        items.push({
                            id: item.id,
                            orderId: order.id,
                            productId: product.id,
                            title: product.name || 'Rental Item',
                            brand: product.brand || '',
                            image: product.images?.[0] || '',
                            rentalPrice: item.rental_price || 0,
                            originalPrice: parseFloat(product.rental_price) || 0,
                            buyPrice: product.buy_price ? parseFloat(product.buy_price) : null,
                            size: item.size || '',
                            rentalStartDate: order.rental_start_date || '',
                            rentalEndDate: order.rental_end_date || '',
                            daysLeft,
                            returnToday,
                            status: order.status,
                            type: isDelivered ? 'current' : 'future',
                            arrivalDays: isDelivered ? undefined : arrivalDays,
                        });
                    }
                }

                setRentals(items);
            } catch (err) {
                console.error('[LiveCloset] Failed to fetch:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchActiveRentals();
    }, [user?.id]);

    const currentRentals = rentals.filter((item) => item.type === 'current');
    const futureRentals = rentals.filter((item) => item.type === 'future');
    const hasNoRentals = !loading && rentals.length === 0;

    const formatDateRange = (start: string, end: string) => {
        try {
            const s = new Date(start);
            const e = new Date(end);
            const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
            return `${fmt.format(s)} - ${fmt.format(e)}`;
        } catch {
            return '';
        }
    };

    const handleKeepItem = (item: LiveRentalItem) => {
        // Navigate to checkout with skipDelivery=true — user already has the dress
        navigate(`/checkout?buyoutOrderId=${item.orderId}&skipDelivery=true`);
    };

    const handleScheduleReturn = (item: LiveRentalItem) => {
        navigate(`/schedule-return?orderId=${item.orderId}`);
    };

    const openReturnNowModal = async (item: LiveRentalItem) => {
        setReturnNowModal({ orderId: item.orderId, title: item.title });
        setReturnNowSubmitting(false);
        try {
            const addrs = await getMySavedAddresses();
            setReturnNowAddresses(addrs);
            const defaultAddr = addrs.find(a => a.is_default) ?? addrs[0];
            setReturnNowAddressId(defaultAddr?.id ?? '');
        } catch {
            setReturnNowAddresses([]);
        }
    };

    const handleReturnNow = async () => {
        if (!returnNowModal) return;
        setReturnNowSubmitting(true);
        try {
            await requestImmediateReturn(returnNowModal.orderId, returnNowAddressId || null);
            toast.success('Immediate return requested — a rider will be assigned shortly');
            setReturnNowModal(null);
        } catch (err: any) {
            console.error('Return Now failed:', err);
            toast.error(err?.message || 'Failed to request immediate return');
        } finally {
            setReturnNowSubmitting(false);
        }
    };

    return (
        <MobileShell className="bg-[#111111] text-white">
            {/* ─── HEADER ─── */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-[#111111] to-[#111111]/95 backdrop-blur-xl px-5 py-3 flex items-center justify-between">
                {/* Left spacer */}
                <div className="w-20" />

                {/* Center logo or spacer */}
                <div className="flex-1" />

                {/* Right icons */}
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-full bg-[#232323]">
                        <Heart className="w-5 h-5 text-zinc-400" />
                    </button>
                    <button
                        onClick={() => navigate('/cart')}
                        className="relative p-2 rounded-full bg-[#232323]"
                    >
                        <ShoppingBag className="w-5 h-5 text-zinc-400" />
                        {totalItems > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                {totalItems > 9 ? '9+' : totalItems}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-5 pb-28">
                {/* ─── LIVE CLOSET TITLE ─── */}
                <h1
                    className="text-2xl font-semibold text-white tracking-[-0.72px] mt-4"
                    style={dmSans}
                >
                    Live Closet
                </h1>

                {/* ─── LOADING STATE ─── */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#f2546d]/30 border-t-[#f2546d] rounded-full animate-spin" />
                        <p className="text-sm text-zinc-500 mt-4" style={dmSans}>Loading your closet...</p>
                    </div>
                )}

                {/* ─── EMPTY STATE ─── */}
                {hasNoRentals && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <div className="w-20 h-20 rounded-full bg-[#232323] flex items-center justify-center mb-6">
                            <Package className="w-10 h-10 text-zinc-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-2" style={dmSans}>
                            Your closet is empty
                        </h2>
                        <p className="text-sm text-zinc-500 max-w-[280px] leading-relaxed" style={dmSans}>
                            Browse our collection and rent your first outfit to see it here!
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-8 px-8 py-3 rounded-xl bg-[#f2546d] text-white font-semibold text-sm"
                            style={dmSans}
                        >
                            Explore Collection
                        </button>
                    </motion.div>
                )}

                {/* ─── CURRENT RENTALS ─── */}
                {currentRentals.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        {currentRentals.map((item, idx) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                                style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                            >
                                {/* Image area with gradient overlay */}
                                <div className="relative aspect-square md:aspect-[176/250]">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                            <Package className="w-12 h-12 text-zinc-600" />
                                        </div>
                                    )}
                                    {/* Bottom gradient */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-12 backdrop-blur-[9.2px]"
                                        style={{
                                            background:
                                                'linear-gradient(180deg, rgba(17,17,17,0) 0%, rgba(17,17,17,1) 100%)',
                                        }}
                                    />

                                    {/* Badge */}
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1">
                                        <CountdownIcon />
                                        <span
                                            className="text-sm font-semibold text-white tracking-[-0.42px]"
                                            style={dmSans}
                                        >
                                            {item.returnToday
                                                ? 'Return Today'
                                                : `${item.daysLeft} Days Left`}
                                        </span>
                                    </div>

                                    {/* Size badge */}
                                    {item.size && (
                                        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5">
                                            <span className="text-[10px] font-bold text-white uppercase">{item.size}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-[#484848]" />

                                {/* Card content */}
                                <div className="p-3">
                                    <h3
                                        className="text-sm font-semibold text-white tracking-[-0.42px] line-clamp-1"
                                        style={dmSans}
                                    >
                                        {item.title}
                                    </h3>
                                    {item.brand && (
                                        <p className="text-[11px] text-zinc-500 mt-0.5" style={dmSans}>
                                            {item.brand}
                                        </p>
                                    )}
                                    {!item.returnToday && (
                                        <>
                                            <p
                                                className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-1"
                                                style={dmSans}
                                            >
                                                {formatDateRange(item.rentalStartDate, item.rentalEndDate)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span
                                                    className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                                    style={dmSans}
                                                >
                                                    ₹ {item.rentalPrice}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="px-3 pb-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openReturnNowModal(item)}
                                            className="flex-1 py-2.5 rounded-xl bg-[#f2546d] text-center active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                                        >
                                            <Zap className="w-3.5 h-3.5 text-white" />
                                            <span
                                                className="text-sm font-semibold text-white tracking-[-0.42px]"
                                                style={dmSans}
                                            >
                                                Return Now
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => handleScheduleReturn(item)}
                                            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-center active:scale-95 transition-transform"
                                        >
                                            <span
                                                className="text-sm font-semibold text-zinc-300 tracking-[-0.42px]"
                                                style={dmSans}
                                            >
                                                Schedule
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* ─── FUTURE BOOKINGS ─── */}
                {futureRentals.length > 0 && (
                    <>
                        <h2
                            className="text-2xl font-semibold text-white tracking-[-0.72px] mt-10"
                            style={dmSans}
                        >
                            On The Way
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            {futureRentals.map((item, idx) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                                    style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                                >
                                    {/* Image area */}
                                    <div className="relative aspect-square md:aspect-[176/250]">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                                <Package className="w-12 h-12 text-zinc-600" />
                                            </div>
                                        )}

                                        {/* Arrival Badge */}
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-full px-2.5 py-1">
                                            <CalendarClock className="w-4 h-4 text-[#ff6078]" />
                                            <span
                                                className="text-xs font-semibold text-[#ff6078] tracking-[-0.36px]"
                                                style={dmSans}
                                            >
                                                {item.arrivalDays === 0
                                                    ? 'Arriving Today'
                                                    : item.arrivalDays === 1
                                                    ? 'Arriving Tomorrow'
                                                    : `Arriving in ${item.arrivalDays} Days`}
                                            </span>
                                        </div>

                                        {/* Size badge */}
                                        {item.size && (
                                            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5">
                                                <span className="text-[10px] font-bold text-white uppercase">{item.size}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="h-px bg-[#484848]" />

                                    {/* Card content */}
                                    <div className="p-3">
                                        <h3
                                            className="text-sm font-semibold text-white tracking-[-0.42px] line-clamp-1"
                                            style={dmSans}
                                        >
                                            {item.title}
                                        </h3>
                                        {item.brand && (
                                            <p className="text-[11px] text-zinc-500 mt-0.5" style={dmSans}>
                                                {item.brand}
                                            </p>
                                        )}
                                        <p
                                            className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-1"
                                            style={dmSans}
                                        >
                                            {formatDateRange(item.rentalStartDate, item.rentalEndDate)}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span
                                                className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                                style={dmSans}
                                            >
                                                ₹ {item.rentalPrice}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}
            </main>

            {/* ─── RETURN NOW MODAL ─── */}
            <AnimatePresence>
                {returnNowModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-5 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-[#f2546d]/20 flex items-center justify-center">
                                        <Zap className="w-4 h-4 text-[#f2546d]" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white" style={dmSans}>Return Now</h3>
                                </div>
                                <button
                                    onClick={() => setReturnNowModal(null)}
                                    className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-5">
                                <p className="text-sm text-zinc-400" style={dmSans}>
                                    A rider will be assigned immediately to pick up <span className="text-white font-medium">{returnNowModal.title}</span>.
                                </p>
                                <div>
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <MapPin className="w-3.5 h-3.5 text-[#f2546d]" />
                                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-[0.15em]" style={dmSans}>Pickup from</span>
                                    </div>
                                    {returnNowAddresses.length === 0 ? (
                                        <p className="text-sm text-zinc-500">Using delivery address</p>
                                    ) : (
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {returnNowAddresses.map(addr => (
                                                <button
                                                    key={addr.id}
                                                    onClick={() => setReturnNowAddressId(addr.id)}
                                                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                                                        returnNowAddressId === addr.id
                                                            ? 'bg-[#f2546d]/10 border-[#f2546d]'
                                                            : 'bg-white/[0.03] border-white/10'
                                                    }`}
                                                >
                                                    <p className="text-sm font-medium text-white" style={dmSans}>{addr.label || 'Saved Address'}</p>
                                                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{addr.full_address}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleReturnNow}
                                    disabled={returnNowSubmitting}
                                    className="w-full h-14 rounded-2xl bg-[#f2546d] flex items-center justify-center gap-2 shadow-lg shadow-[#f2546d]/20 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {returnNowSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                                            <span className="text-base font-bold text-white" style={dmSans}>Requesting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-5 h-5 text-white" />
                                            <span className="text-base font-bold text-white" style={dmSans}>Confirm Immediate Return</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </MobileShell>
    );
};

export default LiveClosetPage;
