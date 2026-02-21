import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
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

/* Clock/countdown icon */
const CountdownIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" />
        <path d="M12 7v5l3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ClosetPage: React.FC = () => {
    const navigate = useNavigate();

    const currentRentals = MOCK_RENTALS.filter((item) => item.type === 'current');
    const futureRentals = MOCK_RENTALS.filter((item) => item.type === 'future');

    return (
        <MobileShell className="bg-[#111111] text-white">
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
                    <button className="w-10 h-10 rounded-full bg-[#303135] flex items-center justify-center">
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

                {/* ─── CURRENT RENTALS ─── */}
                <div className="grid grid-cols-2 gap-5 mt-6">
                    {currentRentals.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col"
                        >
                            {/* ── Dark card body (sits ON TOP of the pink element via z-10) ── */}
                            <div
                                className="relative z-10 rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                                style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                            >
                                {/* Image area */}
                                <div className="relative aspect-[176/255]">
                                    <img
                                        src={
                                            item.image ||
                                            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80'
                                        }
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Bottom gradient overlay */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-[45px]"
                                        style={{
                                            backdropFilter: 'blur(4.6px)',
                                            WebkitBackdropFilter: 'blur(4.6px)',
                                            background:
                                                'linear-gradient(180deg, rgba(17,17,17,0) 0%, rgba(17,17,17,1) 100%)',
                                        }}
                                    />
                                    {/* Status badge */}
                                    <div className="absolute top-3 left-3 flex items-center gap-2">
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

                                {/* Content below divider */}
                                <div className="px-4 py-3">
                                    <h3
                                        className="text-sm font-semibold text-white tracking-[-0.42px]"
                                        style={dmSans}
                                    >
                                        {item.title}
                                    </h3>

                                    {/* Date + Price — only for non-return cards */}
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
                            </div>

                            {/*
                              ── Pink "Keep it for" element ──
                              Sits BEHIND the dark card, peeking out at the bottom.
                              -mt-[48px] pulls it up behind the card.
                              The card's z-10 ensures it covers the overlap area.
                              flex items-end puts the text at the visible bottom portion.
                            */}
                            <div className="-mt-[48px] h-[89px] rounded-2xl bg-[#f2546d] border border-[#ff8597] flex items-end justify-center pb-3">
                                <span
                                    className="text-sm text-white leading-[14px]"
                                    style={dmSans}
                                >
                                    <span className="font-semibold tracking-[-0.06px]">
                                        Keep it for:{' '}
                                    </span>
                                    <span className="font-black tracking-[-0.06px]">
                                        ₹ {item.originalPrice}
                                    </span>
                                </span>
                            </div>

                            {/*
                              ── "Schedule Return" — separate button, only for Return Today ──
                              Different color (#b93e53) with light pink border (#ffd1d4).
                              Fully rounded, with gap above.
                            */}
                            {item.returnToday && (
                                <button
                                    onClick={() => navigate('/closet/return')}
                                    className="w-full mt-4 py-2.5 rounded-2xl bg-[#b93e53] border border-[#ffd1d4] text-center"
                                >
                                    <span
                                        className="text-sm font-semibold text-white tracking-[-0.42px]"
                                        style={dmSans}
                                    >
                                        Schedule Return
                                    </span>
                                </button>
                            )}
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

                <div className="grid grid-cols-2 gap-5 mt-6">
                    {futureRentals.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-[#484848] bg-[#232323] overflow-hidden"
                            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.50)' }}
                        >
                            {/* Image area */}
                            <div className="relative aspect-[176/255]">
                                <img
                                    src={
                                        item.image ||
                                        'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=400&q=80'
                                    }
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                />
                                {/* Arrival badge */}
                                <div className="absolute top-4 left-8">
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

                            {/* Content */}
                            <div className="px-4 py-3">
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

            <BottomNavBar />
        </MobileShell>
    );
};

export default ClosetPage;
