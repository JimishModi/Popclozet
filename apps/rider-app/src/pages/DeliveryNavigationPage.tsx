/**
 * Delivery Navigation Page
 *
 * Refactored to use global LocationContext for persistent GPS tracking.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase, transitionOrderState } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import {
  isMapboxAvailable,
  initializeMap,
  drawRoute,
  mapboxgl,
  fetchMapplsRoute,
} from '@popclozet/map-core';
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
  MapPin, Navigation, CheckCircle, X, KeyRound, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const RETURN_STATUSES = ['return_dispatched', 'return_picked_up', 'return_at_warehouse'];

interface DeliveryOrder {
  id: string;
  status: string;
  otp_delivery?: string;
  otp_return?: string;
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DeliveryNavigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { location: globalLocation } = useLocation();
  const navigate = useNavigate();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const trackingInitialized = useRef(false);

  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
          .select('id,status,otp_delivery,otp_return,delivery_address_snapshot,addresses:delivery_address_id(full_address,latitude,longitude)')
          .eq('id', id)
          .single();
        if (error || !data) throw error;
        const order = data as unknown as DeliveryOrder;
        setOrder(order);
        // If already delivered (e.g. rider navigates back), go home
        if (order.status === 'delivered') {
          navigate('/');
          return;
        }
        // Auto-open OTP modal for deliveries — rider is at the customer's door
        // NOTE: For returns (return_dispatched), rider must navigate to customer first,
        // then manually tap "Mark as Collected" to open the OTP modal.
        if (['out_for_delivery', 'dispatched'].includes(order.status)) {
          setShowOtpModal(true);
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

  // ── Open Google Maps (mirrors warehouse pattern) ─────────────────────────────

  const handleOpenGoogleMaps = useCallback(() => {
    let destination: string;
    if (destAddress && destAddress !== 'Delivery address unavailable') {
      destination = encodeURIComponent(destAddress);
    } else if (destLat != null && destLng != null) {
      destination = `${destLat},${destLng}`;
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
      // Only initialize tracking once per session
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

      // Push update
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

  // ── Init map ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!order || !riderLocation || !mapRef.current) return;
    if (!isMapboxAvailable()) return;
    if (mapInstance.current) return;
    if (!destLat || !destLng) return;

    let mounted = true;

    (async () => {
      try {
        const map = await initializeMap(mapRef.current!, riderLocation, 14);
        
        if (!mounted) {
          map.remove();
          return;
        }
        mapInstance.current = map;

        const setupMap = async () => {
          let routeDrawn = false;

          if (riderLocation) {
            try {
              const [rLng, rLat] = riderLocation;
              const routeCoords = await fetchMapplsRoute(rLng, rLat, destLng!, destLat!);
              if (routeCoords?.length) {
                await drawRoute(map, routeCoords);
                routeDrawn = true;
              }
            } catch (err) {
              console.warn('[DeliveryNav] Mappls Route API failed:', err);
            }
          }

          if (!routeDrawn) {
            await drawRoute(map, [riderLocation, [destLng!, destLat!]]);
          }

          try {
            const geolocate = new (mapboxgl.GeolocateControl as any)({
              positionOptions: { enableHighAccuracy: true },
              trackUserLocation: true,
              showUserHeading: true,
            });
            map.addControl(geolocate);
          } catch { /* mapboxgl may not have GeolocateControl */ }

          setMapReady(true);
        };

        if (map.loaded && map.loaded()) {
          setupMap();
        } else if (map.on) {
          map.on('load', setupMap);
        }
      } catch (e) {
        console.error('[DeliveryNav] Map init failed:', e);
      }
    })();

    return () => {
      mounted = false;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [order, riderLocation, destLat, destLng]);

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
    `w-full py-3.5 rounded-xl bg-gradient-to-r ${gradient} text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader size="lg" text="Loading delivery..." />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div ref={mapRef} className="flex-1" />

      {/* GPS loading overlay */}
      {!riderLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 pb-32">
          <div className="text-center space-y-4 px-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
              <MapPin size={28} className="text-zinc-500" />
            </div>
            <h2 className="text-lg font-bold text-white">Getting your location...</h2>
            <p className="text-zinc-400 text-sm">Please allow GPS access to enable navigation</p>
            <div className="w-6 h-6 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* Map loading overlay */}
      {!mapReady && riderLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <Loader size="lg" text="Loading navigation..." />
        </div>
      )}

      {/* Bottom card */}
      <motion.div
        initial={{ y: 200 }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-6 left-4 right-4 bg-[#0f0f0f] rounded-3xl border border-zinc-800/80 shadow-2xl z-20"
      >
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              Delivering
            </span>
            <span className="text-[10px] text-zinc-500 ml-auto">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex items-start gap-2 mb-3">
            <MapPin size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-400">{destAddress}</p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-2.5">
          {/* Google Maps deeplink — same pattern as warehouse */}
          <button
            onClick={handleOpenGoogleMaps}
            className="w-full py-3 rounded-xl bg-[#4285F4] hover:bg-[#3b78e7] active:scale-[0.98] transition-all text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Navigation size={16} />
            Open in Google Maps
          </button>

          {/* OTP-gated delivery button */}
          <button
            onClick={handleRequestDelivery}
            disabled={deliveryCompleting}
            className={primaryBtn('from-emerald-600 to-emerald-500')}
          >
            {deliveryCompleting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><CheckCircle size={18} /> {order && RETURN_STATUSES.includes(order.status) ? 'Mark as Collected' : 'Mark as Delivered'}</>
            )}
          </button>
        </div>
      </motion.div>

      {/* OTP Verification Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-400" /> {order && RETURN_STATUSES.includes(order.status) ? 'Verify Return Pickup' : 'Verify Delivery'}
                </h3>
                <button
                  onClick={() => { if (!otpVerifying) setShowOtpModal(false); }}
                  disabled={otpVerifying}
                  className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-5 text-center">
                <p className="text-sm text-zinc-400">
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
                  className="w-full text-center text-4xl font-mono font-bold tracking-[0.3em] bg-black border border-zinc-800 rounded-xl py-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-800"
                />

                {otpError && (
                  <p className="text-sm text-red-400 font-medium">{otpError}</p>
                )}

                <button
                  onClick={handleVerifyAndDeliver}
                  disabled={otpValue.length !== 4 || otpVerifying}
                  className={primaryBtn('from-emerald-600 to-emerald-500')}
                >
                  {otpVerifying ? (
                    <><Loader2 size={18} className="animate-spin" /> Verifying...</>
                  ) : (
                    'Verify & Complete Delivery'
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
