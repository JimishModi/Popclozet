import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Loader2, MapPin, X, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/SupabaseAuthContext';
import { useCart } from '@/context/CartContext';
import { getMyActiveRentals } from '@/services/ordersService';
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
    hasPreScheduledReturn?: boolean;
    returnPickupDate?: string | null;
    returnTimeSlot?: string | null;
    hoursLeft?: number;
    minutesLeft?: number;
}

/* Clock/countdown icon */
const CountdownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" />
        <path d="M12 7v5l3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ClosetPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { totalItems } = useCart();
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
            const activeOrders = await getMyActiveRentals();

            const mapped: RentalItem[] = activeOrders.map((order: any) => {
                const firstItem = order.order_items?.[0]?.item;
                const now = new Date();
                const rentalEndTime = order.rental_end_date ? new Date(order.rental_end_date) : null;
                const timeInfo = rentalEndTime ? getRemainingRentalTime(order.rental_end_date) : { expired: false, days: 3, hours: 0, minutes: 0 };

                const isDelivered = ['delivered', 'in_use'].includes(order.status);
                const isInTransit = ['out_for_delivery', 'dispatched'].includes(order.status);
                const isReturnInProgress = [
                    'return_requested', 'return_scheduled', 'return_dispatched',
                    'return_picked_up', 'return_at_warehouse', 'returned',
                ].includes(order.status);

                const type = (isDelivered || isInTransit || isReturnInProgress) ? 'current' : 'future';
                let dateRange = 'Dates TBD';
                if (order.rental_start_date && order.rental_end_date) {
                    dateRange = `${format(new Date(order.rental_start_date), 'd MMM')} - ${format(new Date(order.rental_end_date), 'd MMM')}`;
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
                    isInTransit,
                    isDelivered,
                    isReturnInProgress,
                    hasPreScheduledReturn: !!(order.return_pickup_date && isDelivered),
                    returnPickupDate: order.return_pickup_date,
                    returnTimeSlot: order.return_time_slot,
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

    const inClosetItems = rentals.filter(r => r.isDelivered && !r.isReturnInProgress);
    const arrivingItems = rentals.filter(r => r.isInTransit);
    const returningItems = rentals.filter(r => r.isReturnInProgress);

    const handleKeepIt = (orderId: string) => {
        navigate(`/checkout?buyoutOrderId=${orderId}`);
    };

    const renderCard = (item: RentalItem) => (
        <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-shrink-0 w-[280px] snap-start flex flex-col"
        >
            <div
                className="relative z-10 rounded-3xl border border-white/5 bg-zinc-900 overflow-hidden shadow-2xl"
                style={{ backdropFilter: 'blur(10px)' }}
            >
                <div className="relative aspect-[4/5]">
                    <img
                        src={item.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
                        <CountdownIcon />
                        <span className="text-xs font-bold text-white uppercase tracking-wider" style={dmSans}>
                            {item.isInTransit 
                                ? 'Arriving' 
                                : item.returnToday ? 'Return Today' : `${item.daysLeft}d left`}
                        </span>
                    </div>

                    {/* Multi-item Badge */}
                    {item.itemCount && item.itemCount > 1 && (
                        <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-black text-white uppercase tracking-tighter">
                            +{item.itemCount - 1} more items
                        </div>
                    )}
                </div>

                <div className="p-5">
                    <h3 className="text-base font-bold text-white truncate" style={dmSans}>{item.title}</h3>
                    <p className="text-xs text-zinc-500 mt-1" style={dmSans}>{item.dateRange}</p>
                </div>
            </div>

            {/* Buyout button - overlapping */}
            <button
                onClick={() => !item.isInTransit && handleKeepIt(item.id)}
                disabled={item.isInTransit}
                className={`-mt-10 mx-5 h-20 rounded-2xl border-2 flex items-end justify-center pb-4 transition-all active:scale-95 shadow-xl ${
                    item.isInTransit 
                        ? 'bg-zinc-800 border-zinc-700 opacity-50' 
                        : 'bg-gradient-to-r from-[#f2546d] to-pink-600 border-[#ff8597]'
                }`}
            >
                <div className="text-center">
                    <span className="block text-[10px] font-black uppercase text-white/70 tracking-widest leading-none mb-1">Buyout Price</span>
                    <span className="text-lg font-black text-white" style={dmSans}>₹ {Math.round(item.currentPrice * 0.7)}</span>
                </div>
            </button>

            {/* Bottom Actions */}
            <div className="px-5 mt-4">
                {item.isDelivered && (
                    <button
                        onClick={() => navigate(`/pickup-tracking/${item.id}`)}
                        className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-white/10"
                        style={dmSans}
                    >
                        <MapPin className="w-4 h-4 text-zinc-400" />
                        Track Return
                    </button>
                )}

                {(item.type === 'future' || item.isInTransit || item.isReturnInProgress) && !item.isDelivered && (
                    <button
                        onClick={() => navigate(item.isReturnInProgress ? `/pickup-tracking/${item.id}` : `/tracking/${item.id}`)}
                        className="w-full py-4 rounded-2xl bg-[#f2546d]/10 border border-[#f2546d]/20 text-[#f2546d] text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                        style={dmSans}
                    >
                        <MapPin className="w-4 h-4" />
                        {item.isReturnInProgress ? 'Track Return' : 'Track Delivery'}
                    </button>
                )}
            </div>
        </motion.div>
    );

    const renderSection = (title: string, items: RentalItem[]) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-12">
                <div className="flex items-center justify-between px-4 mb-5">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black text-white" style={dmSans}>{title}</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-500">{items.length}</span>
                    </div>
                </div>
                <div className="flex gap-4 overflow-x-auto px-4 no-scrollbar pb-4 snap-x snap-mandatory">
                    {items.map(renderCard)}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#111111] text-white min-h-screen relative overflow-x-hidden">
            {/* ─── Background Gradients ─── */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#f2546d]/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-40 left-0 w-80 h-80 bg-purple-600/10 blur-[120px] pointer-events-none" />

            {/* ─── HEADER ─── */}
            <div className="sticky top-0 z-50 px-4 py-4 backdrop-blur-md bg-black/20 flex items-center justify-between">
                <h1 className="text-2xl font-black text-white tracking-tighter" style={dmSans}>My Closet</h1>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/wishlist')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <Heart className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={() => navigate('/cart')} className="relative w-10 h-10 rounded-full bg-[#f2546d] flex items-center justify-center shadow-lg shadow-[#f2546d]/30">
                        <ShoppingBag className="w-5 h-5 text-white" />
                        {totalItems > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold text-black bg-white rounded-full">
                                {totalItems}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <main className="pt-4 pb-28">
                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-32">
                        <Loader2 className="w-10 h-10 text-[#f2546d] animate-spin mb-4" />
                        <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">Checking your outfits...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && rentals.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center px-10">
                        <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                            <ShoppingBag className="w-10 h-10 text-zinc-700" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2" style={dmSans}>Your Closet is Empty</h2>
                        <p className="text-zinc-500 mb-8" style={dmSans}>Ready to find your next favorite outfit? Let's go!</p>
                        <button
                            onClick={() => navigate('/collections')}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-600 text-white font-black text-lg shadow-xl shadow-[#f2546d]/20"
                            style={dmSans}
                        >
                            Explore Collections
                        </button>
                    </div>
                )}

                {/* Sections */}
                {!loading && (
                    <>
                        {renderSection("In Your Closet", inClosetItems)}
                        {renderSection("Arriving Soon", arrivingItems)}
                        {renderSection("Returning", returningItems)}
                    </>
                )}

                {/* Browse More */}
                {!loading && rentals.length > 0 && (
                    <div className="px-4 mt-8">
                        <button 
                            onClick={() => navigate('/collections')}
                            className="w-full p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between group active:scale-95 transition-all"
                        >
                            <div>
                                <h3 className="text-lg font-bold text-white text-left" style={dmSans}>Need more space?</h3>
                                <p className="text-sm text-zinc-500 mt-1">Explore our latest arrivals</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-[#f2546d]/10 flex items-center justify-center group-hover:bg-[#f2546d]/20 transition-all">
                                <ChevronRight className="w-6 h-6 text-[#f2546d]" />
                            </div>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ClosetPage;
