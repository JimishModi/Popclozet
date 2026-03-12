import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { ChevronLeft, ChevronDown, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

/* ─── Outfit items mock ─── */
interface OutfitItem {
    id: string;
    label: string;
    highlighted?: boolean;
}
const OUTFIT_ITEMS: OutfitItem[] = [
    { id: '1', label: 'Kurta', highlighted: true },
    { id: '2', label: 'Pants' },
    { id: '3', label: 'Vest' },
];

/* ─── Time‑slot mock ─── */
interface TimeSlot {
    id: string;
    label: string;
    discount: number;
}
const TIME_SLOTS: TimeSlot[] = [
    { id: 'a', label: '3 pm - 4 pm', discount: 50 },
    { id: 'b', label: '3 pm - 4 pm', discount: 50 },
    { id: 'c', label: '6 pm - 7 pm', discount: 30 },
    { id: 'd', label: '6 pm - 7 pm', discount: 30 },
    { id: 'e', label: '8 pm - 9 pm', discount: 20 },
    { id: 'f', label: '8 pm - 9 pm', discount: 20 },
];

/* ─── Back‑arrow icon ─── */
const BackArrow = () => (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
        <path d="M8.5 1L1.5 8L8.5 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ScheduleReturnPage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedSlot, setSelectedSlot] = useState<string>('c'); // default 6pm-7pm left
    const [customSlot, setCustomSlot] = useState('3 pm - 4 pm');

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
                            Haldi Outfit
                        </h2>
                        <span
                            className="text-lg font-normal text-[#f2546d] tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            3 Items
                        </span>
                    </div>

                    {/* Item cards row */}
                    <div className="flex gap-2 mt-4">
                        {/* First item - highlighted with accent bg */}
                        <div className="relative w-24 h-36 rounded-lg bg-[#8d303f] overflow-hidden shrink-0">
                            <div className="absolute inset-1 rounded-lg bg-[#313131]" />
                        </div>

                        {/* Remaining items in grey container */}
                        <div className="flex-1 rounded-lg bg-[#232323] p-2 flex gap-2">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="flex-1 h-[104px] rounded-lg bg-[#313131]"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="flex mt-2 ml-[88px] gap-[8px]">
                        {OUTFIT_ITEMS.map((item) => (
                            <span
                                key={item.id}
                                className="flex-1 text-sm font-semibold text-white tracking-[-0.42px] text-center"
                                style={dmSans}
                            >
                                {item.label}
                            </span>
                        ))}
                    </div>
                </section>

                {/* ── Divider ── */}
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
                            className="text-sm font-semibold text-[#8d303f] tracking-[-0.42px]"
                            style={dmSans}
                        >
                            Discounts on prefered slots
                        </span>
                    </div>

                    {/* Time‑slot grid (2 columns × 3 rows) */}
                    <div className="grid grid-cols-2 gap-x-9 gap-y-5 mt-6">
                        {TIME_SLOTS.map((slot) => {
                            const isSelected = selectedSlot === slot.id;
                            return (
                                <motion.div
                                    key={slot.id}
                                    whileTap={{ scale: 0.96 }}
                                    className="relative"
                                >
                                    {/* Discount badge */}
                                    <div className="absolute -top-3 right-0 flex items-center justify-center bg-[#8d303f] rounded-full px-2 py-1 z-10">
                                        <span
                                            className="text-sm font-semibold text-white tracking-[-0.42px]"
                                            style={dmSans}
                                        >
                                            - ₹ {slot.discount}
                                        </span>
                                    </div>

                                    {/* Slot button */}
                                    <button
                                        onClick={() => setSelectedSlot(slot.id)}
                                        className={`w-full h-[42px] rounded-lg border text-center ${isSelected
                                                ? 'bg-[#f2546d] border-[#8d303f]'
                                                : 'bg-[#19191b] border-[#484848]'
                                            }`}
                                    >
                                        <span
                                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                            style={dmSans}
                                        >
                                            {slot.label}
                                        </span>
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Custom slot */}
                    <div className="flex items-center justify-center gap-3 mt-10">
                        <span
                            className="text-lg font-semibold text-[#ff6078] tracking-[-0.54px]"
                            style={dmSans}
                        >
                            Custom Slot :
                        </span>

                        <div className="flex items-center h-[48px] rounded-lg border border-[#5f606a] bg-[#19191b] overflow-hidden">
                            <span
                                className="px-4 text-lg font-semibold text-white tracking-[-0.54px]"
                                style={dmSans}
                            >
                                {customSlot}
                            </span>
                            <div className="w-px h-full bg-[#5f606a]" />
                            <button className="px-3 flex items-center justify-center">
                                <ChevronDown className="w-5 h-3 text-white" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Divider ── */}
                <div className="h-px bg-[#484848] mt-8" />

                {/* ═══════════════ MY INFORMATION ═══════════════ */}
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <h3
                            className="text-lg font-black text-white tracking-[-0.54px]"
                            style={dmSans}
                        >
                            My Information
                        </h3>
                        <Pencil className="w-5 h-5 text-white" />
                    </div>
                    <p
                        className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-3"
                        style={dmSans}
                    >
                        Amogh Shete
                    </p>
                </section>

                {/* ═══════════════ CONTACT DETAILS ═══════════════ */}
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <h3
                            className="text-lg font-black text-white tracking-[-0.54px]"
                            style={dmSans}
                        >
                            Contact Details
                        </h3>
                        <Pencil className="w-5 h-5 text-white" />
                    </div>
                    <p
                        className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-3"
                        style={dmSans}
                    >
                        sheteamogh@gmail.com
                    </p>
                </section>

                {/* ═══════════════ ADDRESS ═══════════════ */}
                <section className="mt-6">
                    <div className="flex items-center justify-between">
                        <h3
                            className="text-lg font-black text-white tracking-[-0.54px]"
                            style={dmSans}
                        >
                            Address
                        </h3>
                        <Pencil className="w-5 h-5 text-white" />
                    </div>
                    <p
                        className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-3 leading-relaxed"
                        style={dmSans}
                    >
                        IIT, Powai
                        <br />
                        400076
                        <br />
                        Mumbai, Maharashtra
                        <br />
                        India
                    </p>
                </section>
            </main>

            {/* ═══════════════ RETURN BUTTON (STICKY) ═══════════════ */}
            <div className="sticky bottom-0 px-5 py-4 bg-[#111111]">
                <button
                    onClick={() => {
                        navigate('/closet');
                    }}
                    className="w-full h-12 rounded-2xl bg-[#f2546d] text-center"
                >
                    <span
                        className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                        style={dmSans}
                    >
                        Return
                    </span>
                </button>
            </div>
        </MobileShell>
    );
};

export default ScheduleReturnPage;
