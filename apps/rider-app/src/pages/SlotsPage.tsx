/**
 * Slots Page
 * 
 * Calendar view for booking delivery slots
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Zap, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';

import {
    getAvailableSlots,
    getRiderSlotsForDate,
    bookSlot,
    cancelSlot,
    type TimeSlot,
    type RiderSlot
} from '../services/slotsService';

export function SlotsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [bookedSlots, setBookedSlots] = useState<RiderSlot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

    // Generate week days
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    useEffect(() => {
        if (user?.id) {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            setIsLoading(true);

            Promise.all([
                getAvailableSlots(dateStr),
                getRiderSlotsForDate(user.id, dateStr),
            ]).then(([slots, booked]) => {
                setAvailableSlots(slots);
                setBookedSlots(booked);
                setIsLoading(false);
            });
        }
    }, [user?.id, selectedDate]);

    const handlePrevWeek = () => {
        setWeekStart(addDays(weekStart, -7));
    };

    const handleNextWeek = () => {
        setWeekStart(addDays(weekStart, 7));
    };

    const handleBookSlot = async (slotId: string) => {
        if (!user?.id) return;

        setBookingSlotId(slotId);
        const result = await bookSlot(user.id, slotId);

        if (result.success && result.booking) {
            setBookedSlots([...bookedSlots, result.booking]);
            setAvailableSlots(slots =>
                slots.map(s => s.id === slotId
                    ? { ...s, bookedCount: s.bookedCount + 1, isAvailable: s.bookedCount + 1 < s.maxRiders }
                    : s
                )
            );
        }
        setBookingSlotId(null);
    };

    const handleCancelSlot = async (bookingId: string, slotId: string) => {
        if (!user?.id) return;

        const result = await cancelSlot(user.id, bookingId);
        if (result.success) {
            setBookedSlots(slots => slots.filter(s => s.id !== bookingId));
            setAvailableSlots(slots =>
                slots.map(s => s.id === slotId
                    ? { ...s, bookedCount: Math.max(0, s.bookedCount - 1), isAvailable: true }
                    : s
                )
            );
        }
    };

    const isSlotBooked = (slotId: string) =>
        bookedSlots.some(b => b.slotId === slotId);

    const getBookingForSlot = (slotId: string) =>
        bookedSlots.find(b => b.slotId === slotId);

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    return (
        <div className="min-h-screen bg-black flex justify-center">
        <div className="w-full max-w-[430px] sm:max-w-[540px] md:max-w-[768px] min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Book Slots</h1>
                </div>

                {/* Week navigation */}
                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handlePrevWeek}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm text-zinc-400">
                            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <button
                            onClick={handleNextWeek}
                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Day selector */}
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const isPast = day < new Date() && !isToday;

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => !isPast && setSelectedDate(day)}
                                    disabled={isPast}
                                    className={clsx(
                                        "flex flex-col items-center py-2 rounded-xl transition-colors",
                                        isSelected && "bg-blue-500",
                                        !isSelected && !isPast && "hover:bg-zinc-800",
                                        isPast && "opacity-40 cursor-not-allowed"
                                    )}
                                >
                                    <span className={clsx(
                                        "text-xs",
                                        isSelected ? "text-blue-100" : "text-zinc-500"
                                    )}>
                                        {format(day, 'EEE')}
                                    </span>
                                    <span className={clsx(
                                        "text-lg font-semibold",
                                        isSelected ? "text-white" : "text-zinc-300"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    {isToday && !isSelected && (
                                        <span className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            <main className="px-4 py-4 space-y-3">
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                        Available
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                        Booked
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="w-3 h-3 rounded-full bg-zinc-600" />
                        Full
                    </div>
                </div>

                {isLoading ? (
                    // Loading skeleton
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 rounded-xl bg-zinc-900 animate-pulse" />
                        ))}
                    </div>
                ) : availableSlots.length === 0 ? (
                    // Empty state
                    <div className="text-center py-12">
                        <Clock size={48} className="text-zinc-700 mx-auto mb-4" />
                        <h3 className="text-white font-medium mb-1">No slots available</h3>
                        <p className="text-zinc-500 text-sm">Check back later for new slots</p>
                    </div>
                ) : (
                    // Slots list
                    availableSlots.map((slot, index) => {
                        const isBooked = isSlotBooked(slot.id);
                        const booking = getBookingForSlot(slot.id);
                        const isBooking = bookingSlotId === slot.id;

                        return (
                            <motion.div
                                key={slot.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={clsx(
                                    "relative rounded-xl p-4 border transition-colors",
                                    isBooked
                                        ? "bg-blue-500/10 border-blue-500/30"
                                        : slot.isAvailable
                                            ? "bg-zinc-900 border-zinc-800"
                                            : "bg-zinc-900 border-zinc-800 opacity-50"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-full flex items-center justify-center",
                                            isBooked ? "bg-blue-500" : "bg-zinc-800"
                                        )}>
                                            <Clock size={18} className={isBooked ? "text-white" : "text-zinc-400"} />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">
                                                {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {slot.bookedCount}/{slot.maxRiders} riders booked
                                            </p>
                                        </div>
                                    </div>

                                    {/* Incentive badge */}
                                    {slot.incentiveMultiplier > 1 && (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                                            <Zap size={12} />
                                            {slot.incentiveMultiplier}x
                                        </div>
                                    )}

                                    {/* Action button */}
                                    {isBooked ? (
                                        <button
                                            onClick={() => booking && handleCancelSlot(booking.id, slot.id)}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
                                        >
                                            <Check size={16} />
                                            Booked
                                        </button>
                                    ) : slot.isAvailable ? (
                                        <button
                                            onClick={() => handleBookSlot(slot.id)}
                                            disabled={isBooking}
                                            className={clsx(
                                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                                "bg-blue-500 text-white hover:bg-blue-600",
                                                isBooking && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {isBooking ? 'Booking...' : 'Book'}
                                        </button>
                                    ) : (
                                        <span className="px-4 py-2 text-sm text-zinc-600">Full</span>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </main>
        </div>
        </div>
    );
}

export default SlotsPage;
