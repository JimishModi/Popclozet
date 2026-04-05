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
import {
  MapPin, Navigation, CheckCircle, X, KeyRound, Loader2, Package, ScanLine,
} from 'lucide-react';
import { QRScannerOverlay } from '@/components/QRScannerOverlay';

// ─── Constants & Utils ────────────────────────────────────────────────────────

const RETURN_STATUSES = ['return_dispatched', 'return_picked_up', 'return_at_warehouse'];

interface DeliveryOrder {
  id: string;
  status: string;
  user_id: string;
  otp_delivery?: string;
  otp_return?: string;
  customer_profiles?: {
    full_name?: string;
    phone?: string;
  } | null;
  delivery_address_snapshot?: {
    full_address?: string;
    lat?: number;
    lng?: number;
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

  // OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [deliveryCompleting, setDeliveryCompleting] = useState(false);

  // ── Fetch order ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id,status,user_id,otp_delivery,otp_return,customer_profiles!orders_user_id_fkey1(full_name,phone),delivery_address_snapshot,addresses:delivery_address_id(full_address,latitude,longitude),order_items(id,product_id,size,rental_price,products(name,images))')
          .eq('id', id)
          .single();
        if (error || !data) throw error;
        const order = data as unknown as DeliveryOrder;
        setOrder(order);
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
  }, [id, navigate, showToast]);

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

  // ── OTP-gated delivery completion ────────────────────────────────────────────

  const handleRequestDelivery = useCallback(() => {
    setOtpValue('');
    setOtpError('');
    setShowOtpModal(true);
  }, []);

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
        navigate('/');
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
              <p className="text-xl font-bold text-white">{customerInfo?.full_name || 'Valued Customer'}</p>
              {customerInfo?.phone && (
                <p className="text-sm text-zinc-500 mt-1">{customerInfo.phone}</p>
              )}
           </div>

           {/* Call button — always visible, greyed out only if no phone */}
           {customerInfo?.phone ? (
             <a
               href={`tel:${customerInfo.phone}`}
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

           {/* Address + copy */}
           <div className="space-y-3">
              <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Delivery Address</h2>
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
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent pt-12">
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
            ) : (
              <><CheckCircle size={18} /> Complete</>
            )}
          </button>
        </div>
      </div>

      {/* QR Scanner */}
      {showQRScanner && <QRScannerOverlay onClose={() => setShowQRScanner(false)} />}

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
    </div>
  );
};
