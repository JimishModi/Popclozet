// src/pages/CheckoutPage.tsx
// Checkout flow — creates order and notifies rider app via Supabase

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  X,
  MapPin,
  Check,
  Wifi,
  Mail,
  Banknote,
  CreditCard,
  Shield,
  Loader2
} from "lucide-react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { TimeSlotPicker } from "@/components/map/TimeSlotPicker";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/SupabaseAuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getLocalAddresses, ValidatedAddress as SavedAddress, searchLocations } from "@/services/addressService";
/*import { calculateDeliveryPricing, calculateETA } from "@/services/deliveryService";*/
import type { TimeSlot } from "@/services/deliveryService";
import { createEntitledOrder, getSubscriptionBenefits, type SubscriptionBenefits } from "@/services/subscriptionService";
import { cancelOrder, placeOrder, previewOrder, resolveVariantIds, reserveCheckoutStock, releaseCheckoutStock, persistOrderReservations } from "@/services/ordersService";
import { supabase } from "@popclozet/api-client";
import { clearCartDB, clearUserCartDB } from "@/lib/db";
import {
  buildManualAddressSummary,
  clearCheckoutAddressContext,
  getCheckoutAddressContext,
  hasManualAddressDetails,
  isManualAddressComplete,
  normalizeManualAddressDetails,
  saveCheckoutAddressContext,
  type ManualAddressDetails,
} from "@/lib/addressAccuracy";
import {
  clearCheckoutDraft,
  readCheckoutDraft,
  saveCheckoutDraft,
  type CheckoutReturnSchedule,
} from "@/lib/checkoutDraft";
import { getPlanPrice } from "@/lib/pricing";
import { preloadRazorpayCheckout } from "@/lib/razorpay";
import { cn } from "@/lib/utils";
import { ALL_MOCK_PRODUCTS } from "../mocks/allProducts";

/** Returns true only if the email looks like a real user-provided address */
const isRealEmail = (email?: string | null): email is string => {
  if (!email) return false;
  if (email.includes('@phone.') || email.includes('.internal') || email.includes('@sms.')) return false;
  return email.includes('@') && email.includes('.');
};

import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { hasFreeDelivery, hasInsuranceIncluded } from "@/services/subscriptionService";
import { invokeWithUserJwt } from "@/services/supabaseFunctionInvoke";

import { WAREHOUSE, DELIVERY_THRESHOLDS } from "@/lib/serviceAreas";

