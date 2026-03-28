import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, CalendarDays, Package } from 'lucide-react';

import { MobileShell } from '@/components/layout/MobileShell';
import { getAvailableTimeSlots, type TimeSlot } from '@/services/deliveryService';
import { useCart } from '@/context/CartContext';
import type { ValidatedAddress } from '@/services/addressService';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

const buildSlotIso = (slot: TimeSlot) =>
    new Date(`${slot.date}T${slot.start}:00+05:30`).toISOString();

const CheckoutReturnSchedulePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedAddress = location.state?.selectedAddress as ValidatedAddress | undefined;

    const { cartItems } = useCart();
    const [selectedSlotIso, setSelectedSlotIso] = useState<string>('');

    // Derive rental duration from the first cart item's plan
    const rentalDays = useMemo(() => {
        const entries = Object.entries(cartItems);
        if (entries.length === 0) return 3;
        const firstPlan = entries[0][1].plan;
        return firstPlan === '1d' ? 1 : firstPlan === '2d' ? 2 : firstPlan === 'buy' ? 0 : 3;
    }, [cartItems]);

    // Get time slots starting after rental period ends, show 4-day window
    const slotGroups = useMemo(
        () => getAvailableTimeSlots(rentalDays).slice(0, 1),
        [rentalDays]
    );

    const selectedSlot = useMemo(() => {
        for (const group of slotGroups) {
            const match = group.slots.find((slot) => buildSlotIso(slot) === selectedSlotIso);
            if (match) return match;
        }
        return null;
    }, [selectedSlotIso, slotGroups]);

    const handleConfirm = () => {
        if (!selectedSlotIso) return;
        navigate('/checkout', {
            state: {
                selectedAddress,
                returnSchedule: { pickupSlotIso: selectedSlotIso },
            },
        });
    };

    // If no address was passed, redirect back
    if (!selectedAddress) {
        return (
            <MobileShell className="bg-[#111111] text-white flex flex-col items-center justify-center px-6">
                <p className="text-zinc-400 mb-6">No delivery address selected</p>
                <button
                    onClick={() => navigate('/checkout/address')}
                    className="px-6 py-3 bg-[#f2546d] rounded-2xl font-bold"
                >
                    Select Address
                </button>
            </MobileShell>
        );
    }

    return (
        <MobileShell className="bg-[#111111] text-white">
            {/* Background glow */}
            <div className="pointer-events-none absolute top-[-60px] left-[-32px] w-[145px] h-[137px] rounded-full blur-[180px] bg-[#f2546d]/60" />

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg flex items-center gap-4 px-5 pt-16 pb-4">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center transition-all active:scale-95"
                >
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold tracking-[-0.72px]" style={dmSans}>
                        Schedule Your Return
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Pre-schedule a return pickup slot for after your rental.
                    </p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-5 pb-28 space-y-8">
                {/* Delivery address info card (read-only) */}
                <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-[#f2546d]" />
                        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">
                            Return Pickup Location
                        </h3>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        {selectedAddress.formattedAddress}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <Package className="w-3.5 h-3.5 text-zinc-500" />
                        <p className="text-xs text-zinc-500">
                            Same as your delivery address — rider will pick up from here
                        </p>
                    </div>
                </section>

                {/* Rental info */}
                {rentalDays > 0 && (
                    <section className="rounded-[24px] border border-[#f2546d]/20 bg-[#f2546d]/5 p-4">
                        <div className="flex items-start gap-3">
                            <CalendarDays className="w-5 h-5 text-[#f2546d] mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-white">
                                    {rentalDays}-day rental plan
                                </p>
                                <p className="text-sm text-zinc-300 mt-1">
                                    Return slots start from day {rentalDays} after delivery.
                                    Select a convenient time below.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Slot picker */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <CalendarDays className="w-4 h-4 text-[#f2546d]" />
                        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">
                            Pickup Slot
                        </h3>
                    </div>

                    <div className="space-y-5">
                        {slotGroups.map((group) => (
                            <div key={group.date}>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-3">
                                    {format(new Date(`${group.date}T00:00:00`), 'EEE, dd MMM')}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {group.slots.map((slot) => {
                                        const slotIso = buildSlotIso(slot);
                                        const isSelected = slotIso === selectedSlotIso;

                                        return (
                                            <motion.button
                                                key={slotIso}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedSlotIso(slotIso)}
                                                className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                                                    isSelected
                                                        ? 'bg-[#f2546d] border-[#ff8597] text-white'
                                                        : 'bg-white/[0.03] border-white/10 text-zinc-300'
                                                }`}
                                            >
                                                <p className="text-sm font-semibold">
                                                    {slot.start} - {slot.end}
                                                </p>
                                                <p className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-zinc-500'}`}>
                                                    Return pickup
                                                </p>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Selected summary */}
                {selectedSlot && (
                    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
                            Selected Return Pickup
                        </p>
                        <p className="text-white font-semibold">
                            {format(new Date(`${selectedSlot.date}T00:00:00`), 'EEE, dd MMM')} •{' '}
                            {selectedSlot.start} - {selectedSlot.end}
                        </p>
                    </section>
                )}
            </main>

            {/* CTA */}
            <div className="sticky bottom-0 px-5 py-6 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent">
                <button
                    disabled={!selectedSlotIso}
                    onClick={handleConfirm}
                    className="w-full h-14 rounded-2xl bg-[#f2546d] flex items-center justify-center gap-3 shadow-lg shadow-[#f2546d]/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    <span className="text-lg font-bold text-white">Confirm Return Slot</span>
                </button>
            </div>
        </MobileShell>
    );
};

export default CheckoutReturnSchedulePage;
