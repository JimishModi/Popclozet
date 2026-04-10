import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase, transitionOrderState } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import { useToast } from '@/contexts/ToastContext';
import { useLocation } from '@/contexts/LocationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getRiderProfile } from '@/services/riderProfileService';
import {
  startDeliveryTracking,
  pushLocationUpdate,
  stopDeliveryTracking,
} from '@/services/trackingService';
import { verifyDeliveryOtp } from '@/services/deliveryOtpService';
import { notifyCustomerDriverArrived } from '@/services/riderOrderService';
import { openRazorpayCheckout, preloadRazorpayCheckout, type RazorpayFailedResponse, type RazorpayPaymentResponse } from '@/lib/razorpay';
import {
  createRiderCollectionOrder,
  getOrderPaymentRecord,
  verifyRiderCollectionPayment,
  markManualPaymentCollected,
  type OrderPaymentRecord,
} from '@/services/riderPaymentCollectionService';
import {
  MapPin, Navigation, CheckCircle, X, KeyRound, Loader2, Package, ScanLine, IndianRupee, Smartphone,
} from 'lucide-react';
import { QRScannerOverlay } from '@/components/QRScannerOverlay';
import { PaymentQRModal } from '@/components/PaymentQRModal';

// ─── Constants & Utils ────────────────────────────────────────────────────────

const RETURN_STATUSES = ['return_dispatched', 'return_picked_up', 'return_at_warehouse'];

interface DeliveryOrder {
  id: string;
  status: string;
  user_id: string;
  total_amount?: number | null;
  otp_delivery?: string;
  otp_return?: string;
  payment_method?: string | null;
  customer_profiles?: {
    full_name?: string;
    phone?: string;
  } | null;
  delivery_address_snapshot?: {
    full_address?: string;
    lat?: number;
    lng?: number;
  } | null;
  manual_address_details?: {
    contactName?: string | null;
    phoneNumber?: string | null;
    houseNumber?: string | null;
    streetAddress?: string | null;
    landmark?: string | null;
    city?: string | null;
    pincode?: string | null;
  } | null;
  addresses?: {
    full_address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  order_items?: Array<{
    id: string;
    product_id: string;
    size?: string;
    rental_price?: number;
    products?: { name: string; images: string[] };
  }>;
}

function haversineMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DeliveryNavigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { location: globalLocation } = useLocation();
  const navigate = useNavigate();

  const trackingInitialized = useRef(false);

  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [paymentRecord, setPaymentRecord] = useState<OrderPaymentRecord | null>(null);
  const [paymentCollecting, setPaymentCollecting] = useState(false);

  // OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [deliveryCompleting, setDeliveryCompleting] = useState(false);

  // POD payment gate state
  const [showPaymentStep, setShowPaymentStep] = useState(false);

  // Hardcoded QR payment modal (shown after OTP for COD orders)
  const [showPaymentQR, setShowPaymentQR] = useState(false);

  const loadPaymentRecord = useCallback(async (orderId: string) => {
    try {
      const payment = await getOrderPaymentRecord(orderId);
      setPaymentRecord(payment);
    } catch (error) {
      console.error('[DeliveryNavigation] Failed to load payment record:', error);
    }
  }, []);

  // ── Fetch order ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id,status,user_id,total_amount,otp_delivery,otp_return,payment_method,manual_address_details,customer_profiles!orders_user_id_fkey1(full_name,phone),delivery_address_snapshot,addresses:delivery_address_id(full_address,latitude,longitude),order_items(id,product_id,size,rental_price,products(name,images))')
          .eq('id', id)
          .single();
        if (error || !data) throw error;
        const order = data as unknown as DeliveryOrder;
        setOrder(order);
        await loadPaymentRecord(order.id);
        if (order.status === 'delivered') {
          navigate('/');
          return;
        }

