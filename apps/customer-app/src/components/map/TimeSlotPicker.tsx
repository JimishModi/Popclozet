// src/components/map/TimeSlotPicker.tsx
// Delivery time slot picker component

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAvailableTimeSlots, TimeSlot } from '@/services/deliveryService';
import { cn } from '@/lib/utils';

interface TimeSlotPickerProps {
    onSelect: (slot: TimeSlot) => void;
    selectedSlot?: TimeSlot | null;
    className?: string;
}

export function TimeSlotPicker({
    onSelect,
    selectedSlot,
    className,
}: TimeSlotPickerProps) {
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // Generate dates for next 7 days
    const dates = useMemo(() => {
        const result: { date: string; label: string; dayName: string }[] = [];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);

            const dateStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            result.push({ date: dateStr, label, dayName });
        }

        return result;
    }, []);

    // Get all time slots grouped by date
    const timeSlotsData = useMemo(() => {
        return getAvailableTimeSlots();
    }, []);

    // Filter slots for selected date
    const slotsForDate = useMemo(() => {
        const dayData = timeSlotsData.find(d => d.date === selectedDate);
        return dayData?.slots || [];
    }, [timeSlotsData, selectedDate]);

    const selectedDateIndex = dates.findIndex(d => d.date === selectedDate);

    const handlePrevDate = () => {
        if (selectedDateIndex > 0) {
            setSelectedDate(dates[selectedDateIndex - 1].date);
        }
    };

    const handleNextDate = () => {
        if (selectedDateIndex < dates.length - 1) {
            setSelectedDate(dates[selectedDateIndex + 1].date);
        }
    };

    const isSelected = (slot: TimeSlot) => {
        return selectedSlot?.date === slot.date &&
            selectedSlot?.start === slot.start &&
            selectedSlot?.end === slot.end;
    };

    const formatSlotLabel = (slot: TimeSlot) => {
        return `${slot.start} - ${slot.end}`;
    };

    return (
        <div className={cn('', className)}>
            {/* Date selector */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={handlePrevDate}
                    disabled={selectedDateIndex === 0}
                    className="p-2 rounded-full hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-5 h-5 text-zinc-400" />
                </button>

                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {dates.map((d) => (
                        <button
                            key={d.date}
                            onClick={() => setSelectedDate(d.date)}
                            className={cn(
                                'flex flex-col items-center px-3 py-2 rounded-xl min-w-[60px] transition-colors',
                                selectedDate === d.date
                                    ? 'bg-[#ff4d6d] text-white'
                                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
                            )}
                        >
                            <span className="text-[10px] font-medium uppercase">{d.dayName}</span>
                            <span className="text-sm font-bold">{d.label}</span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleNextDate}
                    disabled={selectedDateIndex === dates.length - 1}
                    className="p-2 rounded-full hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="w-5 h-5 text-zinc-400" />
                </button>
            </div>

            {/* Time slots */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-500 font-medium">Available Slots</span>
                </div>

                {slotsForDate.length === 0 ? (
                    <div className="text-center py-6">
                        <Calendar className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-sm text-zinc-500">No slots available for this date</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {slotsForDate.map((slot, idx) => (
                            <motion.button
                                key={`${slot.date}-${slot.start}-${idx}`}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onSelect(slot)}
                                className={cn(
                                    'p-3 rounded-xl border text-left transition-all',
                                    isSelected(slot)
                                        ? 'bg-[#ff4d6d]/10 border-[#ff4d6d] text-white'
                                        : 'bg-zinc-800/50 border-zinc-700 text-white hover:border-zinc-600'
                                )}
                            >
                                <p className="text-sm font-semibold">{formatSlotLabel(slot)}</p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">
                                    Available
                                </p>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default TimeSlotPicker;