/* ---------------------------------- */
/* Constants                          */
/* ---------------------------------- */
const WAREHOUSE_LOCATION = WAREHOUSE;
const MAX_DELIVERY_DISTANCE_KM = DELIVERY_THRESHOLDS.MAX_KM;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/* ---------------------------------- */
/* Helpers                            */
/* ---------------------------------- */
const getSavedHub = () => {
  try {
    const raw = localStorage.getItem("selected_hub");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getKycStorageKey = (userId: string) => `popclozet_kyc_verified:${userId}`;

const readStoredKycVerified = (userId?: string | null) => {
  if (!userId) return false;
  try {
    return localStorage.getItem(getKycStorageKey(userId)) === "true";
  } catch {
    return false;
  }
};

const writeStoredKycVerified = (userId?: string | null, value: boolean = true) => {
  if (!userId) return;
  try {
    localStorage.setItem(getKycStorageKey(userId), value ? "true" : "false");
  } catch {
    // Ignore storage failures; DB persistence is still attempted below.
  }
};

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  // FIX 7: Use useSearchParams instead of window.location.search
  const [searchParams] = useSearchParams();
  const buyoutOrderId = searchParams.get("buyoutOrderId");
  const skipDelivery = searchParams.get("skipDelivery") === 'true';
  const [checkoutDraft] = useState(() => readCheckoutDraft());

  const { cartItems, removeFromCart } = useCart();
  const { user, profile } = useAuth();
  const isOnline = useOnlineStatus();

  // Coupon code passed from CartPage via location state or search params
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(
    () => location.state?.couponCode || searchParams.get("coupon") || checkoutDraft?.appliedCouponCode || null
  );

  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [addressList, setAddressList] = useState<SavedAddress[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(() => checkoutDraft?.agreedToTerms ?? false);
  const [agreedToSizing, setAgreedToSizing] = useState(() => checkoutDraft?.agreedToSizing ?? false);
  const [userIp, setUserIp] = useState<string>("");

  // FIX 2: Declare missing showTermsModal state
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Payment method: 'upi' (online) or 'cod'
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod' | null>(() => {
    try {
      return localStorage.getItem("preferred_payment_method") as 'upi' | 'cod' | null;
    } catch {
      return null;
    }
  });
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const { initiatePayment, isProcessing: isRazorpayProcessing } = useRazorpayCheckout();

  const [buyoutOrderData, setBuyoutOrderData] = useState<any>(null);
  const [buyoutLoading, setBuyoutLoading] = useState(false);

  // KYC States — init from localStorage cache to prevent flash
  const [kycVerified, setKycVerified] = useState<boolean>(() => readStoredKycVerified(user?.id));
  const [showKycGate, setShowKycGate] = useState<boolean>(false);
  const [isKycLoading, setIsKycLoading] = useState<boolean>(false);

  // RECIPIENT INFORMATION (Editable overrides for ordering for others)
  const [recipientName, setRecipientName] = useState<string>(() => checkoutDraft?.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState<string>(() => checkoutDraft?.recipientPhone ?? "");
  const [recipientEmail, setRecipientEmail] = useState<string>(() => checkoutDraft?.recipientEmail ?? "");
  const [showRecipientEditor, setShowRecipientEditor] = useState(false);

  // Sync recipient state with profile/user initially
  useEffect(() => {
    if (!recipientName && (profile?.full_name || user?.user_metadata?.full_name)) {
      setRecipientName(profile?.full_name || user?.user_metadata?.full_name || "");
    }
    if (!recipientPhone && (profile?.phone || user?.phone)) {
      setRecipientPhone(profile?.phone || user?.phone || "");
    }
    if (!recipientEmail && (profile?.email || user?.email)) {
      setRecipientEmail(profile?.email || user?.email || "");
    }
  }, [profile, user, recipientName, recipientPhone, recipientEmail]);

  // Fetch IP address for legal logging (with timeout — non-blocking)
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("https://api.ipify.org?format=json", { signal: controller.signal })
      .then(res => res.json())
      .then(data => setUserIp(data.ip))
      .catch(() => { /* IP is best-effort — falls back to 'unknown' */ })
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  // Fetch KYC status from DB (DB is the source of truth)
  const fetchKycStatus = useCallback(() => {
    if (!user?.id) return;

    supabase
      .from("customer_profiles")
      .select("kyc_verified")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[KYC] Failed to fetch persisted KYC status:", error);
          return;
        }

        const isVerified = Boolean(data?.kyc_verified);
        writeStoredKycVerified(user.id, isVerified);
        setKycVerified(isVerified);
      });
  }, [user?.id]);

  // Check URL params for KYC callback — just re-fetch DB status (webhook sets the actual value)
  useEffect(() => {
    const kycCallback = searchParams.get("kyc_callback");

    if (kycCallback === "success") {
      fetchKycStatus();
      toast.success("Verification submitted! Checking status...");

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("kyc_callback");
      newParams.delete("user_id");
      const newUrl = window.location.pathname + (newParams.toString() ? `?${newParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, fetchKycStatus]);

  // Fetch initial KYC status
  useEffect(() => {
    fetchKycStatus();
  }, [fetchKycStatus]);

  // Re-fetch KYC status when user returns to tab (e.g. after Didit verification)
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchKycStatus();
        retryTimer = setTimeout(fetchKycStatus, 3000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimeout(retryTimer);
    };
  }, [fetchKycStatus]);

  // Save payment method preference
  useEffect(() => {
    if (paymentMethod) {
      localStorage.setItem("preferred_payment_method", paymentMethod);
    }
  }, [paymentMethod]);

  // Force payment to online-only when no delivery (no cash collection possible)
  const isNoDeliveryFlow = skipDelivery || !!buyoutOrderId;

  useEffect(() => {
    if (isNoDeliveryFlow && paymentMethod === 'cod') {
      setPaymentMethod('upi');
    }
  }, [isNoDeliveryFlow, paymentMethod]);

  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress | null>(null);
  const [manualAddressDetails, setManualAddressDetails] = useState<ManualAddressDetails | null>(null);
  const [selectedHub, setSelectedHub] = useState<any>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popInsurance, setPopInsurance] = useState(true);
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  // Track the last address TEXT we attempted geocoding on, to prevent infinite re-geocode loops.
  // After reGeocodeAndFetch succeeds, deliveryAddress updates (triggering the effect again),
  // but the address TEXT stays the same, so we skip re-geocoding on the second run.
  const lastGeocodedAddressRef = useRef<string | null>(null);
  // Track the last destination string we fetched distance for, to skip redundant API calls on tab switch
  const lastDistanceFetchRef = useRef<string | null>(null);
  const [showDistanceWarningPopup, setShowDistanceWarningPopup] = useState(false);
  const [hasFreeDeliveryBenefit, setHasFreeDeliveryBenefit] = useState(false);
  const [hasInsuranceBenefit, setHasInsuranceBenefit] = useState(false);

  const [cartProducts, setCartProducts] = useState<Record<string, any>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);

  const cartEntries = Object.entries(cartItems);

  const validCartEntries = useMemo(() => {
    return cartEntries.filter(([key, data]) => {
      const parts = key.split('_');
      const productId = parts[0];
      return cartProducts[productId] !== undefined;
    });
  }, [cartEntries, cartProducts]);

  const [subBenefits, setSubBenefits] = useState<SubscriptionBenefits | null>(null);
  const [upiId, setUpiId] = useState<string>("");
  const [selectedOrderType, setSelectedOrderType] = useState<'rental' | 'home_try_on'>(
    () => checkoutDraft?.selectedOrderType ?? 'rental'
  );
  const [selectedScheduledSlot, setSelectedScheduledSlot] = useState<TimeSlot | null>(null);

  // Read return schedule from state (set by CheckoutReturnSchedulePage)
  const returnSchedule =
    (location.state?.returnSchedule as CheckoutReturnSchedule | undefined) ??
    checkoutDraft?.returnSchedule ??
    undefined;

  const isAddressComplete = useMemo(() => isNoDeliveryFlow || isManualAddressComplete(manualAddressDetails), [isNoDeliveryFlow, manualAddressDetails]);

  const manualAddressSummary = buildManualAddressSummary(manualAddressDetails);
  const showManualAddress = hasManualAddressDetails(manualAddressDetails);

  useEffect(() => {
    saveCheckoutDraft({
      appliedCouponCode,
      agreedToTerms,
      agreedToSizing,
      recipientName,
      recipientPhone,
      recipientEmail,
      selectedOrderType,
      returnSchedule: returnSchedule ?? null,
    });
  }, [
    appliedCouponCode,
    agreedToTerms,
    agreedToSizing,
    recipientName,
    recipientPhone,
    recipientEmail,
    selectedOrderType,
    returnSchedule,
  ]);

  useEffect(() => {
    if (paymentMethod !== "upi") return;

    preloadRazorpayCheckout().catch((err) => {
      console.warn("[Checkout] Razorpay preload failed:", err);
    });
  }, [paymentMethod]);

  // Load subscription benefit and handle passed address
  useEffect(() => {
    const passedAddress = location.state?.selectedAddress;
    const passedManualAddress = normalizeManualAddressDetails(location.state?.manualAddressDetails);
    const storedAddressContext = getCheckoutAddressContext();
    const addresses = getLocalAddresses();

    setAddressList(addresses);

    if (passedAddress) {
      setDeliveryAddress(passedAddress);
      setManualAddressDetails(passedManualAddress);
      saveCheckoutAddressContext({
        selectedAddress: passedAddress,
        manualAddressDetails: passedManualAddress,
      });
    } else if (storedAddressContext?.selectedAddress) {
      setDeliveryAddress(storedAddressContext.selectedAddress);
      setManualAddressDetails(storedAddressContext.manualAddressDetails);
    } else {
      if (addresses.length > 0) {
        setDeliveryAddress(addresses[0]);
      }
      setManualAddressDetails(null);
    }

    const hub = getSavedHub();
    if (hub) setSelectedHub(hub);

    // Subscription model commented out — not enforced currently
    // const checkSub = async () => {
    //   const benefits = await getSubscriptionBenefits();
    //   if (benefits) {
    //     setSubBenefits(benefits);
    //     setHasFreeDeliveryBenefit(benefits.freeDelivery);
    //     setHasInsuranceBenefit(benefits.insuranceIncluded);
    //     if (benefits.insuranceIncluded) setPopInsurance(true);
    //   } else {
    //     setSubBenefits(null);
    //     setHasFreeDeliveryBenefit(false);
    //     setHasInsuranceBenefit(false);
    //   }
    // };
    // checkSub();
    setSubBenefits(null);
    setHasFreeDeliveryBenefit(false);
    setHasInsuranceBenefit(false);
  }, [location.state]);

  useEffect(() => {
    if (!subBenefits?.hasFreeHomeTryOn && selectedOrderType === 'home_try_on') {
      setSelectedOrderType('rental');
    }

    if (!subBenefits?.hasAdvanceBooking && selectedOrderType === 'rental' && selectedScheduledSlot) {
      setSelectedScheduledSlot(null);
    }
  }, [selectedOrderType, selectedScheduledSlot, subBenefits]);

  useEffect(() => {
    if (!deliveryAddress) return;

    saveCheckoutAddressContext({
      selectedAddress: deliveryAddress,
      manualAddressDetails,
    });
  }, [deliveryAddress, manualAddressDetails]);


  // Distance Check Effect (Supabase Edge Function + Haversine fallback)
  useEffect(() => {
    const fetchDistance = async (destination: { lat?: number; lng?: number; eLoc?: string | null }) => {
      const normalizedLat =
        typeof destination.lat === "number" && Number.isFinite(destination.lat)
          ? destination.lat
          : 0;
      const normalizedLng =
        typeof destination.lng === "number" && Number.isFinite(destination.lng)
          ? destination.lng
          : 0;
      const destinationKey = destination.eLoc ?? `${normalizedLat},${normalizedLng}`;

      // Skip if we already fetched distance for this exact destination.
      if (lastDistanceFetchRef.current === destinationKey && actualDistance !== null) {
        console.log(
          `[Checkout] Distance already cached for ${destinationKey} (${actualDistance}km) — skipping`
        );
        return;
      }
      lastDistanceFetchRef.current = destinationKey;

      setDistanceLoading(true);
      setDistanceError(null);

      try {
        console.log("[Checkout] Resolving distance via shared map service:", {
          origin: WAREHOUSE_LOCATION,
          destination: {
            lat: normalizedLat,
            lng: normalizedLng,
            eLoc: destination.eLoc ?? null,
          },
        });

        const { getRoadDistance } = await import("@/services/mapServices");
        const result = await getRoadDistance(WAREHOUSE_LOCATION, {
          lat: normalizedLat,
          lng: normalizedLng,
          ...(destination.eLoc ? { eLoc: destination.eLoc } : {}),
        });

        if (result.status !== "success" || !Number.isFinite(result.distanceKm)) {
          throw new Error(result.error || "Distance service temporarily unavailable");
        }

        const distance = result.distanceKm;
        console.log("[DistanceCheck] Verified distance:", distance);
        setActualDistance(distance);
        if (distance > MAX_DELIVERY_DISTANCE_KM) {
          setDistanceError(`This area is out of our current service range (${MAX_DELIVERY_DISTANCE_KM}km).`);
        }
      } catch (error) {
        console.warn("[Checkout] Distance resolution failed:", error);
        setDistanceError("Distance service temporarily unavailable");
        setActualDistance(null);
      } finally {
        setDistanceLoading(false);
      }
    };

    const reGeocodeAndFetch = async (addressText: string, reason: string) => {
      console.warn(`[Checkout] Re-geocoding address (${reason}):`, addressText);
      setIsResolvingAddress(true);
      setDistanceError(null);

      try {
        const { geocodeAddress } = await import("@/services/mapServices");
        const res = await geocodeAddress(addressText);

        if (res.status === 'success' && (res.eLoc || (res.lat && res.lng))) {
          const dest = {
            lat: res.lat,
            lng: res.lng,
            eLoc: res.eLoc ?? null,
          };
          console.log(`[Checkout] Re-geocoded ✓  dest="${dest}" (lat=${res.lat} lng=${res.lng} eLoc=${res.eLoc ?? 'none'})`);

          // Update deliveryAddress with fresh coords so the order record is correct
          setDeliveryAddress(prev => prev ? {
            ...prev,
            lat: res.lat,
            lng: res.lng,
            eLoc: res.eLoc ?? prev.eLoc,
          } : prev);

          await fetchDistance(dest);
        } else {
          console.error('[Checkout] Re-geocoding returned no usable result for:', addressText);
          setDistanceError("Could not verify delivery address. Please re-select your address.");
          setActualDistance(null);
        }
      } catch (err) {
        console.error('[Checkout] Re-geocoding threw:', err);
        setDistanceError("Could not resolve address location");
        setActualDistance(null);
      } finally {
        setIsResolvingAddress(false);
      }
    };

    if (deliveryAddress) {
      console.log("[Checkout] Starting distance check for:", deliveryAddress.formattedAddress);

      const lat = typeof deliveryAddress.lat === 'number' ? deliveryAddress.lat : parseFloat(deliveryAddress.lat as any);
      const lng = typeof deliveryAddress.lng === 'number' ? deliveryAddress.lng : parseFloat(deliveryAddress.lng as any);
      const hasCoords = !isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.01;

      console.log("[Checkout] Address Data:", { eLoc: deliveryAddress.eLoc, lat, lng, hasCoords });

      // Sanity check: if stored coords are suspiciously close to the warehouse,
      // the coordinates are likely stale from a previous address save.
      const suspiciouslyCloseToWarehouse =
        hasCoords &&
        Math.abs(lat - WAREHOUSE_LOCATION.lat) < 0.1 &&
        Math.abs(lng - WAREHOUSE_LOCATION.lng) < 0.1;

      if (deliveryAddress.eLoc) {
        // Preferred path: use the eLoc directly (most accurate with MapMyIndia)
        console.log("[Checkout] Using eLoc for distance:", deliveryAddress.eLoc);
        lastGeocodedAddressRef.current = deliveryAddress.formattedAddress; // mark as handled
        fetchDistance({
          lat,
          lng,
          eLoc: deliveryAddress.eLoc,
        });
      } else if (deliveryAddress.formattedAddress) {
        const addrText = deliveryAddress.formattedAddress;

        // INFINITE LOOP GUARD: if we already attempted geocoding this exact address text,
        // use the coordinates we have instead of re-geocoding forever.
        if (lastGeocodedAddressRef.current === addrText) {
          console.log("[Checkout] Already geocoded this address — using existing coords to avoid loop.");
          if (hasCoords) {
            fetchDistance({ lat, lng });
          } else {
            setDistanceError("Could not verify delivery address. Please re-select your address.");
            setActualDistance(null);
          }
          return;
        }

        // No eLoc — re-geocode the address text to get fresh coords + eLoc.
        if (suspiciouslyCloseToWarehouse) {
          console.warn(
            `[Checkout] ⚠️  Coords (${lat},${lng}) suspiciously close to warehouse ` +
            `(${WAREHOUSE_LOCATION.lat},${WAREHOUSE_LOCATION.lng}) — may be stale, re-geocoding.`
          );
        }
        lastGeocodedAddressRef.current = addrText; // mark BEFORE async call to prevent re-entry
        reGeocodeAndFetch(addrText, !hasCoords ? 'no coordinates stored' : 'no eLoc — re-geocoding for accuracy');
      } else {
        setDistanceError("Location coordinates not found");
        setActualDistance(null);
      }
    }
  }, [deliveryAddress]);


  // Fetch cart products dynamically
  useEffect(() => {
    const fetchCartProducts = async () => {
      const uniqueIds = Array.from(new Set(cartEntries.map(([id]) => id.split('_')[0])));
      if (uniqueIds.length === 0) {
        setCartProducts({});
        setLoadingProducts(false);
        return;
      }

      const { data, error } = await supabase.from('products').select('*').in('id', uniqueIds);
      let productMap: Record<string, any> = {};
      if (data && !error) {
        data.forEach((p: any) => {
          const mrp = parseFloat(p.mrp ?? '0');
          productMap[p.id] = {
            ...p,
            mrp,
            rental_price_1d: p.rental_price_1d,
            rental_price_2d: p.rental_price_2d,
            rental_price_3d: p.rental_price_3d,
            buy_price: p.buy_price,
            price: parseFloat(p.rental_price ?? p.price ?? '0'),
            originalPrice: mrp,
            imageUrl: p.images?.[0] || '',
            isLiveProduct: true,
          };
        });
      }

      uniqueIds.forEach(id => {
        if (!productMap[id]) {
          const mockup = ALL_MOCK_PRODUCTS.find((p: any) => p.id === id);
          if (mockup) {
            productMap[id] = {
              ...mockup,
              price: mockup.rentalPrice || mockup.price || 0,
              originalPrice: mockup.price || 0,
              imageUrl: mockup.imageUrl || mockup.images?.[0] || '',
              isLiveProduct: false,
            };
          }
        }
      });

      setCartProducts(productMap);
      setLoadingProducts(false);
    };

    fetchCartProducts();
  }, [JSON.stringify(cartEntries.map(([key]) => key.split('_')[0]))]);

  // Load Buyout Order if specified
  useEffect(() => {
    if (!buyoutOrderId) return;
    const fetchBuyout = async () => {
      setBuyoutLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*, item:products (*))`)
        .eq('id', buyoutOrderId)
        .single();

      if (data && !error) setBuyoutOrderData(data);
      setBuyoutLoading(false);
    };
    fetchBuyout();
  }, [buyoutOrderId]);

  // Check subscription limits
  const totalQty = useMemo(() => {
    return validCartEntries.reduce((sum, [, data]) => sum + data.quantity, 0);
  }, [validCartEntries]);

  const invalidCatalogItem = validCartEntries.find(([id]) => {
    const baseId = id.split('_')[0];
    const product = cartProducts[baseId];
    return !product?.isLiveProduct || !UUID_PATTERN.test(baseId);
  });
  const exceedsMonthlyLimit = subBenefits ? totalQty > subBenefits.remainingMonthly : false;
  const exceedsConcurrentLimit = subBenefits ? totalQty > subBenefits.remainingConcurrent : false;
  const requiresScheduledSlot = selectedOrderType === 'home_try_on';
  const expensiveItem = subBenefits ? validCartEntries.find(([id]) => {
    const p = cartProducts[id.split('_')[0]];
    const value = p?.mrp || p?.originalPrice || p?.price || 0;
    return value > subBenefits.maxItemValue;
  }) : undefined;
  const hasExpensiveItem = !!expensiveItem;

  // Calculate if the cart contains any rental items
  const hasRentals = useMemo(() => {
    if (buyoutOrderId) return false;
    return validCartEntries.some(([, data]) => ['1d', '2d', '3d'].includes(data.plan));
  }, [validCartEntries, buyoutOrderId]);

  // Derive rental duration for slot calculation fallback
  const rentalDurationDays = useMemo(() => {
    if (validCartEntries.length === 0) return 3;
    const rentalEntry = validCartEntries.find(([, data]) => ['1d', '2d', '3d'].includes(data.plan));
    if (!rentalEntry) return 0;
    const plan = rentalEntry[1].plan;
    return plan === '1d' ? 1 : plan === '2d' ? 2 : 3;
  }, [validCartEntries]);

  // Removed subscription error logic
  const subscriptionError = null;

  // ── Server-side pricing (source of truth) ──
  // preview_order RPC computes all prices from the DB.
  // Client-side estimates are only used as instant fallbacks while the RPC loads.
  const [serverPricing, setServerPricing] = useState<{
    original_total: number; subtotal: number; discount: number;
    coupon_discount: number; delivery_fee: number; total: number;
  } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Build preview items from cart (no prices — just IDs/sizes/plans/quantities)
  const previewItems = useMemo(() => {
    if (buyoutOrderData) return [];
    return validCartEntries.map(([key, data]) => {
      const parts = key.split('_');
      return {
        product_id: parts[0],
        size: parts[1] || 'One Size',
        plan: data.plan || '3d',
        quantity: data.quantity || 1,
      };
    });
  }, [validCartEntries, buyoutOrderData]);

  // Stable keys to prevent unnecessary re-fetches
  const previewItemsKey = JSON.stringify(previewItems);
  const checkoutAddressKey = deliveryAddress?.id || (deliveryAddress?.lat && deliveryAddress?.lng ? `${deliveryAddress.lat},${deliveryAddress.lng}` : 'none');

  // Fetch server-side pricing whenever cart items or address change
  useEffect(() => {
    const items = JSON.parse(previewItemsKey);
    if (items.length === 0 || buyoutOrderData) {
      setServerPricing(null);
      setPricingLoading(false);
      return;
    }
    if (invalidCatalogItem) {
      setServerPricing(null);
      setPricingLoading(false);
      return;
    }
    let cancelled = false;
    setPricingLoading(true);
    previewOrder({
      items,
      couponCode: appliedCouponCode,
      distanceKm: isNoDeliveryFlow ? 0 : (actualDistance ?? selectedHub?.distance_km ?? profile?.delivery_distance_km ?? 0),
      addressId: isNoDeliveryFlow ? null : (deliveryAddress?.id || null),
      lat: isNoDeliveryFlow ? null : (deliveryAddress?.lat || null),
      lng: isNoDeliveryFlow ? null : (deliveryAddress?.lng || null),
    }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setServerPricing({
          original_total: result.original_total ?? 0,
          subtotal: result.subtotal ?? 0,
          discount: result.discount ?? 0,
          coupon_discount: result.coupon_discount ?? 0,
          delivery_fee: isNoDeliveryFlow ? 0 : (result.delivery_fee ?? 60),
          total: isNoDeliveryFlow
            ? (result.subtotal ?? 0) - (result.coupon_discount ?? 0)
            : (result.total ?? 0),
        });
      } else {
        console.warn("[Checkout] preview_order returned:", result.code, result.message);
        if (result.code === 'OUT_OF_RANGE') {
          setDistanceError(result.message || 'This area is outside our delivery range (max 7km).');
        }
      }
    }).catch((err) => {
      if (!cancelled) {
        console.warn("[Checkout] preview_order failed:", err);
      }
    }).finally(() => {
      if (!cancelled) setPricingLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewItemsKey, checkoutAddressKey, appliedCouponCode, isNoDeliveryFlow, buyoutOrderData, actualDistance, selectedHub?.distance_km, profile?.delivery_distance_km, invalidCatalogItem]);

  // ── Display values: prefer server pricing, fall back to client estimates ──
  const subtotal = serverPricing?.subtotal != null
    ? Math.round(serverPricing.subtotal)
    : (() => {
      if (buyoutOrderData) return Math.round(buyoutOrderData.total_amount * 0.7);
      return Math.round(validCartEntries.reduce((sum, [key, data]) => {
        const productId = key.split('_')[0];
        const product = cartProducts[productId];
        const price = getPlanPrice(product, data.plan);
        return sum + price * (data.quantity || 1);
      }, 0));
    })();

  const originalTotal = serverPricing?.original_total != null
    ? Math.round(serverPricing.original_total)
    : (() => {
      if (buyoutOrderData) return Math.round(buyoutOrderData.total_amount);
      return Math.round(validCartEntries.reduce((sum, [key, data]) => {
        const productId = key.split('_')[0];
        const product = cartProducts[productId];
        const planPrice = getPlanPrice(product, data.plan);
        const mrp = typeof product?.mrp === 'number' ? product.mrp : planPrice;
        return sum + Math.max(mrp, planPrice) * (data.quantity || 1);
      }, 0));
    })();

  const discount = serverPricing?.discount != null
    ? Math.round(serverPricing.discount)
    : Math.max(0, originalTotal - subtotal);
  const couponDiscount = serverPricing?.coupon_discount != null
    ? Math.round(serverPricing.coupon_discount)
    : 0;

  // Delivery fee is computed server-side by preview_order RPC — no client-side default.
  const deliveryFeeBase = serverPricing?.delivery_fee != null
    ? Math.round(serverPricing.delivery_fee)
    : null;
  const distanceSurcharge = 0;

  const deliveryFee = isNoDeliveryFlow ? 0 : deliveryFeeBase;
  const isDeliveryFeeWaived = isNoDeliveryFlow;
  const insuranceFee = 0;
  const total = serverPricing?.total != null ? Math.round(serverPricing.total) : null;

  /* ---------------------------------- */
  /* Payment Processing                  */
  /* ---------------------------------- */
  const [showEmailGate, setShowEmailGate] = useState(false);

  /* ---------------------------------- */
  /* Place Order (Razorpay + COD)        */
  /* ---------------------------------- */
  // Idempotency key ref — generated once per checkout attempt to prevent duplicate orders
  const idempotencyKeyRef = useRef<string | null>(null);
  // Synchronous lock to prevent double-submit (React state is async and can't block rapid clicks)
  const placingOrderLockRef = useRef(false);

  const syncOrderAddressDetails = useCallback(
    async (orderId: string, userId: string, addressId: string) => {
      if (!deliveryAddress) return;

      const normalizedManualAddress = normalizeManualAddressDetails(manualAddressDetails);
      const deliveryAddressSnapshot = {
        address_id: addressId,
        full_address: deliveryAddress.formattedAddress,
        lat: deliveryAddress.lat,
        lng: deliveryAddress.lng,
      };

      const { error: addressDetailsError } = await supabase.rpc(
        "sync_order_address_details",
        {
          p_order_id: orderId,
          p_delivery_address_snapshot: deliveryAddressSnapshot,
          p_manual_address_details: normalizedManualAddress,
        }
      );

      if (addressDetailsError) {
        console.warn(
          "[Checkout] Could not sync address details to order:",
          addressDetailsError.message
        );
        return;
      }

      clearCheckoutAddressContext();
    },
    [deliveryAddress, manualAddressDetails]
  );

  const handlePlaceOrder = async () => {
    // Network check — fail fast on offline
    if (!isOnline) {
      toast.error("You're offline. Please check your internet connection and try again.");
      return;
    }

    // KYC Gate
    if (!kycVerified) {
      setShowKycGate(true);
      return;
    }

    if (!isAddressComplete) {
      toast.error("Please add address details (flat no, landmark, etc) to continue");
      navigate("/checkout/address-details", {
        state: {
          selectedAddress: deliveryAddress,
          manualAddressDetails,
          nextRoute: "/checkout",
          forwardState: {
            returnSchedule,
          },
        },
      });
      return;
    }

    // Only gate on email if they actually have a real email set
    const realEmail = isRealEmail(profile?.email) ? profile!.email : null;
    if (realEmail && !profile?.email_verified) {
      setShowEmailGate(true);
      return;
    }

    if (distanceError) {
      toast.error(distanceError);
      return;
    }

    if (!buyoutOrderId && validCartEntries.length === 0) return;
    if (!agreedToTerms || !agreedToSizing) {
      setShowTermsModal(true);
      return;
    }

    if (!paymentMethod) {
      setShowPaymentMethodSelector(true);
      return;
    }

    if (invalidCatalogItem) {
      toast.error("One or more items are unavailable right now. Please remove them and try again.");
      return;
    }

    // Return schedule is mandatory for rental orders
    if (hasRentals && !returnSchedule?.pickupSlotIso) {
      toast.error("Please select a return pickup slot before placing your order.");
      navigate("/checkout/return-schedule", { state: { selectedAddress: deliveryAddress, manualAddressDetails } });
      return;
    }

    // Prevent double-submit: synchronous ref check blocks rapid clicks immediately
    // (React state `isPlacingOrder` is async and can't prevent two near-simultaneous calls)
    if (placingOrderLockRef.current || isPlacingOrder) return;
    placingOrderLockRef.current = true;

    console.log('[Checkout] Starting order placement...', { paymentMethod });
    setError(null);
    setIsPlacingOrder(true);

    try {
      if (!supabase) throw new Error("Service unavailable");

      const userId = user?.id;
      if (!userId) throw new Error("Please sign in to place an order");

      // --- Buyout Flow (keep-it) ---
      // Uses state machine RPC instead of direct status updates
      if (buyoutOrderId) {
        const targetId = buyoutOrderId;

        if (paymentMethod === 'cod') {
          // Use confirm_order_payment RPC for safe state transition
          const { data: confirmResult, error: confirmErr } = await supabase.rpc("confirm_order_payment", {
            p_order_id: buyoutOrderId,
          });
          if (confirmErr) throw new Error(confirmErr.message);
          if (confirmResult && !confirmResult.success) throw new Error(confirmResult.message || "Could not confirm buyout order");

          // Clear only this user's cart (not all users on shared device)
          await (userId ? clearUserCartDB(userId) : clearCartDB()).catch(() => { });
          for (const [key, data] of validCartEntries) {
            const parts = key.split('_');
            removeFromCart(parts[0], data.size, data.plan);
          }
          clearCheckoutDraft();
          navigate(`/order-confirmed/${targetId}`, { replace: true });
        } else {
          setIsPlacingOrder(false);
          placingOrderLockRef.current = false;
          initiatePayment({
            internalOrderId: targetId,
            amountInRupees: total,
            preferredMethod: 'upi',
            userName: profile?.full_name || user?.user_metadata?.full_name,
            userEmail: profile?.email,
            userPhone: profile?.phone || user?.phone,
          });
        }
        return;
      }

      // 1) Get or create a delivery address
      const addrFull = deliveryAddress?.formattedAddress || "Default Address, Mumbai";
      const addrLat = deliveryAddress?.lat || 19.076;
      const addrLng = deliveryAddress?.lng || 72.8777;

      let addressId: string;
      const { data: existingAddr } = await supabase
        .from("addresses")
        .select("id")
        .eq("user_id", userId)
        .eq("full_address", addrFull)
        .limit(1)
        .maybeSingle();

      if (existingAddr) {
        addressId = existingAddr.id;
      } else {
        const { data: newAddr, error: addrErr } = await supabase
          .from("addresses")
          .insert({
            user_id: userId,
            label: deliveryAddress?.label || "Delivery",
            full_address: addrFull,
            latitude: addrLat,
            longitude: addrLng,
            geohash: `${addrLat.toFixed(2)}_${addrLng.toFixed(2)}`,
            eloc: deliveryAddress?.eLoc || null,
            is_default: true,
          })
          .select("id")
          .single();

        if (addrErr || !newAddr) throw new Error(addrErr?.message || "Could not save delivery address");
        addressId = newAddr.id;
      }

      // Compute rental dates
      const rentalDays = validCartEntries.length > 0 && validCartEntries[0][1].plan === '1d' ? 1
        : validCartEntries.length > 0 && validCartEntries[0][1].plan === '2d' ? 2
          : validCartEntries.length > 0 && validCartEntries[0][1].plan === 'buy' ? 0
            : 3;
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + rentalDays * 24 * 60 * 60 * 1000);
      const routeDistanceKm = actualDistance ?? selectedHub?.distance_km ?? profile?.delivery_distance_km ?? 0;
      const deliveryEtaMins = 60;
      const deliveryEtaStr = new Date(startDate.getTime() + deliveryEtaMins * 60000).toISOString();
      const deliveryEstimateVal = '60min';

      // Parse pre-scheduled return slot if provided
      let returnPickupDate: string | null = null;
      let returnTimeSlot: string | null = null;
      if (returnSchedule?.pickupSlotIso) {
        const slotDate = new Date(returnSchedule.pickupSlotIso);
        returnPickupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
          .format(slotDate);
        returnTimeSlot = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true
        }).format(slotDate);
      }

      // Build order items — only IDs, sizes, plans, quantities. NO prices.
      // Prices are resolved server-side from the products table.
      const orderItems = validCartEntries.map(([key, data]) => {
        const rawBaseId = key.split('_')[0];
        const likelyRealUuid = rawBaseId.includes('-');

        if (!likelyRealUuid) {
          throw new Error("Cannot order non-catalog items");
        }

        return {
          product_id: rawBaseId,
          size: data.size || 'One Size',
          plan: data.plan || '3d',
          quantity: data.quantity || 1,
        };
      });

      // ── STOCK RESERVATION ──────────────────────────────────
      // Resolve cart items to inventory variant_ids, then reserve stock
      // atomically BEFORE order creation. If reservation fails, stop.
      console.log('[Checkout] Resolving variant IDs for stock reservation...');
      let reservedItems: { variant_id: string; quantity: number }[] = [];
      try {
        const variantItems = await resolveVariantIds(
          orderItems.map(i => ({ product_id: i.product_id, size: i.size, quantity: i.quantity }))
        );

        // Reserve stock with a 15-second timeout
        const reservationPromise = reserveCheckoutStock(variantItems);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Stock reservation timed out. Please try again.')), 15000)
        );
        const reserveResult = await Promise.race([reservationPromise, timeoutPromise]);

        if (!reserveResult.success) {
          toast.error("Some items are out of stock. Please update your cart and try again.");
          setError("Out of stock — one or more items could not be reserved.");
          return;
        }

        reservedItems = variantItems;
        console.log('[Checkout] Stock reserved successfully', reservedItems);
      } catch (stockErr: any) {
        console.error('[Checkout] Stock reservation failed:', stockErr);
        const msg = stockErr.message?.includes('timed out')
          ? stockErr.message
          : stockErr.message?.includes('Insufficient stock')
            ? "Some items are out of stock. Please update your cart and try again."
            : "Could not check stock availability. Please try again.";
        toast.error(msg);
        setError(msg);
        return;
      }

      // Generate idempotency key (once per click — survives retries within the same attempt)
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `${userId}_${Date.now()}_${crypto.randomUUID()}`;
      }

      // ATOMIC order placement — order + items in a single DB transaction.
      // Server fetches prices from DB, computes delivery fee & coupon discount.
      // Client sends ONLY: product IDs, sizes, plans, quantities, coupon code, distance.
      let orderResult;
      try {
        orderResult = await placeOrder({
          idempotencyKey: idempotencyKeyRef.current,
          addressId: addressId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          paymentMethod: paymentMethod,
          couponCode: appliedCouponCode || null,
          routeDistanceKm,
          deliveryEta: deliveryEtaStr,
          returnPickupDate: returnPickupDate,
          returnTimeSlot: returnTimeSlot,
          items: orderItems,
          recipientName: recipientName,
          recipientPhone: recipientPhone,
          recipientEmail: recipientEmail,
        });
      } catch (orderErr: any) {
        // Order creation failed AFTER stock was reserved — release stock
        console.error('[Checkout] Order creation failed, releasing reserved stock:', orderErr);
        await releaseCheckoutStock(reservedItems).catch(() => {});
        throw orderErr; // Re-throw to hit the outer catch
      }

      const createdOrderId = orderResult.order_id;

      // Persist reservation records so backend can release on cancel/timeout
      if (createdOrderId && reservedItems.length > 0) {
        try {
          await persistOrderReservations(createdOrderId, reservedItems);
        } catch (e) {
          console.error('[Checkout] Failed to persist reservation records, releasing stock and cancelling order:', e);
          await releaseCheckoutStock(reservedItems).catch(() => {});
          await cancelOrder(createdOrderId).catch((cancelErr) => {
            console.warn('[Checkout] Failed to cancel order after reservation persistence failure:', cancelErr);
          });
          throw new Error('Could not safely reserve stock for this order. Please try again.');
        }
      }

      // Reset idempotency key after successful creation
      idempotencyKeyRef.current = null;

      if (orderResult.idempotent) {
        console.warn("[Checkout] Duplicate order prevented — returning existing order:", createdOrderId);
      }

      if (createdOrderId) {
        await syncOrderAddressDetails(createdOrderId, userId, addressId);
      }

      // Create pre-scheduled return request — COD only (already confirmed).
      // For online/UPI payments, the return request is created AFTER payment
      // succeeds in PaymentProcessingPage to avoid false notifications.
      if (paymentMethod === 'cod' && returnSchedule?.pickupSlotIso && createdOrderId) {
        const { error: rrErr } = await supabase
          .from('return_requests')
          .insert({
            order_id: createdOrderId,
            status: 'approved',
            reason: 'pre_scheduled',
            pickup_slot: returnSchedule.pickupSlotIso,
            pickup_address_id: addressId,
            approved_at: new Date().toISOString(),
          });
        if (rrErr) {
          console.warn('[Checkout] Return request insert failed (non-blocking):', rrErr.message);
        }
      }

      // Insert Legal Acceptance Log
      const { error: legalErr } = await supabase.from("legal_acceptances").insert({
        user_id: user?.id,
        order_id: createdOrderId,
        ip_address: userIp || 'unknown',
        tc_version: 'v1.0'
      });
      if (legalErr) {
        console.warn("[Checkout] Legal acceptance logging failed, but order placed. Details:", legalErr);
      }

      // Clear cart for COD orders — scope to this user only
      if (paymentMethod === 'cod') {
        await (userId ? clearUserCartDB(userId) : clearCartDB()).catch(() => { });
        for (const [key, data] of validCartEntries) {
          const parts = key.split('_');
          removeFromCart(parts[0], data.size, data.plan);
        }
        clearCheckoutDraft();
      }

      // Navigate based on payment method
      // Use server-computed total for payment amount (not client-side total)
      const serverTotal = orderResult.total ?? total;
      if (paymentMethod === 'cod') {
        navigate(`/order-confirmed/${createdOrderId}`, { replace: true });
      } else {
        // Pass return schedule data so PaymentProcessingPage can create the
        // return_request AFTER payment succeeds (avoids false notifications).
        const paymentParams = new URLSearchParams({
          type: 'order',
          orderId: createdOrderId,
          amount: String(serverTotal),
          method: 'upi',
        });
        if (returnSchedule?.pickupSlotIso) {
          paymentParams.set('pickupSlotIso', returnSchedule.pickupSlotIso);
          paymentParams.set('pickupAddressId', addressId);
        }
        navigate(`/payment-processing?${paymentParams.toString()}`);
      }
    } catch (err: any) {
      console.error("[Checkout] Failed to place order:", err);
      toast.error(err.message || "Failed to place order. Please try again.");
      setError(err.message || "Failed to place order. Please try again.");
      // Reset idempotency key on error so user can retry
      idempotencyKeyRef.current = null;
    } finally {
      setIsPlacingOrder(false);
      placingOrderLockRef.current = false;
    }
  };

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <main className="flex-1 overflow-y-auto pb-64">
        {buyoutLoading && (
          <div className="flex flex-col items-center justify-center pt-20">
            <div className="w-8 h-8 border-2 border-[#f2546d]/30 border-t-[#f2546d] rounded-full animate-spin" />
            <p className="text-sm text-zinc-500 mt-4">Loading order details...</p>
          </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg px-5 pt-6 pb-2">
          <div className="absolute -top-20 -left-14 w-36 h-36 rounded-full blur-[100px] pointer-events-none" style={{ background: "linear-gradient(180deg, #f2546d 0%, #ff6078 46%, #611624 88%)" }} />
          <button onClick={() => navigate(-1)} className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/5 transition-all active:scale-95">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </header>

        {subscriptionError && (
          <section className="px-5 mt-4">
            <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-4 rounded-xl flex items-start gap-3 text-sm shadow-xl backdrop-blur-md">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <p className="leading-tight">{subscriptionError}</p>
            </div>
          </section>
        )}

        {/* User Info */}
        <section className="px-5 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white" style={dmSans}>My Information</h2>
            <button
              onClick={() => setShowRecipientEditor(true)}
              className="text-xs font-bold text-[#f2546d] uppercase"
            >
              Edit
            </button>
          </div>
          <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>{recipientName || "Guest"}</p>

          <h3 className="text-lg font-black text-white mt-9" style={dmSans}>Contact Details</h3>
          <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>{recipientPhone || "No phone"}</p>
          <p className="text-sm text-[#b4b4b4] mt-1" style={dmSans}>{recipientEmail}</p>

          {/* KYC Verification Banner — shown upfront when not verified */}
          {!kycVerified && (
            <div className="mt-6 bg-[#1C1C1E] border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white" style={dmSans}>Verify your profile</p>
                  <p className="text-[11px] text-zinc-500" style={dmSans}>Complete verification to place orders</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    setIsKycLoading(true);
                    const { data, error } = await invokeWithUserJwt<{ verification_url?: string }>('create-kyc-session', {
                      body: { callbackParams: { user_id: user?.id } }
                    });
                    if (error) throw error;
                    if (data?.verification_url) {
                      window.location.href = data.verification_url;
                    } else {
                      toast.error("Could not start verification. Please try again.");
                    }
                  } catch (err: any) {
                    console.error('KYC Error:', err);
                    toast.error("Could not start verification. Please try again.");
                  } finally {
                    setIsKycLoading(false);
                  }
                }}
                disabled={isKycLoading}
                className="w-full py-3 rounded-xl bg-white text-black text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                style={dmSans}
              >
                {isKycLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isKycLoading ? "LOADING..." : "VERIFY NOW"}
              </button>
              <button
                onClick={async () => {
                  setIsKycLoading(true);
                  try {
                    const { data } = await supabase
                      .from("customer_profiles")
                      .select("kyc_verified")
                      .eq("user_id", user?.id)
                      .single();
                    if (data?.kyc_verified) {
                      setKycVerified(true);
                      toast.success("Verification confirmed!");
                    } else {
                      toast.error("Verification not complete yet. Please complete verification on Didit first, then try again.");
                    }
                  } catch (err) {
                    toast.error("Something went wrong. Please try again.");
                  } finally {
                    setIsKycLoading(false);
                  }
                }}
                disabled={isKycLoading}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-500 text-xs font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                style={dmSans}
              >
                {isKycLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isKycLoading ? "CHECKING..." : "Already verified? Tap to refresh"}
              </button>
            </div>
          )}

          {/* Address section — hide when isNoDeliveryFlow (user already has the item) */}
          {!isNoDeliveryFlow && (
            <>
              <div className="flex items-center justify-between mt-9">
                <h3 className="text-lg font-black text-white" style={dmSans}>Address</h3>
                <button onClick={() => setShowAddressSelector(true)} className="text-xs font-bold text-[#f2546d] uppercase">Change</button>
              </div>
              {deliveryAddress ? (
                <div className="mt-4 p-4 rounded-2xl bg-[#232323] border border-white/5 relative overflow-hidden">
                  <div className="relative z-10 space-y-4">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
                        Address Fetched
                      </p>
                      <p className="text-sm text-[#b4b4b4] leading-relaxed" style={dmSans}>{deliveryAddress.formattedAddress}</p>
                    </div>

                    {showManualAddress && (
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
                              Manual Address
                            </p>
                            <p className="text-sm text-white leading-relaxed" style={dmSans}>
                              {manualAddressSummary}
                            </p>
                            {(manualAddressDetails?.contactName || manualAddressDetails?.phoneNumber) && (
                              <p className="text-xs text-zinc-400 mt-2" style={dmSans}>
                                {[manualAddressDetails?.contactName, manualAddressDetails?.phoneNumber].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              navigate("/checkout/address-details", {
                                state: {
                                  selectedAddress: deliveryAddress,
                                  manualAddressDetails,
                                  nextRoute: "/checkout",
                                  forwardState: {
                                    returnSchedule,
                                  },
                                },
                              })
                            }
                            className="text-[10px] font-bold uppercase text-[#f2546d] shrink-0"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}

                    {!showManualAddress && (
                      <button
                        onClick={() =>
                          navigate("/checkout/address-details", {
                            state: {
                              selectedAddress: deliveryAddress,
                              manualAddressDetails,
                              nextRoute: "/checkout",
                              forwardState: {
                                returnSchedule,
                              },
                            },
                          })
                        }
                        className="w-full rounded-2xl border border-dashed border-[#f2546d]/30 bg-[#f2546d]/5 px-4 py-3 text-left"
                      >
                        <p className="text-xs font-bold uppercase text-[#f2546d]">Add Address Details <span className="text-[#f2546d] ml-1">*</span></p>
                        <p className="text-xs text-zinc-400 mt-1" style={dmSans}>
                          Flat number, landmark aur contact detail add kar do. (Required)
                        </p>
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2 relative z-10">
                    {isResolvingAddress ? (
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-zinc-800 animate-pulse">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Resolving address...</span>
                      </div>
                    ) : distanceLoading ? (
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-zinc-800 animate-pulse">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Checking distance...</span>
                      </div>
                    ) : distanceError ? (
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-red-900/30 border border-red-500/20">
                        <span className="text-[10px] text-red-400 font-bold">{distanceError}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#f2546d]/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />
                </div>
              ) : (
                <button
                  onClick={() =>
                    navigate("/map?returnTo=/checkout", {
                      state: { forwardState: { returnSchedule } },
                    })
                  }
                  className="w-full mt-4 p-4 rounded-2xl bg-[#232323] border border-dashed border-white/10 text-zinc-500 text-sm"
                >
                  + Select Address
                </button>
              )}
            </>
          )}
          {isNoDeliveryFlow && (
            <div className="mt-9 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-semibold text-emerald-400" style={dmSans}>✓ No delivery needed</p>
              <p className="text-xs text-emerald-400/70 mt-1" style={dmSans}>You already have this item — keeping it permanently!</p>
            </div>
          )}

          {/* Removed Plan Access UI Block */}

          {/* Scheduled Return Info */}
          {!isNoDeliveryFlow && hasRentals && (
            <div className="mt-9">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white" style={dmSans}>Scheduled Return</h3>
                {returnSchedule?.pickupSlotIso && (
                  <button
                    onClick={() => navigate("/checkout/return-schedule", { state: { selectedAddress: deliveryAddress, manualAddressDetails } })}
                    className="text-xs font-bold text-[#f2546d] uppercase"
                  >
                    Change
                  </button>
                )}
              </div>

              {returnSchedule?.pickupSlotIso ? (() => {
                const slotDate = new Date(returnSchedule.pickupSlotIso);
                const dateStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short' }).format(slotDate);
                const timeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(slotDate);
                return (
                  <div className="p-4 rounded-2xl bg-[#232323] border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-[#f2546d]/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#f2546d]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white" style={dmSans}>{dateStr}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{timeStr} • Return pickup</p>
                      </div>
                    </div>
                    {deliveryAddress?.formattedAddress && (
                      <div className="mt-4 pt-4 border-t border-white/5 relative z-10">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Pickup Address</p>
                        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2" style={dmSans}>
                          {deliveryAddress.formattedAddress}
                        </p>
                        {showManualAddress && (
                          <>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-3 mb-1">Manual Address</p>
                            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3" style={dmSans}>
                              {manualAddressSummary}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#f2546d]/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />
                  </div>
                );
              })() : (
                <button
                  onClick={() => navigate("/checkout/return-schedule", { state: { selectedAddress: deliveryAddress, manualAddressDetails } })}
                  className="w-full p-5 rounded-2xl bg-[#f2546d]/5 border border-dashed border-[#f2546d]/30 flex items-center justify-between group active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#f2546d] flex items-center justify-center shadow-lg shadow-[#f2546d]/20">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white" style={dmSans}>Schedule Return Pickup <span className="text-[#f2546d]">*</span></p>
                      <p className="text-xs text-zinc-500 mt-0.5">Required — choose a return slot to continue</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-[#f2546d] transition-colors" />
                </button>
              )}
            </div>
          )}

          <h3 className="text-lg font-black text-white mt-9" style={dmSans}>Payment Method</h3>
          <button
            onClick={() => setShowPaymentMethodSelector(true)}
            className="w-full mt-4 p-4 rounded-2xl bg-[#232323] border border-white/5 flex items-center justify-between group hover:border-[#f2546d]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              {paymentMethod === 'upi' ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-[#f2546d]/10 flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-[#f2546d]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white" style={dmSans}>Pay Online</p>
                    <p className="text-xs text-zinc-500 mt-0.5">UPI apps and QR</p>
                  </div>
                </>
              ) : paymentMethod === 'cod' ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white" style={dmSans}>Pay on Delivery</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Pay when you receive</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-zinc-500" />
                  </div>
                  <p className="text-sm font-bold text-zinc-500" style={dmSans}>Select payment method</p>
                </>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#f2546d] transition-colors" />
          </button>
        </section>

        {/* Items */}
        <section className="px-5 mt-8">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            {buyoutOrderData ? (
              buyoutOrderData.order_items?.map((oi: any) => (
                <div key={oi.id} className="w-[100px] h-[120px] rounded-2xl flex-shrink-0 bg-[#232323] overflow-hidden border border-white/5 shadow-xl">
                  {oi.item?.images?.[0] && <img src={oi.item.images[0]} className="w-full h-full object-cover" alt="" />}
                </div>
              ))
            ) : (
              validCartEntries.map(([id]) => {
                const product = cartProducts[id.split('_')[0]];
                return (
                  <div key={id} className="w-[100px] h-[120px] rounded-2xl flex-shrink-0 bg-[#232323] overflow-hidden border border-white/5 shadow-xl">
                    {product?.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Price details */}
        <section className="px-5 mt-10">
          <h2 className="text-2xl font-bold text-white mb-6" style={dmSans}>Price details</h2>
          <div className="space-y-4">
            <div className="flex justify-between text-lg text-[#b4b4b4]" style={dmSans}>
              <span>Order value</span>
              <span>₹ {originalTotal}</span>
            </div>
            <div className="flex justify-between text-lg text-[#b4b4b4]" style={dmSans}>
              <span>Discount</span>
              <span>-₹ {discount}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-lg text-green-500" style={dmSans}>
                <span>Coupon ({appliedCouponCode})</span>
                <span>-₹ {couponDiscount}</span>
              </div>
            )}
            <div className="flex justify-between text-lg text-[#b4b4b4]" style={dmSans}>
              <div className="flex flex-col">
                <span>{selectedOrderType === 'home_try_on' ? 'Home try-on delivery' : 'Delivery fee'}</span>
                {isResolvingAddress ? (
                  <span className="text-[11px] text-zinc-500 animate-pulse">Resolving address...</span>
                ) : distanceLoading ? (
                  <span className="text-[11px] text-zinc-500 animate-pulse">Checking distance...</span>
                ) : null}
              </div>
              <div className="text-right">
                {invalidCatalogItem ? (
                  <span className="text-sm font-bold text-amber-500">Item Unavailable</span>
                ) : pricingLoading || deliveryFeeBase === null ? (
                  <span className="text-zinc-500 animate-pulse">...</span>
                ) : deliveryFeeBase === -1 ? (
                  <span className="text-sm font-bold text-red-500">Not Serviceable</span>
                ) : (
                  <>
                    <span className={cn(isDeliveryFeeWaived && "line-through opacity-50")}>₹ {deliveryFeeBase}</span>
                    {isDeliveryFeeWaived && <span className="ml-2">₹ 0</span>}
                  </>
                )}
              </div>
            </div>
            {/* Removed Pop Insurance Row */}
            <div className="pt-4 border-t border-white/10 flex justify-between text-2xl font-bold text-white" style={dmSans}>
              <span>Total</span>
              <span>
                {invalidCatalogItem
                  ? <span className="text-base text-amber-500">Unavailable</span>
                  : pricingLoading || total === null
                    ? <span className="animate-pulse">...</span>
                    : <>₹ {total}</>}
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40">
        <div
          className="bg-[#232323] rounded-t-[32px] px-5 py-6 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]"
          style={{ paddingBottom: 'max(40px, calc(24px + env(safe-area-inset-bottom, 0px)))' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div onClick={() => setShowTermsModal(true)} className="flex items-center gap-2 cursor-pointer">
              <div className={cn("w-4 h-4 rounded border border-[#5f606a] flex items-center justify-center transition-colors", (agreedToTerms && agreedToSizing) ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent")}>
                {(agreedToTerms && agreedToSizing) && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Agree to <span className="text-[#f2546d] underline">Terms & Sizing</span></span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-white" style={dmSans}>
                {invalidCatalogItem
                  ? <span className="text-base text-amber-500">Unavailable</span>
                  : total === null
                    ? <span className="animate-pulse">...</span>
                    : <>₹ {total}</>}
              </p>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Final Amount</p>
            </div>
            <button
              onClick={subscriptionError ? undefined : handlePlaceOrder}
              disabled={isPlacingOrder || (validCartEntries.length === 0 && !buyoutOrderId) || !!subscriptionError || total === null || !!invalidCatalogItem || !isAddressComplete}
              className={cn(
                "h-14 px-12 rounded-2xl font-black text-lg transition-all active:scale-[0.98]",
                (isPlacingOrder || !!subscriptionError || !!invalidCatalogItem || !isAddressComplete) ? "bg-zinc-800 text-zinc-600" : "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/20"
              )}
            >
              {subscriptionError
                ? "LIMIT EXCEEDED"
                : isPlacingOrder
                  ? (paymentMethod === 'cod' ? "PLACING..." : "PAYING...")
                  : selectedOrderType === 'home_try_on'
                    ? "BOOK TRY-ON"
                    : paymentMethod === 'upi'
                      ? "PAY VIA UPI"
                      : paymentMethod === 'cod'
                        ? "PLACE ORDER"
                        : "PAY"
              }
            </button>
          </div>
        </div>
      </div>

      {/* Address Selector Drawer */}
      <Drawer.Root open={showAddressSelector} onOpenChange={setShowAddressSelector}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto pb-safe">
            <div className="p-6 overflow-y-auto">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <div className="flex justify-between items-center mb-6">
                <Drawer.Title className="text-xl font-black text-white" style={dmSans}>Select Address</Drawer.Title>
                <Drawer.Description className="sr-only">Choose a delivery address</Drawer.Description>
                <button
                  onClick={() =>
                    navigate("/map?returnTo=/checkout", {
                      state: { forwardState: { returnSchedule } },
                    })
                  }
                  className="text-sm font-bold text-[#f2546d]"
                >
                  + Add New
                </button>
              </div>
              <div className="space-y-4">
                {addressList.map((addr) => (
                  <button
                    key={addr.formattedAddress}
                    onClick={() => {
                      setShowAddressSelector(false);
                      navigate("/checkout/address-details", {
                        state: {
                          selectedAddress: addr,
                          manualAddressDetails,
                          nextRoute: "/checkout",
                          forwardState: {
                            returnSchedule,
                          },
                        },
                      });
                    }}
                    className={cn("w-full p-4 rounded-2xl text-left border", deliveryAddress?.formattedAddress === addr.formattedAddress ? "bg-[#f2546d]/10 border-[#f2546d]" : "bg-[#141414] border-white/5")}
                  >
                    <div className="flex items-start gap-4">
                      <MapPin className={cn("w-5 h-5 mt-0.5", deliveryAddress?.formattedAddress === addr.formattedAddress ? "text-[#f2546d]" : "text-zinc-600")} />
                      <p className="text-sm text-white font-bold leading-relaxed">{addr.formattedAddress}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Payment Method Selector Drawer */}
      <Drawer.Root open={showPaymentMethodSelector} onOpenChange={setShowPaymentMethodSelector}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto pb-safe">
            <div className="p-6 overflow-y-auto">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <Drawer.Title className="text-xl font-black text-white mb-2" style={dmSans}>Choose Payment Method</Drawer.Title>
              <p className="text-zinc-500 text-sm mb-6 font-medium">All payments are 100% secure and encrypted</p>
              <Drawer.Description className="sr-only">Select how you want to pay</Drawer.Description>

              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('upi')}
                  className={cn(
                    "w-full p-5 rounded-2xl text-left border transition-all",
                    paymentMethod === 'upi' ? "bg-[#f2546d]/10 border-[#f2546d]" : "bg-[#141414] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", paymentMethod === 'upi' ? "bg-[#f2546d]/20" : "bg-zinc-800")}>
                      <Wifi className={cn("w-6 h-6", paymentMethod === 'upi' ? "text-[#f2546d]" : "text-zinc-500")} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-base" style={dmSans}>Pay Online</p>
                      <p className="text-zinc-500 text-xs mt-0.5 font-medium">UPI apps and QR through Razorpay</p>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", paymentMethod === 'upi' ? "border-[#f2546d] bg-[#f2546d]" : "border-zinc-700")}>
                      {paymentMethod === 'upi' && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                  {paymentMethod === 'upi' && (
                    <p className="text-[11px] text-[#f2546d]/80 font-medium mt-3 ml-16">
                      UPI opens securely through Razorpay. Use your UPI app or QR.
                    </p>
                  )}
                </button>

                {/* COD option — hide when no delivery needed (no delivery to collect cash at) */}
                {!isNoDeliveryFlow && (
                  <button
                    onClick={() => setPaymentMethod('cod')}
                    className={cn(
                      "w-full p-5 rounded-2xl text-left border transition-all",
                      paymentMethod === 'cod' ? "bg-emerald-500/10 border-emerald-500" : "bg-[#141414] border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", paymentMethod === 'cod' ? "bg-emerald-500/20" : "bg-zinc-800")}>
                        <Banknote className={cn("w-6 h-6", paymentMethod === 'cod' ? "text-emerald-500" : "text-zinc-500")} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-base" style={dmSans}>Pay on Delivery</p>
                        <p className="text-zinc-500 text-xs mt-0.5 font-medium">Pay when you receive your order</p>
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", paymentMethod === 'cod' ? "border-emerald-500 bg-emerald-500" : "border-zinc-700")}>
                        {paymentMethod === 'cod' && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                      </div>
                    </div>
                  </button>
                )}
              </div>

              <button
                onClick={() => paymentMethod && setShowPaymentMethodSelector(false)}
                disabled={!paymentMethod}
                className={cn(
                  "w-full mt-8 py-4 rounded-2xl font-black text-lg transition-all",
                  paymentMethod ? "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/20" : "bg-zinc-800 text-zinc-600"
                )}
                style={dmSans}
              >
                CONFIRM
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Recipient Info Editor Drawer */}
      <Drawer.Root open={showRecipientEditor} onOpenChange={setShowRecipientEditor}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto pb-safe">
            <div className="p-6 overflow-y-auto">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <Drawer.Title className="text-xl font-black text-white mb-2" style={dmSans}>Delivery Contact</Drawer.Title>
              <p className="text-zinc-500 text-sm mb-6 font-medium">Who should the delivery rider contact?</p>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full mt-2 bg-[#141414] border border-white/5 rounded-2xl p-4 text-white focus:border-[#f2546d]/50 outline-none transition-all"
                    placeholder="Full Name"
                    style={dmSans}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Phone Number</label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full mt-2 bg-[#141414] border border-white/5 rounded-2xl p-4 text-white focus:border-[#f2546d]/50 outline-none transition-all"
                    placeholder="Mobile Number"
                    style={dmSans}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Email Address</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full mt-2 bg-[#141414] border border-white/5 rounded-2xl p-4 text-white focus:border-[#f2546d]/50 outline-none transition-all"
                    placeholder="Email"
                    style={dmSans}
                  />
                </div>
              </div>

              <button
                onClick={() => setShowRecipientEditor(false)}
                className="w-full mt-10 py-4 rounded-2xl bg-[#f2546d] text-white font-black text-lg shadow-xl shadow-[#f2546d]/20 active:scale-[0.98] transition-all"
                style={dmSans}
              >
                SAVE DETAILS
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* KYC Verification Gate */}
      <AnimatePresence>
        {showKycGate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKycGate(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-[#f2546d]/10 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-[#f2546d]" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3" style={dmSans}>Identity Verification</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8" style={dmSans}>
                Before placing an order, we need to quickly verify your identity. This is a one-time process.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      setIsKycLoading(true);
                      const { data, error } = await invokeWithUserJwt<{ verification_url?: string }>('create-kyc-session', {
                        body: { 
                          callbackParams: { 
                            user_id: user?.id,
                            callback_path: "/checkout",
                            app_origin: window.location.origin
                          } 
                        }
                      });
                      if (error) throw error;
                      if (data?.verification_url) {
                        window.location.href = data.verification_url;
                      } else {
                        toast.error("Could not start verification. Please try again.");
                      }
                    } catch (err: any) {
                      console.error('KYC Error:', err);
                      toast.error("Could not start verification. Please try again.");
                    } finally {
                      setIsKycLoading(false);
                    }
                  }}
                  disabled={isKycLoading}
                  className="w-full py-4 rounded-2xl bg-[#f2546d] text-white font-bold text-lg shadow-xl shadow-[#f2546d]/20 active:scale-[0.98] transition-all"
                  style={dmSans}
                >
                  {isKycLoading ? "LOADING..." : "VERIFY NOW"}
                </button>
                <button
                  onClick={async () => {
                    setIsKycLoading(true);
                    try {
                      const { data } = await supabase
                        .from("customer_profiles")
                        .select("kyc_verified")
                        .eq("user_id", user?.id)
                        .single();
                      if (data?.kyc_verified) {
                        setKycVerified(true);
                        setShowKycGate(false);
                        toast.success("Verification confirmed!");
                      } else {
                        toast.error("Verification not complete yet. Please complete verification on Didit first, then try again.");
                      }
                    } catch (err) {
                      toast.error("Something went wrong. Please try again.");
                    } finally {
                      setIsKycLoading(false);
                    }
                  }}
                  disabled={isKycLoading}
                  className="w-full py-3 rounded-2xl bg-white/5 border border-white/5 text-zinc-400 font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  style={dmSans}
                >
                  {isKycLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isKycLoading ? "CHECKING..." : "ALREADY VERIFIED? TAP TO REFRESH"}
                </button>
                <button onClick={() => setShowKycGate(false)} className="w-full py-4 text-zinc-500 font-bold text-sm tracking-widest uppercase" style={dmSans}>
                  NOT NOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email Verification Gate */}
      <AnimatePresence>
        {showEmailGate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailGate(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3" style={dmSans}>Verify Email</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8" style={dmSans}>
                For security and order confirmation, please verify your email address <span className="text-white font-bold">{profile?.email || user?.email}</span> before placing your first order.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    const emailToVerify = profile?.email || user?.email;
                    if (!emailToVerify) {
                      toast.error("No email found. Please add an email in your profile first.");
                      return;
                    }
                    try {
                      const { error } = await supabase.auth.signInWithOtp({
                        email: emailToVerify,
                        options: { emailRedirectTo: `${window.location.origin}/auth/verify-email-callback` },
                      });
                      if (error) throw error;
                      toast.success("Verify Email link sent to " + emailToVerify);
                      setShowEmailGate(false);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send link");
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all"
                  style={dmSans}
                >
                  SEND VERIFY LINK
                </button>
                <button onClick={() => setShowEmailGate(false)} className="w-full py-4 text-zinc-500 font-bold text-sm tracking-widest uppercase" style={dmSans}>
                  NOT NOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Terms Modal */}
      <Drawer.Root open={showTermsModal} onOpenChange={setShowTermsModal}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[40px] fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] max-w-[430px] mx-auto border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pb-safe">
            <div className="p-8 overflow-y-auto no-scrollbar">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-10" />
              <div className="mb-10 text-center">
                <Drawer.Title className="text-[32px] font-black text-white leading-tight tracking-tighter" style={dmSans}>Rental Rules</Drawer.Title>
                <Drawer.Description className="text-zinc-500 text-sm mt-2 font-medium">Quick summary of your liability</Drawer.Description>
              </div>

              <div className="grid grid-cols-1 gap-6 mb-12">
                <div className="flex items-center gap-5 p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-[#f2546d]/10 flex items-center justify-center flex-shrink-0">
                    <Info className="w-7 h-7 text-[#f2546d]" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Stains happen!</h4>
                    <p className="text-zinc-500 text-xs mt-1 font-bold leading-relaxed">We handle small spills and normal wear. Don't stress too much!</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <X className="w-7 h-7 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Don't wash it</h4>
                    <p className="text-zinc-500 text-xs mt-1 font-bold leading-relaxed">Professional cleaning is our job. Please avoid self-washing items.</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-7 h-7 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Returns are mandatory</h4>
                    <p className="text-zinc-500 text-xs mt-1 font-bold leading-relaxed">Late returns result in forced purchase at full MRP. Be on time!</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 mb-10">
                <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer active:scale-[0.98] transition-all">
                  <div className="pt-1">
                    <input type="checkbox" className="hidden" checked={agreedToTerms} onChange={() => setAgreedToTerms(!agreedToTerms)} />
                    <div className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", agreedToTerms ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700")}>
                      {agreedToTerms && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                  <span className="text-sm text-zinc-300 font-bold leading-snug break-words" style={dmSans}>
                    I have read and accept the{' '}
                    <a href="/docs/Terms%20%26%20condition_popclozet.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Terms & Conditions</a>,{' '}
                    <a href="/docs/Privacy%20policy.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Privacy Policy</a>, and{' '}
                    <a href="/docs/Cookies%20policy.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Cookie Policy</a>.
                  </span>
                </label>

                <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer active:scale-[0.98] transition-all">
                  <div className="pt-1">
                    <input type="checkbox" className="hidden" checked={agreedToSizing} onChange={() => setAgreedToSizing(!agreedToSizing)} />
                    <div className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", agreedToSizing ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700")}>
                      {agreedToSizing && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                  <span className="text-sm text-zinc-300 font-bold leading-snug" style={dmSans}>
                    I understand this is an <span className="text-[#f2546d]">Oversized/Adjustable</span> fit item and I accept the sizing as described.
                  </span>
                </label>
              </div>

              <button
                onClick={() => { if (agreedToTerms && agreedToSizing) setShowTermsModal(false); }}
                disabled={!agreedToTerms || !agreedToSizing}
                className={cn(
                  "w-full py-5 rounded-[24px] font-black text-lg tracking-tight transition-all",
                  (agreedToTerms && agreedToSizing) ? "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/30" : "bg-zinc-800 text-zinc-600 grayscale pointer-events-none"
                )}
                style={dmSans}
              >
                PROCEED TO PAYMENT
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Distance Warning Popup */}
      <Drawer.Root open={showDistanceWarningPopup} onOpenChange={setShowDistanceWarningPopup}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto border-t border-white/10 shadow-2xl pb-safe">
            <div className="p-8">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 rounded-3xl bg-[#f2546d]/10 flex items-center justify-center mb-6">
                  <Clock className="w-8 h-8 text-[#f2546d]" />
                </div>
                <h2 className="text-2xl font-black text-white leading-tight tracking-tighter" style={dmSans}>Long Distance Delivery</h2>
                <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 w-full">
                  <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                    Your delivery address is outside our standard free-delivery zone.
                  </p>
                  <p className="text-[#f2546d] text-[13px] font-bold mt-2">
                    A surcharge of ₹10 per km applies for distances beyond 6 km.
                  </p>
                </div>
              </div>

              {/* FIX 5: Reuse distanceSurcharge memo instead of duplicating calculation */}
              <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Base Delivery</span>
                  <span className="text-white font-bold">₹ 40</span>
                </div>
                <div className="flex justify-between items-center text-[#f2546d]">
                  <span className="text-sm font-bold uppercase tracking-wider">Distance Surcharge</span>
                  <span className="font-bold">+ ₹ {distanceSurcharge}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className="text-white font-black text-base uppercase tracking-wider">Total Delivery</span>
                  <span className="text-white font-black text-xl">{deliveryFeeBase === null ? <span className="animate-pulse">...</span> : <>₹ {deliveryFeeBase + distanceSurcharge}</>}</span>
                </div>
              </div>

              <button
                onClick={() => setShowDistanceWarningPopup(false)}
                className="w-full h-14 flex items-center justify-center rounded-[20px] bg-[#f2546d] text-white font-black text-lg shadow-xl shadow-[#f2546d]/20 active:scale-95 transition-all"
                style={dmSans}
              >
                GOT IT
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Email Verification Gate */}
      <AnimatePresence>
        {showEmailGate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailGate(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3" style={dmSans}>Verify Email</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8" style={dmSans}>
                For security and order confirmation, please verify your email address <span className="text-white font-bold">{profile?.email || user?.email}</span> before placing your first order.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    const emailToVerify = profile?.email || user?.email;
                    if (!emailToVerify) {
                      toast.error("No email found. Please add an email in your profile first.");
                      return;
                    }
                    try {
                      const { error } = await supabase.auth.signInWithOtp({
                        email: emailToVerify,
                        options: { emailRedirectTo: `${window.location.origin}/auth/verify-email-callback` },
                      });
                      if (error) throw error;
                      toast.success("Verify Email link sent to " + emailToVerify);
                      setShowEmailGate(false);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to send link");
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all"
                  style={dmSans}
                >
                  SEND VERIFY LINK
                </button>
                <button onClick={() => setShowEmailGate(false)} className="w-full py-4 text-zinc-500 font-bold text-sm tracking-widest uppercase" style={dmSans}>
                  NOT NOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Terms Modal */}
      <Drawer.Root open={showTermsModal} onOpenChange={setShowTermsModal}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[40px] fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] max-w-[430px] mx-auto border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pb-safe">
            <div className="p-8 overflow-y-auto no-scrollbar">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-10" />
              <div className="mb-10 text-center">
                <Drawer.Title className="text-[32px] font-black text-white leading-tight tracking-tighter" style={dmSans}>Rental Rules</Drawer.Title>
                <Drawer.Description className="text-zinc-500 text-sm mt-2 font-medium">Quick summary of your liability</Drawer.Description>
              </div>

              <div className="grid grid-cols-1 gap-6 mb-12">
                <div className="flex items-center gap-5 p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-[#f2546d]/10 flex items-center justify-center flex-shrink-0">
                    <Info className="w-7 h-7 text-[#f2546d]" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Stains happen!</h4>
                    <p className="text-zinc-500 text-xs mt-1 font-bold leading-relaxed">We handle small spills and normal wear. Don't stress too much!</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <X className="w-7 h-7 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Don't wash it</h4>
                    <p className="text-zinc-500 text-xs mt-1 font-bold leading-relaxed">Professional cleaning is our job. Please avoid self-washing items.</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 p-4 rounded-[24px] bg-white/[0.03] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-7 h-7 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest">Returns are mandatory</h4>
                    <p className="text-zinc-500 text-xs mt-1 font-bold leading-relaxed">Late returns result in forced purchase at full MRP. Be on time!</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 mb-10">
                <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer active:scale-[0.98] transition-all">
                  <div className="pt-1">
                    <input type="checkbox" className="hidden" checked={agreedToTerms} onChange={() => setAgreedToTerms(!agreedToTerms)} />
                    <div className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", agreedToTerms ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700")}>
                      {agreedToTerms && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                  <span className="text-sm text-zinc-300 font-bold leading-snug break-words" style={dmSans}>
                    I have read and accept the{' '}
                    <a href="/docs/Terms%20%26%20condition_popclozet.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Terms & Conditions</a>,{' '}
                    <a href="/docs/Privacy%20policy.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Privacy Policy</a>, and{' '}
                    <a href="/docs/Cookies%20policy.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Cookie Policy</a>.
                  </span>
                </label>

                <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer active:scale-[0.98] transition-all">
                  <div className="pt-1">
                    <input type="checkbox" className="hidden" checked={agreedToSizing} onChange={() => setAgreedToSizing(!agreedToSizing)} />
                    <div className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", agreedToSizing ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700")}>
                      {agreedToSizing && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                  <span className="text-sm text-zinc-300 font-bold leading-snug" style={dmSans}>
                    I understand this is an <span className="text-[#f2546d]">Oversized/Adjustable</span> fit item and I accept the sizing as described.
                  </span>
                </label>
              </div>

              <button
                onClick={() => { if (agreedToTerms && agreedToSizing) setShowTermsModal(false); }}
                disabled={!agreedToTerms || !agreedToSizing}
                className={cn(
                  "w-full py-5 rounded-[24px] font-black text-lg tracking-tight transition-all",
                  (agreedToTerms && agreedToSizing) ? "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/30" : "bg-zinc-800 text-zinc-600 grayscale pointer-events-none"
                )}
                style={dmSans}
              >
                PROCEED TO PAYMENT
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Distance Warning Popup */}
      <Drawer.Root open={showDistanceWarningPopup} onOpenChange={setShowDistanceWarningPopup}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto border-t border-white/10 shadow-2xl pb-safe">
            <div className="p-8">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 rounded-3xl bg-[#f2546d]/10 flex items-center justify-center mb-6">
                  <Clock className="w-8 h-8 text-[#f2546d]" />
                </div>
                <h2 className="text-2xl font-black text-white leading-tight tracking-tighter" style={dmSans}>Long Distance Delivery</h2>
                <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 w-full">
                  <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                    Your delivery address is outside our standard free-delivery zone.
                  </p>
                  <p className="text-[#f2546d] text-[13px] font-bold mt-2">
                    A surcharge of ₹10 per km applies for distances beyond 6 km.
                  </p>
                </div>
              </div>

              {/* FIX 5: Reuse distanceSurcharge memo instead of duplicating calculation */}
              <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Base Delivery</span>
                  <span className="text-white font-bold">₹ 40</span>
                </div>
                <div className="flex justify-between items-center text-[#f2546d]">
                  <span className="text-sm font-bold uppercase tracking-wider">Distance Surcharge</span>
                  <span className="font-bold">+ ₹ {distanceSurcharge}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className="text-white font-black text-base uppercase tracking-wider">Total Delivery</span>
                  <span className="text-white font-black text-xl">{deliveryFeeBase === null ? <span className="animate-pulse">...</span> : <>₹ {deliveryFeeBase + distanceSurcharge}</>}</span>
                </div>
              </div>

              <button
                onClick={() => setShowDistanceWarningPopup(false)}
                className="w-full h-14 flex items-center justify-center rounded-[20px] bg-[#f2546d] text-white font-black text-lg shadow-xl shadow-[#f2546d]/20 active:scale-95 transition-all"
                style={dmSans}
              >
                GOT IT
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