        // Resolve customer info from FK join only — separate effect handles the fallback.
        const joinedName = order.customer_profiles?.full_name ?? null;
        const joinedPhone = order.customer_profiles?.phone ?? null;
        if (joinedName || joinedPhone) {
          setCustomerInfo({ full_name: joinedName, phone: joinedPhone });
        }
      } catch (err) {
        console.error(err);
        showToast('Order not found', 'error');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, loadPaymentRecord, navigate, showToast]);

  // ── Customer info fallback ───────────────────────────────────────────────────
  // Runs once when order.user_id is available and the FK join returned nothing.
  // Uses maybeSingle() so 0 rows → null (no 406 error).

  useEffect(() => {
    if (!order?.user_id || customerInfo) return;
    supabase
      .from('customer_profiles')
      .select('full_name, phone')
      .eq('user_id', order.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCustomerInfo({ full_name: data.full_name ?? null, phone: data.phone ?? null });
      });
  }, [order?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (order?.payment_method !== 'cod' || paymentRecord?.status === 'completed') return;

    preloadRazorpayCheckout().catch((error) => {
      console.warn('[DeliveryNavigation] Razorpay preload failed:', error);
    });
  }, [order?.payment_method, paymentRecord?.status]);

  // ── Resolve destination ──────────────────────────────────────────────────────

  const destLat = order?.delivery_address_snapshot?.lat
    ?? order?.addresses?.latitude
    ?? null;
  const destLng = order?.delivery_address_snapshot?.lng
    ?? order?.addresses?.longitude
    ?? null;
  const destAddress = order?.delivery_address_snapshot?.full_address
    ?? order?.addresses?.full_address
    ?? 'Delivery address unavailable';

  // ── Navigation Stats ─────────────────────────────────────────────────────────

  const distanceInMetres = useMemo(() => {
    if (!globalLocation || !destLat || !destLng) return null;
    return haversineMetres(
      { lat: globalLocation.latitude, lng: globalLocation.longitude },
      { lat: destLat, lng: destLng }
    );
  }, [globalLocation, destLat, destLng]);

  const etaMinutes = useMemo(() => {
    if (!distanceInMetres) return null;
    // Assume 30km/h average in city traffic
    return Math.max(1, Math.round((distanceInMetres / 1000) * 3));
  }, [distanceInMetres]);

  // ── Open Google Maps ─────────────────────────────────────────────────────────

  const handleOpenGoogleMaps = useCallback(() => {
    let destination: string;
    // Always prefer precise coordinates — avoids emoji/special-char issues in stored addresses
    if (destLat != null && destLng != null) {
      destination = `${destLat},${destLng}`;
    } else if (destAddress && destAddress !== 'Delivery address unavailable') {
      // Strip non-ASCII characters (emojis, special symbols) before geocoding
      destination = encodeURIComponent(destAddress.replace(/[^\x20-\x7E]/g, '').trim());
    } else {
      destination = encodeURIComponent('Delivery address');
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [destLat, destLng, destAddress]);

  // ── Sync global location to local state ──────────────────────────────────────

  useEffect(() => {
    if (globalLocation) {
      const coords: [number, number] = [globalLocation.longitude, globalLocation.latitude];
      setRiderLocation(coords);
    }
  }, [globalLocation]);

  // ── Tracking updates ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !user?.id || !globalLocation) return;

    const runTracking = async () => {
      if (!trackingInitialized.current) {
        trackingInitialized.current = true;
        const profile = await getRiderProfile(user.id);
        await startDeliveryTracking(
          id,
          globalLocation.latitude,
          globalLocation.longitude,
          profile?.name ?? null,
          profile?.vehicleNumber ?? null,
          profile?.phone ?? null
        );
      }

      await pushLocationUpdate(
        user.id,
        id,
        globalLocation.latitude,
        globalLocation.longitude,
        globalLocation.heading ?? null,
        globalLocation.speed ?? null
      );
    };

    runTracking();
  }, [id, user?.id, globalLocation]);

  // ── Derived payment state (needed before callbacks) ──────────────────────────

  const isPayOnDelivery = order?.payment_method === 'cod';
  const isPaymentCompleted = paymentRecord?.status === 'completed' || (!isPayOnDelivery && !!order?.payment_method);
  const shouldShowOnlineCollection = Boolean(isPayOnDelivery && !isPaymentCompleted && order?.total_amount);

  // ── OTP-gated delivery completion ────────────────────────────────────────────

  const handleRequestDelivery = useCallback(async () => {
    if (id && order?.user_id && !RETURN_STATUSES.includes(order.status)) {
      await notifyCustomerDriverArrived(id, order.user_id).catch((error) => {
        console.warn('[DeliveryNavigation] Failed to notify customer about rider arrival:', error);
      });
    }

    // For POD orders, go directly to OTP — payment QR is shown after OTP verification
    setOtpValue('');
    setOtpError('');
    setShowOtpModal(true);
  }, [id, isPayOnDelivery, isPaymentCompleted, order?.status, order?.user_id]);

  const handleVerifyAndDeliver = useCallback(async () => {
    if (!id || !user?.id) return;
    if (otpValue.length !== 4) {
      setOtpError('Please enter the 4-digit OTP');
      return;
    }

    setOtpVerifying(true);
    setOtpError('');

    const isReturn = order ? RETURN_STATUSES.includes(order.status) : false;

    try {
      if (isReturn) {
        const { data, error } = await supabase.rpc('verify_order_otp', {
          p_order_id: id,
          p_otp_code: otpValue,
          p_otp_type: 'return',
          p_actor_id: user.id,
        });
        if (error || !data?.success) {
          setOtpError(data?.message || error?.message || 'Incorrect OTP. Please try again.');
          setOtpVerifying(false);
          return;
        }
      } else {
        const result = await verifyDeliveryOtp(id, otpValue, 'otp_delivery');
        if (!result.success) {
          setOtpError(result.error || 'Incorrect OTP. Please try again.');
          setOtpVerifying(false);
          return;
        }

        setOtpVerifying(false);
        setDeliveryCompleting(true);

        await stopDeliveryTracking(id);

        const transition = await transitionOrderState(id, 'delivered' as any, 'rider', user.id);
        if (!transition.success) throw new Error(transition.message);

        setShowOtpModal(false);
        showToast('Delivery completed! ✅', 'success');

        // For COD orders, show payment QR after delivery is marked complete
        if (isPayOnDelivery) {
          setShowPaymentQR(true);
        } else {
          navigate('/');
        }
        return;
      }

      setOtpVerifying(false);
      setDeliveryCompleting(true);

      await stopDeliveryTracking(id);

      setShowOtpModal(false);
      showToast('Return collected! Head to the warehouse. ✅', 'success');
      navigate(`/warehouse/${id}`);
    } catch (err: any) {
      setDeliveryCompleting(false);
      setOtpVerifying(false);
      showToast(err.message || 'Failed to complete. Try again.', 'error');
    }
  }, [id, user?.id, order, otpValue, showToast, navigate]);

  const displayCustomerName =
    order?.manual_address_details?.contactName?.trim() ||
    customerInfo?.full_name?.trim() ||
    'Valued Customer';
  const displayCustomerPhone =
    order?.manual_address_details?.phoneNumber?.trim() ||
    customerInfo?.phone?.trim() ||
    null;
  const accountCustomerName =
    customerInfo?.full_name &&
    order?.manual_address_details?.contactName &&
    customerInfo.full_name.trim() !== order.manual_address_details.contactName.trim()
      ? customerInfo.full_name.trim()
      : null;
  const handleCollectOnlinePayment = useCallback(async () => {
    if (!id || !order?.total_amount || paymentCollecting) return;

    setPaymentCollecting(true);

    try {
      const rzpOrder = await createRiderCollectionOrder(id);
      let outcome: 'none' | 'success' | 'failed' | 'cancelled' = 'none';

      await new Promise<void>((resolve, reject) => {
        void (async () => {
          try {
            const instance = await openRazorpayCheckout({
              key: rzpOrder.key_id,
              amount: rzpOrder.amount,
              currency: rzpOrder.currency,
              name: 'Popclozet',
              description: `Collect payment for order ${id.slice(0, 8).toUpperCase()}`,
              image: '/icons/icon-192x192.png',
              order_id: rzpOrder.id,
              prefill: {
                name: displayCustomerName,
                contact: displayCustomerPhone || '',
              },
              notes: {
                supabase_order_id: id,
                payment_context: 'rider_collection',
              },
              theme: {
                color: '#10b981',
                hide_topbar: false,
              },
              modal: {
                confirm_close: true,
                escape: false,
                backdropclose: false,
                ondismiss: () => {
                  if (outcome !== 'none') return;
                  outcome = 'cancelled';
                  reject(new Error('PAYMENT_CANCELLED'));
                },
              },
              handler: async (response: RazorpayPaymentResponse) => {
                outcome = 'success';
                try {
                  await verifyRiderCollectionPayment({
                    internalOrderId: id,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  });

                  await loadPaymentRecord(id);
                  showToast('Payment collected successfully', 'success');

                  // If triggered from POD payment gate, advance to OTP step
                  if (showPaymentStep) {
                    setShowPaymentStep(false);
                    setOtpValue('');
                    setOtpError('');
                    setShowOtpModal(true);
                  }

                  resolve();
                } catch (error) {
                  outcome = 'failed';
                  reject(error instanceof Error ? error : new Error(String(error)));
                }
              },
            });

            instance.on('payment.failed', (failedResponse: RazorpayFailedResponse) => {
              if (outcome !== 'none') return;
              const message =
                failedResponse.error.description ||
                failedResponse.error.reason ||
                'Payment failed. Customer can retry.';
              showToast(message, 'error');
            });
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      });
    } catch (error: any) {
      if (error?.message === 'PAYMENT_CANCELLED') {
        showToast('Payment collection cancelled', 'error');
      } else if (String(error?.message || '').toLowerCase().includes('already completed')) {
        await loadPaymentRecord(id);
        showToast('This order is already paid', 'success');
        // Already paid — advance to OTP if in payment gate flow
        if (showPaymentStep) {
          setShowPaymentStep(false);
          setOtpValue('');
          setOtpError('');
          setShowOtpModal(true);
        }
      } else {
        showToast(error?.message || 'Failed to collect payment', 'error');
      }
    } finally {
      setPaymentCollecting(false);
    }
  }, [
    displayCustomerName,
    displayCustomerPhone,
    id,
    loadPaymentRecord,
    order?.total_amount,
    paymentCollecting,
    showPaymentStep,
    showToast,
  ]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const primaryBtn = (gradient: string) =>
    `w-full py-4 rounded-2xl bg-gradient-to-r ${gradient} text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader size="lg" text="Initialising Navigation..." />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-[#080808] flex flex-col font-sans">
      {/* ── INNOVATIVE DASHBOARD ── */}
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-32 space-y-8">
        
        {/* Status & Header */}
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Delivery</span>
          </motion.div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-600">ID: {order.id.slice(0, 8).toUpperCase()}</span>
            <button
              onClick={() => setShowQRScanner(true)}
              className="w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
              aria-label="Scan QR Code"
            >
              <ScanLine size={15} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Dynamic Stats Card */}
        <section className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 blur-3xl opacity-50" />
          <div className="relative grid grid-cols-2 gap-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md"
            >
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Distance</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">
                  {distanceInMetres ? (distanceInMetres / 1000).toFixed(1) : '--'}
                </span>
                <span className="text-xs font-bold text-zinc-500">KM</span>
              </div>
            </motion.div>
            <motion.div 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="bg-zinc-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md"
            >
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Estimated</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{etaMinutes ?? '--'}</span>
                <span className="text-xs font-bold text-zinc-500">MINS</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Progress Visualization */}
        <section className="space-y-4">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">
            <span>You</span>
            <span>Target</span>
          </div>
          <div className="relative h-12 flex items-center">
            <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full overflow-hidden">
               <motion.div 
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  style={{ transformOrigin: 'left' }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-blue-500" 
               />
            </div>
            <div className="absolute left-0 w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
                <Navigation size={14} className="text-emerald-400 rotate-45" />
            </div>
            <div className="absolute right-0 w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-2xl">
               <div className="w-4 h-4 rounded-full bg-emerald-500 animate-ping absolute opacity-50" />
               <MapPin size={18} className="text-emerald-500 relative" />
            </div>
          </div>
        </section>

        {/* Destination Details */}
        <section className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
           {/* Customer name */}
           <div>
              <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Customer</h2>
              <p className="text-xl font-bold text-white">{displayCustomerName}</p>
              {displayCustomerPhone && (
                <p className="text-sm text-zinc-500 mt-1">{displayCustomerPhone}</p>
              )}
              {accountCustomerName && (
                <p className="text-xs text-zinc-600 mt-2">Account name: {accountCustomerName}</p>
              )}
           </div>

           {/* Payment Mode */}
           {order?.payment_method && (
             <div className="space-y-4">
               <span className={`inline-block px-3 py-1.5 text-xs font-bold uppercase rounded-xl ${
                 order.payment_method === 'cod'
                   ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                   : 'bg-green-500/20 text-green-400 border border-green-500/30'
               }`}>
                 {order.payment_method === 'cod' ? 'Pay on Delivery' : 'Paid Online'}
               </span>

               <div className="grid grid-cols-2 gap-3">
                 <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                   <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Order Amount</div>
                   <div className="flex items-center gap-1 text-white text-xl font-black">
                     <IndianRupee size={18} className="text-emerald-400" />
                     <span>{Number(order.total_amount || 0).toFixed(0)}</span>
                   </div>
                 </div>
                 <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                   <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Payment Status</div>
                   <p className={`text-sm font-bold ${isPaymentCompleted ? 'text-emerald-400' : 'text-yellow-400'}`}>
                     {isPaymentCompleted ? 'Collected' : isPayOnDelivery ? 'Pending Collection' : 'Paid Online'}
                   </p>
                   {paymentRecord?.provider && (
                     <p className="text-[11px] text-zinc-500 mt-1 uppercase">{paymentRecord.provider}</p>
                   )}
                 </div>
               </div>

             </div>
           )}

           {/* Call button — always visible, greyed out only if no phone */}
           {displayCustomerPhone ? (
             <a
               href={`tel:${displayCustomerPhone}`}
               className="w-full py-4 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center gap-3 text-emerald-400 font-bold text-sm transition-all active:scale-95 hover:bg-emerald-600/30"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
               Call Customer
             </a>
           ) : (
             <div className="w-full py-4 rounded-2xl bg-zinc-800/30 border border-white/5 flex items-center justify-center gap-3 text-zinc-600 font-bold text-sm cursor-not-allowed">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
               Phone Unavailable
             </div>
           )}

           {/* Map Address */}
           <div className="space-y-3">
              <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Map Address</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{destAddress}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(destAddress);
                  showToast('Address copied!', 'success');
                }}
                className="w-full py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl flex items-center justify-center gap-2 text-zinc-400 text-xs font-bold transition-all border border-white/5 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                Copy Address
              </button>
           </div>

           {/* Manual Form Address */}
           {order?.manual_address_details && (
             <div className="space-y-3">
               <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Form Address</h2>
               <div className="text-sm text-zinc-400 leading-relaxed space-y-1">
                 {order.manual_address_details.houseNumber && (
                   <p><span className="text-zinc-600">House: </span>{order.manual_address_details.houseNumber}</p>
                 )}
                 {order.manual_address_details.streetAddress && (
                   <p><span className="text-zinc-600">Street: </span>{order.manual_address_details.streetAddress}</p>
                 )}
                 {order.manual_address_details.landmark && (
                   <p><span className="text-zinc-600">Landmark: </span>{order.manual_address_details.landmark}</p>
                 )}
                 {order.manual_address_details.city && (
                   <p><span className="text-zinc-600">City: </span>{order.manual_address_details.city}</p>
                 )}
                 {order.manual_address_details.pincode && (
                   <p><span className="text-zinc-600">Pincode: </span>{order.manual_address_details.pincode}</p>
                 )}
                 {order.manual_address_details.contactName && (
                   <p><span className="text-zinc-600">Recipient: </span>{order.manual_address_details.contactName}</p>
                 )}
                 {order.manual_address_details.phoneNumber && (
                   <p><span className="text-zinc-600">Phone: </span>{order.manual_address_details.phoneNumber}</p>
                 )}
               </div>
             </div>
           )}
        </section>

        {/* Package Contents */}
        {order.order_items && order.order_items.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">Package Contents</h3>
            <div className="grid gap-3">
              {order.order_items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }}
                  className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-white/5">
                    {item.products?.images?.[0]
                      ? <img src={item.products.images[0]} alt="" className="w-full h-full object-cover" />
                      : <Package className="w-full h-full p-3 text-zinc-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.products?.name || 'Unknown Item'}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Size: {item.size || 'One Size'}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-tighter">1×</div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating Action Bar */}
      <div className="absolute bottom-0 inset-x-0 px-6 pb-6 pt-12 bg-gradient-to-t from-black via-black/90 to-transparent space-y-4">

        {/* Step Indicator */}
        {(() => {
          const isReturn = order ? RETURN_STATUSES.includes(order.status) : false;
          const steps = isReturn
            ? ['Navigate', 'Verify OTP', 'To Warehouse']
            : isPayOnDelivery
              ? ['Navigate', 'Verify OTP', 'Collect Payment']
              : ['Navigate', 'Verify OTP', 'Done'];
          const currentStep = 0; // rider is always on step 1 (navigate) until OTP modal opens
          return (
            <div className="flex items-center justify-center gap-2">
              {steps.map((label, idx) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                      idx === currentStep
                        ? 'bg-emerald-500 text-white'
                        : idx < currentStep
                          ? 'bg-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider transition-all ${
                      idx === currentStep ? 'text-emerald-400' : idx < currentStep ? 'text-zinc-500' : 'text-zinc-700'
                    }`}>
                      {label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-4 h-px ${idx < currentStep ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleOpenGoogleMaps}
            className="py-4 rounded-2xl bg-[#4285F4] hover:bg-[#3b78e7] active:scale-[0.98] transition-all text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20"
          >
            <Navigation size={18} fill="currentColor" />
            Navigate
          </button>

          <button
            onClick={handleRequestDelivery}
            disabled={deliveryCompleting}
            className={primaryBtn('from-emerald-600 to-emerald-500 shadow-emerald-500/20')}
          >
            {deliveryCompleting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : RETURN_STATUSES.includes(order.status) ? (
              <><KeyRound size={18} /> Verify Return OTP</>
            ) : (
              <><CheckCircle size={18} /> Verify OTP</>
            )}
          </button>
        </div>
      </div>

      {/* QR Scanner */}
      {showQRScanner && <QRScannerOverlay onClose={() => setShowQRScanner(false)} />}

      {/* Payment QR (shown after OTP for COD orders) — mandatory, rider cannot skip */}
      {showPaymentQR && (
        <PaymentQRModal
          onClose={() => {/* no-op: rider must confirm payment before closing */}}
          onPaymentConfirmed={async () => {
            if (id) {
              await markManualPaymentCollected(id);
            }
            navigate('/');
          }}
        />
      )}

      {/* OTP Verification Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-white/5 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-400" /> {order && RETURN_STATUSES.includes(order.status) ? 'Return Pickup' : 'Verify Delivery'}
                </h3>
                <button
                  onClick={() => { if (!otpVerifying) setShowOtpModal(false); }}
                  disabled={otpVerifying}
                  className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6 text-center">
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {order && RETURN_STATUSES.includes(order.status)
                    ? 'Ask the customer for the 4-digit return pickup OTP shown on their app.'
                    : 'Ask the customer for the 4-digit delivery OTP shown on their app.'}
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  value={otpValue}
                  onChange={(e) => {
                    setOtpValue(e.target.value.replace(/\D/g, ''));
                    setOtpError('');
                  }}
                  autoFocus
                  placeholder="0000"
                  className="w-full text-center text-4xl font-mono font-black tracking-[0.3em] bg-black border border-white/5 rounded-2xl py-6 text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-800"
                />

                {otpError && (
                  <p className="text-sm text-red-500 font-bold">{otpError}</p>
                )}

                <button
                  onClick={handleVerifyAndDeliver}
                  disabled={otpValue.length !== 4 || otpVerifying}
                  className={primaryBtn('from-emerald-600 to-emerald-500')}
                >
                  {otpVerifying ? (
                    <><Loader2 size={18} className="animate-spin" /> Verifying...</>
                  ) : (
                    'Confirm OTP'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POD Payment Collection Modal */}
      <AnimatePresence>
        {showPaymentStep && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-white/5 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <IndianRupee size={18} className="text-emerald-400" /> Collect Payment
                </h3>
                <button
                  onClick={() => { if (!paymentCollecting) setShowPaymentStep(false); }}
                  disabled={paymentCollecting}
                  className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6 text-center">
                <div className="space-y-2">
                  <p className="text-sm text-zinc-500">Collect payment before completing delivery</p>
                  <div className="flex items-center justify-center gap-1 text-white">
                    <IndianRupee size={28} className="text-emerald-400" />
                    <span className="text-4xl font-black">{Number(order?.total_amount || 0).toFixed(0)}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 leading-relaxed">
                  Opens Popclozet's secure UPI/QR checkout for the customer to pay online at the doorstep.
                </p>

                <button
                  onClick={handleCollectOnlinePayment}
                  disabled={paymentCollecting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 shadow-xl shadow-emerald-500/20"
                >
                  {paymentCollecting ? (
                    <><Loader2 size={18} className="animate-spin" /> Opening payment...</>
                  ) : (
                    <><Smartphone size={18} /> Collect Online via QR</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
