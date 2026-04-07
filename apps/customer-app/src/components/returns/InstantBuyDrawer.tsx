import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShoppingBag, Loader2, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout';
import { supabase } from '@popclozet/api-client';
import { useAuth } from '@/context/SupabaseAuthContext';

interface InstantBuyDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    items: any[];
    onSuccess: () => void;
}

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export function InstantBuyDrawer({ isOpen, onClose, orderId, items, onSuccess }: InstantBuyDrawerProps) {
    const navigate = useNavigate();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { initiatePayment, isProcessing } = useRazorpayCheckout();
    const { user } = useAuth();
    const [verifying, setVerifying] = useState(false);
    const eligibleItemIds = useMemo(
        () => items
            .filter(item => (parseFloat(item.products?.buy_price) || 0) > 0)
            .map(item => item.id),
        [items],
    );

    useEffect(() => {
        if (!isOpen) return;
        setSelectedIds(new Set(eligibleItemIds));
    }, [eligibleItemIds, isOpen]);

    const toggleItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const totalAmount = useMemo(() => {
        return items
            .filter(i => selectedIds.has(i.id))
            .reduce((sum, item) => sum + (parseFloat(item.products?.buy_price) || 0), 0);
    }, [items, selectedIds]);

    const finalizeInstantBuy = async (buyoutOrderId: string, paymentId: string) => {
        const { error } = await supabase.rpc('process_instant_buy', {
            p_source_order_id: orderId,
            p_buyout_order_id: buyoutOrderId,
            p_item_ids: Array.from(selectedIds),
            p_payment_id: paymentId,
        });

        if (error) {
            console.error('[Instant Buy] RPC failed:', error);
            throw error;
        }
    };

    const handlePayAndKeep = async () => {
        if (selectedIds.size === 0 || totalAmount <= 0) return;

        try {
            if (!user?.id) {
                throw new Error('Please sign in again to continue');
            }

            console.log('[Instant Buy] Starting for orderId:', orderId, 'selectedIds:', Array.from(selectedIds));

            const { data: sourceOrder, error: sourceOrderError } = await supabase
                .from('orders')
                .select('delivery_address_id, rental_start_date, rental_end_date')
                .eq('id', orderId)
                .single();

            console.log('[Instant Buy] Source order:', sourceOrder, 'error:', sourceOrderError);

            if (sourceOrderError || !sourceOrder) {
                throw sourceOrderError || new Error('Failed to load return order details');
            }

            // Create the real buyout order first so the payment receipt points at
            // the order the user will see on the confirmation screen.
            const insertPayload = {
                user_id: user.id,
                delivery_address_id: sourceOrder.delivery_address_id,
                rental_start_date: sourceOrder.rental_start_date,
                rental_end_date: sourceOrder.rental_end_date,
                total_amount: totalAmount,
                status: 'pending_payment',
                lifecycle_state: 'pending_payment',
                order_type: 'buyout',
                delivery_fee: 0,
                payment_method: 'upi',
            };
            console.log('[Instant Buy] Inserting buyout order:', insertPayload);

            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert(insertPayload)
                .select()
                .single();

            console.log('[Instant Buy] Created buyout order:', newOrder, 'error:', orderError);

            if (orderError) throw orderError;

            initiatePayment({
                internalOrderId: newOrder.id,
                amountInRupees: totalAmount,
                onSuccess: async (paymentId) => {
                    setVerifying(true);

                    try {
                        await finalizeInstantBuy(newOrder.id, paymentId);
                        toast.success('Instant buy completed');
                        onSuccess();
                        onClose();
                        navigate('/home', { replace: true });
                    } catch (e) {
                        console.error('[Instant Buy] Finalization failed:', e);
                        toast.error('Payment succeeded, but finalizing the instant buy failed. Contact support with your payment reference.');
                    } finally {
                        setVerifying(false);
                    }
                },
                onFailure: async (err) => {
                    console.error('[Instant Buy] Razorpay failed:', err);
                    await supabase
                        .from('orders')
                        .update({ status: 'cancelled', lifecycle_state: 'cancelled' })
                        .eq('id', newOrder.id);
                    toast.error('Instant buy payment was not completed');
                }
            });
        } catch (e: any) {
            console.error('[Instant Buy] Failed to create buyout order:', e?.message, e);
            toast.error(`Could not start instant buy: ${e?.message || 'Unknown error'}`);
        }
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex flex-col justify-end items-center"
                    style={{ paddingBottom: 'var(--mobile-bottom-nav-offset)' }}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            if (!isProcessing && !verifying) onClose();
                        }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                        className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-3xl px-4 pt-4 flex flex-col min-h-0 w-full max-w-[430px] sm:px-5 sm:pt-5"
                        style={{ maxHeight: 'calc(var(--mobile-overlay-max-height) - var(--mobile-bottom-nav-offset))' }}
                    >
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-4 sm:mb-5" />

                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-lg sm:text-xl font-black text-white" style={dmSans}>Instant Buy</h2>
                                <p className="text-xs sm:text-sm text-zinc-400 mt-1">Keep the items you love right now</p>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={isProcessing || verifying}
                                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto pb-4 space-y-3">
                            {items.map((item) => {
                                const isSelected = selectedIds.has(item.id);
                                const buyPrice = parseFloat(item.products?.buy_price) || 0;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => buyPrice > 0 && toggleItem(item.id)}
                                        className={`flex gap-3 items-center p-2.5 sm:gap-4 sm:p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                                            buyPrice === 0 ? 'opacity-50 grayscale pointer-events-none border-zinc-800 bg-zinc-900/50' : 
                                            isSelected
                                                ? 'bg-[#f2546d]/10 border-[#f2546d]/30 shadow-[0_4px_20px_rgba(242,84,109,0.1)]'
                                                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0">
                                            {item.products?.images?.[0] ? (
                                                <img src={item.products.images[0]} alt={item.products?.name || 'Item'} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ShoppingBag className="w-6 h-6 text-zinc-700" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] sm:text-sm font-bold text-white leading-tight line-clamp-2" style={dmSans}>
                                                {item.products?.name || 'Item'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                                                    Size {item.size}
                                                </span>
                                                {buyPrice > 0 && (
                                                    <span className="text-xs font-black text-[#f2546d]">
                                                        ₹{buyPrice}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pr-2">
                                            {buyPrice === 0 ? (
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase">N/A</span>
                                            ) : (
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                                                    isSelected ? 'bg-[#f2546d] border-[#f2546d]' : 'border-zinc-700 bg-transparent'
                                                }`}>
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className="shrink-0 pt-4 border-t border-zinc-800 bg-zinc-950"
                            style={{ paddingBottom: 'var(--mobile-overlay-padding-bottom)' }}
                        >
                            <div className="flex justify-between items-center mb-4 px-1">
                                <span className="text-sm font-bold text-zinc-400">Total Buyout</span>
                                <span className="text-2xl font-black text-white flex items-center">
                                    <IndianRupee className="w-5 h-5 mr-0.5" />
                                    {totalAmount}
                                </span>
                            </div>

                            <button
                                onClick={handlePayAndKeep}
                                disabled={selectedIds.size === 0 || totalAmount <= 0 || isProcessing || verifying}
                                className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-[15px] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:scale-100 bg-[#f2546d] text-white hover:bg-pink-500"
                            >
                                {isProcessing || verifying ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        {verifying ? 'Verifying...' : 'Processing Payment...'}
                                    </>
                                ) : (
                                    <>
                                        Keep Selected Items
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-center text-zinc-500 font-bold uppercase tracking-widest mt-3">
                                The rider manifest will instantly update. No further action required.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
