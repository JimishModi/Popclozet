// src/components/DateRangePicker.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDates: (start: Date, end: Date) => void;
    unavailableDates?: Date[];
    minDays?: number;
    maxDays?: number;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DateRangePicker({
    isOpen,
    onClose,
    onSelectDates,
    unavailableDates = [],
    minDays = 1,
    maxDays = 14,
}: DateRangePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: (Date | null)[] = [];

        // Add empty slots for days before the first day
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add all days in the month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const isDateUnavailable = (date: Date) => {
        return unavailableDates.some(
            (unavailable) =>
                unavailable.getFullYear() === date.getFullYear() &&
                unavailable.getMonth() === date.getMonth() &&
                unavailable.getDate() === date.getDate()
        );
    };

    const isDateInRange = (date: Date) => {
        if (!startDate) return false;
        const end = endDate || hoverDate;
        if (!end) return false;

        const start = startDate < end ? startDate : end;
        const finish = startDate < end ? end : startDate;

        return date >= start && date <= finish;
    };

    const isDateSelected = (date: Date) => {
        if (!startDate && !endDate) return false;
        return (
            (startDate && date.toDateString() === startDate.toDateString()) ||
            (endDate && date.toDateString() === endDate.toDateString())
        );
    };

    const isPastDate = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    const handleDateClick = (date: Date) => {
        if (isPastDate(date) || isDateUnavailable(date)) return;

        if (!startDate || (startDate && endDate)) {
            // Start new selection
            setStartDate(date);
            setEndDate(null);
        } else {
            // Complete selection
            if (date < startDate) {
                setEndDate(startDate);
                setStartDate(date);
            } else {
                setEndDate(date);
            }
        }
    };

    const handleConfirm = () => {
        if (startDate && endDate) {
            onSelectDates(startDate, endDate);
            onClose();
        }
    };

    const goToPrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const getRentalDays = () => {
        if (!startDate || !endDate) return 0;
        const diff = endDate.getTime() - startDate.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    };

    const days = getDaysInMonth(currentMonth);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal - Bottom sheet on mobile, centered on desktop */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-md md:rounded-3xl rounded-t-3xl bg-background shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-bold">Select Rental Dates</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Month Navigation */}
                        <div className="flex items-center justify-between p-4">
                            <button
                                onClick={goToPrevMonth}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                                aria-label="Previous month"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-semibold">
                                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </h3>
                            <button
                                onClick={goToNextMonth}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                                aria-label="Next month"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-1 px-4">
                            {DAYS.map((day) => (
                                <div
                                    key={day}
                                    className="text-center text-xs font-medium text-muted-foreground py-2"
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1 p-4">
                            {days.map((date, idx) => {
                                if (!date) {
                                    return <div key={`empty-${idx}`} className="aspect-square" />;
                                }

                                const isPast = isPastDate(date);
                                const isUnavailable = isDateUnavailable(date);
                                const isSelected = isDateSelected(date);
                                const isInRange = isDateInRange(date);
                                const isDisabled = isPast || isUnavailable;

                                return (
                                    <button
                                        key={date.toISOString()}
                                        onClick={() => handleDateClick(date)}
                                        onMouseEnter={() => !isDisabled && setHoverDate(date)}
                                        onMouseLeave={() => setHoverDate(null)}
                                        disabled={isDisabled}
                                        className={cn(
                                            "aspect-square rounded-xl text-sm font-medium transition-all",
                                            "flex items-center justify-center",
                                            isDisabled && "opacity-30 cursor-not-allowed",
                                            isSelected && "bg-primary text-primary-foreground",
                                            isInRange && !isSelected && "bg-primary/20",
                                            !isDisabled && !isSelected && !isInRange && "hover:bg-muted",
                                            isUnavailable && "line-through"
                                        )}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selection Summary */}
                        <div className="p-4 border-t border-border">
                            {startDate && endDate ? (
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Selected</p>
                                        <p className="font-semibold">
                                            {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            {" - "}
                                            {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Duration</p>
                                        <p className="font-semibold text-primary">{getRentalDays()} days</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center mb-4">
                                    {startDate ? "Select end date" : "Select start date"}
                                </p>
                            )}

                            <motion.button
                                onClick={handleConfirm}
                                disabled={!startDate || !endDate}
                                className={cn(
                                    "w-full py-4 rounded-xl font-bold text-base transition-all",
                                    "flex items-center justify-center gap-2",
                                    "min-h-[56px]",
                                    startDate && endDate
                                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl"
                                        : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                                whileHover={startDate && endDate ? { scale: 1.02 } : {}}
                                whileTap={startDate && endDate ? { scale: 0.98 } : {}}
                            >
                                <Check className="w-5 h-5" />
                                Confirm Dates
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
