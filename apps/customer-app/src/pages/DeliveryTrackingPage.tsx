// src/pages/DeliveryTrackingPage.tsx
// Real-time delivery tracking page

import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Phone, MessageCircle, Truck, Package, KeyRound, Home, Banknote, CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { MobileShell } from '@/components/layout/MobileShell';
import { DeliveryTracker, TrackingData } from '@/components/map/DeliveryTracker';
import { OrderChat } from '@/components/map/OrderChat';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@popclozet/api-client';
import { DeliveryOrder } from '@/services/deliveryService';
import { confirmCodPayment } from '@/services/ordersService';
import { calculateHaversineDistance as calculateDistance } from '@/lib/locationUtils';
import { WAREHOUSE, DELIVERY_THRESHOLDS } from '@/lib/serviceAreas';
import { buildManualAddressSummary } from '@/lib/addressAccuracy';
import { useAuth } from '@/hooks/useAuth';
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout';
import { CustomerDeliveryInfoCard } from '@/components/orders/CustomerDeliveryInfoCard';
import { toast } from 'sonner';

export default function DeliveryTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [showChat, setShowChat] = useState(false);
    const [order, setOrder] = useState<DeliveryOrder | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [riderProfile, setRiderProfile] = useState<{ name: string; phone: string; vehicle: string } | null>(null);
    const { profile, user } = useAuth();
    const { initiatePayment, isProcessing: isRazorpayProcessing } = useRazorpayCheckout();
    const [showPayDrawer, setShowPayDrawer] = useState(false);
    const [codPaymentDone, setCodPaymentDone] = useState(false);
    const [isConfirmingCash, setIsConfirmingCash] = useState(false);

    // Determine if this is a COD order that hasn't been paid yet
    const isCodOrder = (order as any)?.payment_method === 'cod';
    const isCodPaid = codPaymentDone || (order as any)?.cod_payment_collected === true;
    const isDeliveryInProgress = order?.status && ['dispatched', 'out_for_delivery', 'order_picked_up', 'driver_arrived_warehouse', 'ready_for_pickup'].includes(order.status);

    // Sync codPaymentDone with DB state (e.g. on real-time update)
    useEffect(() => {
        if ((order as any)?.cod_payment_collected === true) {
            setCodPaymentDone(true);
        }
    }, [(order as any)?.cod_payment_collected]);

    // Handle cash payment confirmation
    const handleCashPayment = useCallback(async () => {
        if (!orderId) return;
        setIsConfirmingCash(true);
        try {
            await confirmCodPayment(orderId, 'cash');
            setCodPaymentDone(true);
            setShowPayDrawer(false);
            toast.success('Payment confirmed! Your delivery OTP is now visible.');
        } catch (err: any) {
            toast.error(err.message || 'Failed to confirm payment');
        } finally {
            setIsConfirmingCash(false);
        }
    }, [orderId]);

    // Handle UPI payment at door
    const handleUpiPayment = useCallback(async () => {
        if (!orderId || !order) return;
        initiatePayment({
            internalOrderId: orderId,
            amountInRupees: order.total_amount || 0,
            preferredMethod: 'upi',
            userName: profile?.full_name || user?.user_metadata?.full_name || '',
            userEmail: user?.email || '',
            userPhone: profile?.phone || user?.phone || '',
            skipCancelOnFailure: true, // COD order — don't cancel on UPI failure
            onSuccess: async () => {
                // verify_payment_and_update already marks cod_payment_collected + generates OTP
                setCodPaymentDone(true);
                setShowPayDrawer(false);
                toast.success('Payment successful! Your delivery OTP is now visible.');
            },
            onFailure: () => {
                toast.error('Payment failed. You can try again or pay cash.');
            },
        });
    }, [orderId, order, profile, user, initiatePayment]);

    const userLocation = order?.delivery_address_snapshot
        ? { lat: order.delivery_address_snapshot.lat, lng: order.delivery_address_snapshot.lng }
        : null;
    const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, WAREHOUSE.lat, WAREHOUSE.lng)
        : null;
    const isDelayed = false;
    const fetchedAddress =
        order?.delivery_address_snapshot?.full_address ||
        (order as any)?.delivery_address?.full_address ||
        null;
    const manualAddressSummary = buildManualAddressSummary((order as any)?.manual_address_details);
    const customerName = (order as any)?.manual_address_details?.contactName || profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Customer';
    const customerPhone = (order as any)?.manual_address_details?.phoneNumber || profile?.phone || user?.phone || null;

    useEffect(() => {
        if (!orderId) return;

        const fetchItems = async () => {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select(`
                    *,
                    products (*)
                `)
                .eq('order_id', orderId);

            if (orderItems) {
                setItems(orderItems);
            }
        };

        fetchItems();
    }, [orderId]);

    // Fetch rider profile as soon as order has a rider_id
    useEffect(() => {
        const orderWithRider = order as any;
        if (!orderWithRider?.rider_id) return;
        
        const fetchRider = async () => {
            const { data } = await supabase
                .from('rider_profiles')
                .select('*')
                .eq('user_id', orderWithRider.rider_id)
                .single();
            if (data) {
                setRiderProfile({
                    name: data.full_name || 'Your Rider',
                    phone: data.phone || '',
                    vehicle: data.vehicle_number || 'VEHICLE INFO'
                });
            }
        };
        fetchRider();
    }, [order]);

    if (!orderId) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex items-center justify-center h-full">
                    <p className="text-zinc-400">Order not found</p>
                </div>
            </MobileShell>
        );
    }

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Track my Popclozet order',
                    url,
                });
            } catch {
                // User cancelled or share failed
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(url);
        }
    };

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold">Track Order</h1>
                        <p className="text-xs text-zinc-500">#{orderId.slice(0, 8)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleShare}
                        className="p-2 rounded-full hover:bg-white/10"
                    >
                        <Share2 className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 no-scrollbar">
                {/* Header Information: Order Summary FIRST */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Order Details</h2>
                        <div className="flex items-center gap-2">
                            {order?.support_tier === 'premium' && (
                                <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                                    <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                        Premium Support
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl">
                        <div className="space-y-4">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-4 items-center">
                                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-white/5">
                                        {item.products?.images?.[0] ? (
                                            <img src={item.products.images[0]} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                                <Package className="w-6 h-6 text-zinc-700" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-black text-white truncate uppercase tracking-tight">{item.products?.name || 'Item'}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5 font-bold uppercase tracking-widest">Size: {item.size} • Qty: 1</p>
                                    </div>
                                    <p className="text-sm font-black text-white">₹{item.rental_price}</p>
                                </div>
                            ))}

                            <div className="pt-4 border-t border-zinc-800/50 space-y-2">
                                <div className="flex justify-between text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
                                    <span>Delivery Fee</span>
                                    <span className="text-zinc-300">₹{order?.delivery_fee || 0}</span>
                                </div>
                                <div className="flex justify-between text-lg font-black text-white pt-1">
                                    <span className="tracking-tighter">TOTAL</span>
                                    <span className="text-[#f2546d]">₹{order?.total_amount || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COD: Pay the Bill button — shown when rider is on the way but payment not collected */}
                {isCodOrder && !isCodPaid && isDeliveryInProgress && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-6 p-5 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-900/10 border border-amber-500/30 shadow-xl shadow-amber-500/10"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Banknote className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-black text-amber-400 uppercase tracking-[0.2em]">Payment Required</span>
                        </div>
                        <p className="text-sm text-zinc-300 mb-4">
                            Pay <span className="font-black text-white">₹{order?.total_amount || 0}</span> to receive your delivery OTP and complete the handover.
                        </p>
                        <button
                            onClick={() => setShowPayDrawer(true)}
                            className="w-full py-3.5 rounded-2xl bg-amber-500 text-black font-black text-base uppercase tracking-tight shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
                        >
                            Pay the Bill
                        </button>
                    </motion.div>
                )}

                {/* Delivery OTP — shown when payment is done (or non-COD orders) */}
                {order?.otp_delivery && isDeliveryInProgress && (!isCodOrder || isCodPaid) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-6 p-5 rounded-3xl bg-gradient-to-br from-[#f2546d]/20 to-pink-900/10 border border-[#f2546d]/30 shadow-xl shadow-[#f2546d]/10"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <KeyRound className="w-4 h-4 text-[#f2546d]" />
                            <span className="text-xs font-black text-[#f2546d] uppercase tracking-[0.2em]">Delivery OTP</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            {order.otp_delivery.split('').map((digit, i) => (
                                <div key={i} className="flex-1 aspect-square max-w-[56px] flex items-center justify-center rounded-2xl bg-white/10 border border-[#f2546d]/30 text-white text-2xl font-black shadow-inner">
                                    {digit}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-400 text-center font-medium">
                            Share this code with your rider when they arrive
                        </p>
                    </motion.div>
                )}

                {(fetchedAddress || manualAddressSummary) && (
                    <div className="mb-6">
                        <CustomerDeliveryInfoCard
                            customerName={customerName}
                            customerPhone={customerPhone}
                            fetchedAddress={fetchedAddress}
                            manualAddressSummary={manualAddressSummary}
                        />
                    </div>
                )}

                <DeliveryTracker
                    orderId={orderId}
                    onOrderLoad={setOrder}
                    onTrackingUpdate={setTracking}
                />

                {/* Rider Details (If Active or Assigned) */}
                {(tracking || riderProfile) && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-5 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Live Tracking</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Rider Active</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#f2546d]/10 flex items-center justify-center border border-[#f2546d]/20">
                                <Truck className="w-7 h-7 text-[#f2546d]" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[15px] font-black text-white uppercase tracking-tight">{tracking?.driver_name || riderProfile?.name || 'Rider Assigned'}</p>
                                <p className="text-[11px] text-zinc-500 mt-1 font-bold uppercase tracking-widest">{tracking?.vehicle_number || riderProfile?.vehicle || 'VEHICLE INFO'}</p>
                            </div>
                            {riderProfile?.phone ? (
                                <a 
                                    href={`tel:${riderProfile.phone}`}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold rounded-xl shadow-lg active:scale-95 transition-all"
                                >
                                    <Phone className="w-4 h-4" />
                                    <span className="text-sm">Call Driver</span>
                                </a>
                            ) : (
                                <a 
                                    href="tel:+918000155299"
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold rounded-xl shadow-lg active:scale-95 transition-all"
                                >
                                    <Phone className="w-4 h-4" />
                                    <span className="text-sm">Call Driver</span>
                                </a>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Contact options */}
                <div className="mt-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-semibold text-white mb-3">Need Help?</h3>
                    {order?.support_tier === 'premium' && (
                        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                            <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                                Premium queue enabled for this order
                            </p>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <a 
                            href="tel:+918000155299"
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <Phone className="w-4 h-4" />
                            Call
                        </a>
                        <button 
                            onClick={() => setShowChat(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Chat
                        </button>
                    </div>
                </div>

                {/* Order actions (Report Issue only now) */}
                <div className="mt-4">
                    <a 
                        href={`mailto:popclozet@gmail.com?subject=Issue with Order #${orderId}`}
                        className="w-full flex items-center justify-center py-3 rounded-xl bg-zinc-900 border border-[#f2546d]/30 text-sm text-[#f2546d] hover:bg-[#f2546d]/10 transition-colors"
                    >
                        Report an Issue
                    </a>
                </div>

                {/* Home Option - shown when delivered */}
                {order?.status === 'delivered' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6"
                    >
                        <button 
                            onClick={() => navigate('/home')}
                            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#f2546d] text-white text-base font-black uppercase tracking-tighter shadow-xl shadow-[#f2546d]/20 active:scale-[0.98] transition-all"
                        >
                            <Home className="w-5 h-5" />
                            Home
                        </button>
                    </motion.div>
                )}
            </main>

            {/* Pay the Bill Drawer */}
            <AnimatePresence>
                {showPayDrawer && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
                        <div
                            className="absolute inset-0"
                            onClick={() => !isConfirmingCash && !isRazorpayProcessing && setShowPayDrawer(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative bg-zinc-900 rounded-t-3xl border-t border-zinc-800 p-6 pb-10 z-10"
                        >
                            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto mb-6" />
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Pay the Bill</h2>
                            <p className="text-sm text-zinc-400 mb-6">
                                Total amount: <span className="text-white font-black">₹{order?.total_amount || 0}</span>
                            </p>

                            <div className="space-y-3">
                                {/* UPI Option */}
                                <button
                                    onClick={handleUpiPayment}
                                    disabled={isConfirmingCash || isRazorpayProcessing}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-800 border border-zinc-700 hover:border-[#f2546d]/50 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-[#f2546d]/10 flex items-center justify-center">
                                        <CreditCard className="w-6 h-6 text-[#f2546d]" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-[15px] font-black text-white uppercase tracking-tight">Pay via UPI</p>
                                        <p className="text-[11px] text-zinc-500 mt-0.5">Google Pay, PhonePe, Paytm & more</p>
                                    </div>
                                    {isRazorpayProcessing && <Loader2 className="w-5 h-5 text-[#f2546d] animate-spin" />}
                                </button>

                                {/* Cash Option */}
                                <button
                                    onClick={handleCashPayment}
                                    disabled={isConfirmingCash || isRazorpayProcessing}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-800 border border-zinc-700 hover:border-amber-500/50 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                        <Banknote className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-[15px] font-black text-white uppercase tracking-tight">Pay Cash to Rider</p>
                                        <p className="text-[11px] text-zinc-500 mt-0.5">Hand over ₹{order?.total_amount || 0} in cash</p>
                                    </div>
                                    {isConfirmingCash && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-600 text-center mt-4 uppercase tracking-widest">
                                OTP will be generated after payment
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Chat Drawer */}
            <AnimatePresence>
                {showChat && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
                        <div
                            className="absolute inset-0"
                            onClick={() => setShowChat(false)}
                        />
                        <OrderChat
                            orderId={orderId}
                            supportTier={order?.support_tier}
                            onClose={() => setShowChat(false)}
                        />
                    </div>
                )}
            </AnimatePresence>
        </MobileShell>
    );
}
