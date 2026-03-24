import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { Heart, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

interface RentalItem {
    id: string;
    title: string;
    dateRange: string;
    currentPrice: number;
    originalPrice: number;
    daysLeft?: number;
    returnToday?: boolean;
    image?: string;
    type: 'current' | 'future';
    arrivalDays?: number;
}

const MOCK_RENTALS: RentalItem[] = [
    {
        id: '1',
        title: 'Haldi Outfit',
        dateRange: '1 Feb - 2 Feb',
        currentPrice: 699,
        originalPrice: 4000,
        daysLeft: 2,
        type: 'current',
    },
    {
        id: '2',
        title: 'Haldi Outfit',
        dateRange: '1 Feb - 2 Feb',
        currentPrice: 699,
        originalPrice: 4000,
        returnToday: true,
        type: 'current',
    },
    {
        id: '3',
        title: 'Haldi Outfit',
        dateRange: '1 Feb - 2 Feb',
        currentPrice: 699,
        originalPrice: 4000,
        type: 'future',
        arrivalDays: 5,
    },
    {
        id: '4',
        title: 'Haldi Outfit',
        dateRange: '1 Feb - 2 Feb',
        currentPrice: 699,
        originalPrice: 4000,
        type: 'future',
        arrivalDays: 5,
    },
];

/* Small countdown/return icon (inline SVG) */
const CountdownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" />
        <path d="M12 7v5l3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const LiveClosetPage: React.FC = () => {
    const navigate = useNavigate();

    const currentRentals = MOCK_RENTALS.filter((item) => item.type === 'current');
    const futureRentals = MOCK_RENTALS.filter((item) => item.type === 'future');

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
                        className="p-2 rounded-full bg-[#232323]"
                    >
                        <ShoppingBag className="w-5 h-5 text-zinc-400" />
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

                {/* ─── CURRENT RENTALS ─── */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                    {currentRentals.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                        >
                            {/* Image area with gradient overlay */}
                            <div className="relative aspect-[176/250]">
                                <img
                                    src={
                                        item.image ||
                                        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80'
                                    }
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                />
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
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-[#484848]" />

                            {/* Card content */}
                            <div className="p-3">
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
                                            <span
                                                className="text-lg font-semibold text-[#5f606a] tracking-[-0.54px] leading-[21.6px] line-through"
                                                style={dmSans}
                                            >
                                                ₹ {item.originalPrice}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Action button */}
                            <div className="px-3 pb-3">
                                <button className="w-full py-2.5 rounded-xl bg-[#f2546d] text-center">
                                    <span
                                        className="text-sm font-semibold text-white tracking-[-0.42px]"
                                        style={dmSans}
                                    >
                                        {item.returnToday
                                            ? 'Schedule Return'
                                            : `Keep it for: ₹ ${item.originalPrice}`}
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* ─── FUTURE BOOKINGS ─── */}
                <h2
                    className="text-2xl font-semibold text-white tracking-[-0.72px] mt-10"
                    style={dmSans}
                >
                    Future Bookings
                </h2>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    {futureRentals.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                        >
                            {/* Image area */}
                            <div className="relative aspect-[176/250]">
                                <img
                                    src={
                                        item.image ||
                                        'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400&q=80'
                                    }
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                />

                                {/* Arrival Badge */}
                                <div className="absolute top-3 left-3">
                                    <span
                                        className="text-sm font-semibold text-[#ff6078] tracking-[-0.42px]"
                                        style={dmSans}
                                    >
                                        Arriving in {item.arrivalDays} Days
                                    </span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-[#484848]" />

                            {/* Card content */}
                            <div className="p-3">
                                <h3
                                    className="text-sm font-semibold text-white tracking-[-0.42px]"
                                    style={dmSans}
                                >
                                    {item.title}
                                </h3>
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
                                    <span
                                        className="text-lg font-semibold text-[#5f606a] tracking-[-0.54px] leading-[21.6px] line-through"
                                        style={dmSans}
                                    >
                                        ₹ {item.originalPrice}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </main>
        </MobileShell>
    );
};

export default LiveClosetPage;
