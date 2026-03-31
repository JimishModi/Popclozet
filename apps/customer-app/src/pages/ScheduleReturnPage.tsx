import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, CalendarDays, Loader2, CheckCircle2, Plus, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { MobileShell } from '@/components/layout/MobileShell';
import {
    getOrderById,
    getMySavedAddresses,
    scheduleReturn,
    requestImmediateReturn,
    type SavedAddressRecord,
} from '@/services/ordersService';
import { getAvailableTimeSlots, type TimeSlot } from '@/services/deliveryService';

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

interface OrderItemCard {
    id: string;
    size?: string | null;
    product?: {
        name?: string;
        images?: string[] | null;
    } | null;
}

const buildSlotIso = (slot: TimeSlot) => new Date(`${slot.date}T${slot.start}:00+05:30`).toISOString();

const ScheduleReturnPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');

    const [order, setOrder] = useState<any>(null);
    const [addresses, setAddresses] = useState<SavedAddressRecord[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedSlotIso, setSelectedSlotIso] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [returnNowSubmitting, setReturnNowSubmitting] = useState(false);

    const slotGroups = useMemo(() => getAvailableTimeSlots().slice(0, 4), []);
    const selectedSlot = useMemo(() => {
        for (const group of slotGroups) {
            const match = group.slots.find((slot) => buildSlotIso(slot) === selectedSlotIso);
            if (match) return match;
        }
        return null;
    }, [selectedSlotIso, slotGroups]);

    useEffect(() => {
        if (!orderId) {
            toast.error('No order selected for return');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                const [orderData, addressData] = await Promise.all([
                    getOrderById(orderId),
                    getMySavedAddresses(),
                ]);

                if (cancelled) return;

                setOrder(orderData);
                setAddresses(addressData);

                const defaultAddress =
                    addressData.find((address) => address.id === orderData?.delivery_address?.id) ??
                    addressData.find((address) => address.is_default) ??
                    addressData[0];

                setSelectedAddressId(defaultAddress?.id ?? '');

                const firstSlot = slotGroups[0]?.slots[0];
                if (firstSlot) {
                    setSelectedSlotIso(buildSlotIso(firstSlot));
                }
            } catch (error) {
                console.error('Failed to load schedule return data:', error);
                toast.error('Failed to load return details');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [orderId, slotGroups]);

    const handleReturnNow = async () => {
        if (!orderId) return;
        if (!selectedAddressId) {
            toast.error('Select a pickup address first');
            return;
        }
        try {
            setReturnNowSubmitting(true);
            await requestImmediateReturn(orderId, selectedAddressId || null);
            toast.success('Immediate return requested — a rider will be assigned shortly');
            navigate(`/pickup-tracking/${orderId}`);
        } catch (error: any) {
            console.error('Return Now error:', error);
            toast.error(error?.message || 'Failed to request immediate return');
        } finally {
            setReturnNowSubmitting(false);
        }
    };

    const handleScheduleReturn = async () => {
        if (!orderId) return;
        if (!selectedAddressId) {
            toast.error('Select a pickup address');
            return;
        }
        if (!selectedSlotIso) {
            toast.error('Select a pickup slot');
            return;
        }

        try {
            setSubmitting(true);
            await scheduleReturn(orderId, selectedAddressId, selectedSlotIso);
            toast.success('Return pickup scheduled');
            navigate(`/pickup-tracking/${orderId}`);
        } catch (error: any) {
            console.error('Schedule return error:', error);
            toast.error(error?.message || 'Failed to schedule return');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white flex items-center justify-center">
                <div className="w-9 h-9 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
            </MobileShell>
        );
    }

    if (!order) {
        return (
            <MobileShell className="bg-[#111111] text-white flex flex-col items-center justify-center px-6">
                <p className="text-zinc-400 mb-6">Order not found</p>
                <button
                    onClick={() => navigate('/closet')}
                    className="px-6 py-3 bg-[#f2546d] rounded-2xl font-bold"
                >
                    Back to Closet
                </button>
            </MobileShell>
        );
    }

    const orderItems = (order.order_items ?? []) as OrderItemCard[];
    const heroImage = orderItems[0]?.product?.images?.[0];
    const itemsCount = orderItems.length;
    const orderStatus = order.status ?? 'unknown';
    const eligibleStatuses = ['delivered', 'in_use'];
    const canSchedule = eligibleStatuses.includes(orderStatus);

    return (
        <MobileShell className="bg-[#111111] text-white">
            <div className="pointer-events-none absolute top-[-60px] left-[-32px] w-[145px] h-[137px] rounded-full blur-[180px] bg-[#f2546d]/60" />

            <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg flex items-center gap-4 px-5 pt-16 pb-4">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center transition-all active:scale-95"
                >
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div>
                    <h1 className="text-2xl font-semibold tracking-[-0.72px]" style={dmSans}>
                        Schedule Return
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Choose the pickup address and time slot for this return.
                    </p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-5 pb-28 space-y-8">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex gap-4">
                        <div className="w-24 h-32 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                            {heroImage ? (
                                <img src={heroImage} alt={orderItems[0]?.product?.name || 'Return item'} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-zinc-900" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
                                Order #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                            <h2 className="text-xl font-semibold text-white leading-tight" style={dmSans}>
                                {itemsCount > 1 ? `${itemsCount} item return` : orderItems[0]?.product?.name || 'Scheduled return'}
                            </h2>
                            <p className="text-sm text-zinc-400 mt-2">
                                Current status: <span className="text-white">{orderStatus.replace(/_/g, ' ')}</span>
                            </p>
                            {order.return_pickup_date && (
                                <p className="text-xs text-zinc-500 mt-3">
                                    Existing pickup: {format(new Date(order.return_pickup_date), 'dd MMM yyyy')}
                                    {order.return_time_slot ? ` • ${order.return_time_slot}` : ''}
                                </p>
                            )}
                        </div>
                    </div>

                    {itemsCount > 1 && (
                        <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
                            {orderItems.slice(1).map((item) => (
                                <div
                                    key={item.id}
                                    className="w-16 h-20 rounded-xl overflow-hidden bg-zinc-900 border border-white/5 shrink-0"
                                >
                                    {item.product?.images?.[0] ? (
                                        <img src={item.product.images[0]} alt={item.product?.name || 'Item'} className="w-full h-full object-cover" />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {!canSchedule && (
                    <section className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-amber-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-white">Return already in progress</p>
                                <p className="text-sm text-zinc-300 mt-1">
                                    This order can only be scheduled from the delivered or active rental state. Track it from the order timeline instead.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-[#f2546d]" />
                        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">
                            Pickup Address
                        </h3>
                    </div>

                    {addresses.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-center">
                            <p className="text-sm text-zinc-400">No saved address found for pickup.</p>
                            <button
                                onClick={() => navigate('/map')}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f2546d] text-white text-sm font-semibold"
                            >
                                <Plus className="w-4 h-4" />
                                Add Address
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {addresses.map((address) => {
                                const isSelected = selectedAddressId === address.id;
                                return (
                                    <button
                                        key={address.id}
                                        onClick={() => setSelectedAddressId(address.id)}
                                        className={`w-full text-left p-4 rounded-[24px] border transition-all ${
                                            isSelected
                                                ? 'bg-[#f2546d]/10 border-[#f2546d]'
                                                : 'bg-white/[0.03] border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#f2546d]/20 text-[#f2546d]' : 'bg-zinc-900 text-zinc-500'}`}>
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-white">
                                                        {address.label || 'Saved Address'}
                                                    </p>
                                                    {address.is_default ? (
                                                        <span className="text-[10px] uppercase tracking-[0.2em] text-[#f2546d]">
                                                            Default
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="text-sm text-zinc-400 mt-1">
                                                    {address.full_address}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

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
                                                    Pickup window
                                                </p>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {selectedSlot && (
                    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Selected Pickup</p>
                        <p className="text-white font-semibold">
                            {format(new Date(`${selectedSlot.date}T00:00:00`), 'EEE, dd MMM')} • {selectedSlot.start} - {selectedSlot.end}
                        </p>
                    </section>
                )}
            </main>

            <div className="sticky bottom-0 px-5 py-6 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent space-y-3">
                {/* Return Now — immediate pickup, no slot needed */}
                <button
                    disabled={!canSchedule || addresses.length === 0 || !selectedAddressId || returnNowSubmitting || submitting}
                    onClick={handleReturnNow}
                    className="w-full h-14 rounded-2xl bg-white/5 border border-[#f2546d]/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {returnNowSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin text-[#f2546d]" />
                            <span className="text-base font-bold text-[#f2546d]" style={dmSans}>Requesting...</span>
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5 text-[#f2546d]" />
                            <span className="text-base font-bold text-[#f2546d]" style={dmSans}>Return Now</span>
                        </>
                    )}
                </button>

                {/* Schedule Return — pick a time slot */}
                <button
                    disabled={!canSchedule || addresses.length === 0 || !selectedAddressId || !selectedSlotIso || submitting || returnNowSubmitting}
                    onClick={handleScheduleReturn}
                    className="w-full h-14 rounded-2xl bg-[#f2546d] flex items-center justify-center gap-3 shadow-lg shadow-[#f2546d]/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-lg font-bold text-white">Scheduling...</span>
                        </>
                    ) : (
                        <span className="text-lg font-bold text-white">Schedule Return</span>
                    )}
                </button>
            </div>
        </MobileShell>
    );
};

export default ScheduleReturnPage;
