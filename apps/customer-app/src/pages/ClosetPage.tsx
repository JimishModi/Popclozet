import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/SupabaseAuthContext';
import { getMyActiveRentals, keepItem } from '@/services/ordersService';
import { getRemainingRentalTime } from '@popclozet/api-client';
import { format } from 'date-fns';
import { toast } from 'sonner';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

interface RentalItem {
    id: string;
    title: string;
    dateRange: string;
    currentPrice: number;
    daysLeft?: number;
    returnToday?: boolean;
    image?: string;
    type: 'current' | 'future';
    arrivalDays?: number;
    itemCount?: number;
    isInTransit?: boolean;
    isDelivered?: boolean;
    isReturnInProgress?: boolean;
    hoursLeft?: number;
    minutesLeft?: number;
}

/* Clock/countdown icon */
const CountdownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" />
        <path d="M12 7v5l3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ClosetPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rentals, setRentals] = useState<RentalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchRentals();
    }, [user, tick]);

    const fetchRentals = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);

            // Timeout to prevent infinite hang on Supabase cold-start
            const rentalsPromise = getMyActiveRentals();
            const timeoutPromise = new Error('Rentals fetch timeout');

            let activeOrders: any[];
            try {
                activeOrders = await rentalsPromise;
            } catch (timeoutErr) {
                console.warn('[Closet] Supabase timed out — showing empty state');
                setRentals([]);
                setLoading(false);
                return;
            }

            const mapped: RentalItem[] = activeOrders.map((order: any) => {
                const firstItem = order.order_items?.[0]?.item;
                const now = new Date();
                
                // If not delivered yet, these might be null or initial booking dates
                const rentalStartTime = order.rental_start_date ? new Date(order.rental_start_date) : null;
                const rentalEndTime = order.rental_end_date ? new Date(order.rental_end_date) : null;

                const timeInfo = rentalEndTime ? getRemainingRentalTime(order.rental_end_date) : { expired: false, days: 3, hours: 0, minutes: 0 };

                // Status Logic:
                // Keep active rentals visible through the scheduled return lifecycle.
                const isDelivered = ['delivered', 'in_use'].includes(order.status);
                const isInTransit = ['out_for_delivery', 'dispatched'].includes(order.status);
                const isReturnInProgress = [
                    'return_requested',
                    'return_scheduled',
                    'return_dispatched',
                    'return_picked_up',
                    'return_at_warehouse',
                    'returned',
                ].includes(order.status);

                const type = (isDelivered || isInTransit || isReturnInProgress) ? 'current' : 'future';

                // Date label
                let dateRange = 'Dates TBD';
                if (rentalStartTime && rentalEndTime) {
                    dateRange = `${format(rentalStartTime, 'd MMM')} - ${format(rentalEndTime, 'd MMM')}`;
                }

                // Arrival days (for future)
                let arrivalDays = 0;
                if (type === 'future' && rentalStartTime) {
                    arrivalDays = Math.max(0, Math.ceil((rentalStartTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                }

                return {
                    id: order.id,
                    title: firstItem?.name || 'Rental Outfit',
                    dateRange,
                    currentPrice: order.total_amount,
                    daysLeft: timeInfo.days,
                    hoursLeft: (timeInfo as any).hours,
                    minutesLeft: (timeInfo as any).minutes,
                    returnToday: isDelivered && (timeInfo.expired || (timeInfo.days === 0 && (timeInfo as any).hours < 24)),
                    image: Array.isArray(firstItem?.images) ? firstItem.images[0] : firstItem?.images,
                    type,
                    arrivalDays,
                    isInTransit,
                    isDelivered,
                    isReturnInProgress,
                    itemCount: order.order_items?.length || 0
                };
            });

            setRentals(mapped);
        } catch (error) {
            console.error('Error fetching rentals:', error);
            toast.error('Failed to load your closet');
        } finally {
            setLoading(false);
        }
    };

    const handleKeepIt = (orderId: string) => {
        navigate(`/checkout?buyoutOrderId=${orderId}`);
    };

    const currentRentals = rentals.filter((item) => item.type === 'current');
    // const futureRentals = rentals.filter((item) => item.type === 'future'); // Removed as per user edit

    return (
        <div className="bg-[#111111] text-white min-h-screen relative overflow-hidden">
            {/* ─── Pink glow (top-left decorative) ─── */}
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

            {/* ─── HEADER ─── */}
            <div className="sticky top-0 z-50 px-5 py-3 flex items-center justify-end">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/wishlist')}
                        className="w-10 h-10 rounded-full bg-[#303135] flex items-center justify-center"
                    >
                        <Heart className="w-[21px] h-[19px] text-white" />
                    </button>
                    <button
                        onClick={() => navigate('/cart')}
                        className="w-10 h-10 rounded-full bg-[#303135] flex items-center justify-center"
                    >
                        <ShoppingBag className="w-5 h-6 text-white" />
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

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#f2546d]/30 border-t-[#f2546d] rounded-full animate-spin" />
                        <p className="text-sm text-gray-400 mt-4" style={dmSans}>Fetching your outfits...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && rentals.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#232323] flex items-center justify-center mb-4">
                            <ShoppingBag className="w-8 h-8 text-gray-500" />
                        </div>
                        <p className="text-lg font-semibold text-white mb-2" style={dmSans}>Your Closet is Empty</p>
                        <p className="text-sm text-gray-400 mb-6" style={dmSans}>Start renting outfits to see them here</p>
                        <button
                            onClick={() => navigate('/collections')}
                            className="px-6 py-3 rounded-2xl bg-[#f2546d] text-white text-sm font-bold"
                            style={dmSans}
                        >
                            Explore Outfits
                        </button>
                    </div>
                )}

                {/* ─── CURRENT RENTALS ─── */}
                {!loading && currentRentals.length > 0 && (
                    <div className="grid grid-cols-2 gap-5 mt-6">
                        {currentRentals.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col"
                            >
                                <div
                                    className="relative z-10 rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                                    style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                                >
                                    <div className="relative aspect-[176/255]">
                                        <img
                                            src={
                                                item.image ||
                                                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80'
                                            }
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div
                                            className="absolute bottom-0 left-0 right-0 h-[45px]"
                                            style={{
                                                backdropFilter: 'blur(4.6px)',
                                                WebkitBackdropFilter: 'blur(4.6px)',
                                                background:
                                                    'linear-gradient(180deg, rgba(17,17,17,0) 0%, rgba(17,17,17,1) 100%)',
                                            }}
                                        />
                                        <div className="absolute top-3 left-3 flex items-center gap-2">
                                            <CountdownIcon />
                                            <span
                                                className="text-sm font-semibold text-white tracking-[-0.42px]"
                                                style={dmSans}
                                            >
                                                {item.isInTransit 
                                                    ? 'In Transit'
                                                    : (item.daysLeft ?? 0) > 0
                                                        ? `${item.daysLeft}d ${item.hoursLeft}h Left`
                                                        : `${item.hoursLeft}h ${item.minutesLeft}m Left`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-[#484848]" />

                                    <div className="px-4 py-3">
                                        <h3
                                            className="text-sm font-semibold text-white tracking-[-0.42px]"
                                            style={dmSans}
                                        >
                                            {item.title}
                                        </h3>

                                        {!item.returnToday && (
                                            <>
                                                <p
                                                    className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-1"
                                                    style={dmSans}
                                                >
                                                    {item.dateRange}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span
                                                        className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                                        style={dmSans}
                                                    >
                                                        ₹ {item.currentPrice}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Keep it button */}
                                <button
                                    onClick={() => !item.isInTransit && handleKeepIt(item.id)}
                                    disabled={item.isInTransit}
                                    className={`-mt-[48px] h-[89px] rounded-2xl border flex items-end justify-center pb-3 cursor-pointer active:scale-[0.98] transition-all ${
                                        item.isInTransit ? 'bg-zinc-800 border-zinc-700 opacity-50' : 'bg-[#f2546d] border-[#ff8597]'
                                    }`}
                                >
                                    <span
                                        className="text-sm text-white leading-[14px]"
                                        style={dmSans}
                                    >
                                        <span className="font-semibold tracking-[-0.06px]">
                                            {item.isInTransit ? 'Arriving Soon' : 'Keep it for:'}{' '}
                                        </span>
                                        {!item.isInTransit && (
                                            <span className="font-black tracking-[-0.06px]">
                                                ₹ {Math.round(item.currentPrice * 0.7)}
                                            </span>
                                        )}
                                    </span>
                                </button>

                                {item.isDelivered && (
                                    <button
                                        onClick={() => navigate(`/schedule-return?orderId=${item.id}`)}
                                        className="w-full mt-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-all"
                                    >
                                        <span
                                            className="text-sm font-semibold text-zinc-300 tracking-[-0.42px]"
                                            style={dmSans}
                                        >
                                            Schedule Return
                                        </span>
                                    </button>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* FUTURE BOOKINGS HIDDEN PER USER REQUEST */}
            </main>
        </div>
    );
};

export default ClosetPage;
