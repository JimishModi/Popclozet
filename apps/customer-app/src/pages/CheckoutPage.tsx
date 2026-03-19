// src/pages/CheckoutPage.tsx
// Checkout flow — creates order and notifies rider app via Supabase

import { useState, useMemo, useEffect } from "react";
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
  CreditCard
} from "lucide-react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { TimeSlotPicker } from "@/components/map/TimeSlotPicker";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/SupabaseAuthContext";
import { getLocalAddresses, ValidatedAddress as SavedAddress, searchLocations } from "@/services/addressService";
/*import { calculateDeliveryPricing, calculateETA } from "@/services/deliveryService";*/
import type { TimeSlot } from "@/services/deliveryService";
import { createEntitledOrder, getSubscriptionBenefits, type SubscriptionBenefits } from "@/services/subscriptionService";
import { supabase } from "@popclozet/api-client";
import { clearCartDB } from "@/lib/db";
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

/* ---------------------------------- */
/* Constants                          */
/* ---------------------------------- */
const WAREHOUSE_LOCATION = {
  name: "Hostel 5, IIT Bombay",
  lat: 19.1306,
  lng: 72.9155
};
const MAX_DELIVERY_DISTANCE_KM = 6;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// FIX 3: Use env variable instead of hardcoded localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  // FIX 7: Use useSearchParams instead of window.location.search
  const [searchParams] = useSearchParams();
  const buyoutOrderId = searchParams.get("buyoutOrderId");

  const { cartItems, removeFromCart } = useCart();
  const { user, profile } = useAuth();
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [addressList, setAddressList] = useState<SavedAddress[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToSizing, setAgreedToSizing] = useState(false);
  const [userIp, setUserIp] = useState<string>("");

  // FIX 2: Declare missing showTermsModal state
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Payment method: 'upi' (online) or 'cod'
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod' | null>(null);
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const { initiatePayment, isProcessing: isRazorpayProcessing } = useRazorpayCheckout();

  const [buyoutOrderData, setBuyoutOrderData] = useState<any>(null);
  const [buyoutLoading, setBuyoutLoading] = useState(false);

  // Fetch IP address for legal logging
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => setUserIp(data.ip))
      .catch(err => console.error("Failed to fetch IP:", err));
  }, []);

  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress | null>(null);
  const [selectedHub, setSelectedHub] = useState<any>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popInsurance, setPopInsurance] = useState(true);
  const [actualDistance, setActualDistance] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [showDistanceWarningPopup, setShowDistanceWarningPopup] = useState(false);
  const [hasFreeDeliveryBenefit, setHasFreeDeliveryBenefit] = useState(false);
  const [hasInsuranceBenefit, setHasInsuranceBenefit] = useState(false);

  const [cartProducts, setCartProducts] = useState<Record<string, any>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);

  const cartEntries: [string, number][] = Object.entries(cartItems) as [string, number][];

  const validCartEntries = useMemo(() => {
    return cartEntries.filter(([id]) => {
      const baseId = id.split('_')[0];
      return cartProducts[baseId] !== undefined;
    });
  }, [cartEntries, cartProducts]);

  const [subBenefits, setSubBenefits] = useState<SubscriptionBenefits | null>(null);
  const [selectedOrderType, setSelectedOrderType] = useState<'rental' | 'home_try_on'>('rental');
  const [selectedScheduledSlot, setSelectedScheduledSlot] = useState<TimeSlot | null>(null);

  // Load subscription benefit and handle passed address
  useEffect(() => {
    const passedAddress = location.state?.selectedAddress;
    if (passedAddress) {
      setDeliveryAddress(passedAddress);
    } else {
      const addresses = getLocalAddresses();
      // FIX 4: Populate addressList so the drawer isn't empty
      setAddressList(addresses);
      if (addresses.length > 0) {
        setDeliveryAddress(addresses[0]);
      }
    }

    const hub = getSavedHub();
    if (hub) setSelectedHub(hub);

    const checkSub = async () => {
      const benefits = await getSubscriptionBenefits();
      if (benefits) {
        setSubBenefits(benefits);
        setHasFreeDeliveryBenefit(benefits.freeDelivery);
        setHasInsuranceBenefit(benefits.insuranceIncluded);
        if (benefits.insuranceIncluded) setPopInsurance(true);
      } else {
        setSubBenefits(null);
        setHasFreeDeliveryBenefit(false);
        setHasInsuranceBenefit(false);
      }
    };
    checkSub();
  }, []);

  useEffect(() => {
    if (!subBenefits?.hasFreeHomeTryOn && selectedOrderType === 'home_try_on') {
      setSelectedOrderType('rental');
    }

    if (!subBenefits?.hasAdvanceBooking && selectedOrderType === 'rental' && selectedScheduledSlot) {
      setSelectedScheduledSlot(null);
    }
  }, [selectedOrderType, selectedScheduledSlot, subBenefits]);


  // Distance Check Effect (Strictly MapmyIndia API)
  useEffect(() => {
    const fetchDistance = async (destination: string) => {
      setDistanceLoading(true);
      setDistanceError(null);

      try {
        const origin = `${WAREHOUSE_LOCATION.lng},${WAREHOUSE_LOCATION.lat}`;
        console.log(`[Checkout] Calling MapmyIndia Distance API: ${origin} to ${destination}`);

        // FIX 3: Use env-based API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/api/location/distance?origin=${origin}&destination=${destination}`);

        if (response.ok) {
          const data = await response.json();
          const distance = data.distance;

          console.log("[DistanceCheck] API verified distance:", distance);
          setActualDistance(distance);

          if (distance > MAX_DELIVERY_DISTANCE_KM) {
            setShowDistanceWarningPopup(true);
            toast.info(`Delivery address is ${distance.toFixed(1)} km from our warehouse. ₹10/km additional charges apply beyond 6km.`, {
              duration: 8000,
              position: "top-center"
            });
          }
        } else {
          throw new Error("MapmyIndia API service error");
        }
      } catch (error) {
        console.warn("[Checkout] Strict Distance API failed:", error);
        setDistanceError("Distance service temporarily unavailable");
        setActualDistance(null);
      } finally {
        setDistanceLoading(false);
      }
    };

    if (deliveryAddress) {
      console.log("[Checkout] Starting distance check for:", deliveryAddress.formattedAddress);

      const lat = typeof deliveryAddress.lat === 'number' ? deliveryAddress.lat : parseFloat(deliveryAddress.lat as any);
      const lng = typeof deliveryAddress.lng === 'number' ? deliveryAddress.lng : parseFloat(deliveryAddress.lng as any);
      const hasCoords = !isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.01;

      console.log("[Checkout] Address Data:", { eLoc: deliveryAddress.eLoc, lat, lng, hasCoords });

      if (deliveryAddress.eLoc) {
        fetchDistance(deliveryAddress.eLoc);
      } else if (hasCoords) {
        fetchDistance(`${lng},${lat}`);
      } else if (deliveryAddress.formattedAddress) {
        console.warn("[Checkout] No eLoc/coords — resolving via searchLocations");
        setIsResolvingAddress(true);
        setDistanceError(null);
        searchLocations(deliveryAddress.formattedAddress)
          .then((results) => {
            const first = results?.[0];
            if (first?.eLoc) {
              fetchDistance(first.eLoc);
            } else if (first?.lat && first?.lng) {
              fetchDistance(`${first.lng},${first.lat}`);
            } else {
              setDistanceError("Could not resolve address coordinates");
              setActualDistance(null);
            }
          })
          .catch(() => {
            setDistanceError("Could not resolve address coordinates");
            setActualDistance(null);
          })
          .finally(() => setIsResolvingAddress(false));
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
          productMap[p.id] = {
            ...p,
            price: parseFloat(p.rental_price ?? p.price ?? '0'),
            originalPrice: parseFloat(p.price ?? '0'),
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
  }, [JSON.stringify(cartEntries.map(([id]) => id.split('_')[0]))]);

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
    return validCartEntries.reduce((sum, [, qty]) => sum + qty, 0);
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

  const subscriptionError = (() => {
    if (buyoutOrderId) return null;
    if (invalidCatalogItem) {
      return "One or more items in this checkout are not linked to a live catalog product. Remove them before placing the order.";
    }
    if (selectedOrderType === 'home_try_on' && !subBenefits?.hasFreeHomeTryOn) {
      return "Home try-on is available only on plans that include that feature.";
    }
    if (requiresScheduledSlot && !selectedScheduledSlot) {
      return "Select a time slot for the home try-on booking.";
    }
    if (!subBenefits) return null;
    if (exceedsMonthlyLimit) {
      return `Your ${subBenefits.planName} plan has ${subBenefits.remainingMonthly} monthly rental slot(s) left this cycle. Please remove ${totalQty - subBenefits.remainingMonthly} item(s).`;
    }
    if (exceedsConcurrentLimit) {
      return `Your ${subBenefits.planName} plan has ${subBenefits.remainingConcurrent} concurrent item slot(s) left right now. Please remove ${totalQty - subBenefits.remainingConcurrent} item(s).`;
    }
    if (hasExpensiveItem) return `Your ${subBenefits.planName} plan covers items up to ₹${subBenefits.maxItemValue} retail value. An item in your order exceeds this limit.`;
    return null;
  })();

  // Calculate totals
  const subtotal = useMemo(() => {
    if (buyoutOrderData) {
      // For buyout, the "subtotal" is the remaining balance (e.g. 70% of total or fixed)
      return Math.round(buyoutOrderData.total_amount * 0.7);
    }
    if (subBenefits && !subscriptionError) {
      return 0; // Rentals covered by subscription
    }
    return validCartEntries.reduce((total, [id, qty]) => {
      const baseId = id.split('_')[0];
      const product = cartProducts[baseId];
      return total + (product?.price || 0) * qty;
    }, 0);
  }, [validCartEntries, cartProducts, buyoutOrderData, subBenefits, subscriptionError]);

  const originalTotal = useMemo(() => {
    if (buyoutOrderData) return buyoutOrderData?.total_amount ?? 0;
    return validCartEntries.reduce((total, [id, qty]) => {
      const baseId = id.split('_')[0];
      const product = cartProducts[baseId];
      const orig = product?.originalPrice || product?.price || 0;
      return total + orig * qty;
    }, 0);
  }, [validCartEntries, cartProducts, buyoutOrderData]);

  const discount = originalTotal - subtotal;

  const deliveryFeeBase = 40;

  // FIX 5: Single source of truth for distance surcharge — used everywhere including warning popup
  const distanceSurcharge = useMemo(() => {
    if (!actualDistance || actualDistance <= MAX_DELIVERY_DISTANCE_KM) return 0;
    return Math.round(actualDistance - MAX_DELIVERY_DISTANCE_KM) * 10;
  }, [actualDistance]);

  const deliveryFee = selectedOrderType === 'home_try_on'
    ? 0
    : hasFreeDeliveryBenefit
      ? 0
      : (deliveryFeeBase + distanceSurcharge);
  const isDeliveryFeeWaived = selectedOrderType === 'home_try_on' || hasFreeDeliveryBenefit;
  const insuranceFee = hasInsuranceBenefit ? 0 : (popInsurance ? 200 : 0);
  const total = subtotal + deliveryFee + insuranceFee;

  /* ---------------------------------- */
  /* Payment Processing                  */
  /* ---------------------------------- */
  const [showEmailGate, setShowEmailGate] = useState(false);

  /* ---------------------------------- */
  /* Place Order (Razorpay + COD)        */
  /* ---------------------------------- */
  const handlePlaceOrder = async () => {
    // Only gate on email if they actually have a real email set
    const realEmail = isRealEmail(profile?.email) ? profile!.email : null;
    if (realEmail && !profile?.email_verified) {
      setShowEmailGate(true);
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

    console.log('[Checkout] Starting order placement...', { paymentMethod });
    setError(null);
    setIsPlacingOrder(true);

    try {
      if (!supabase) throw new Error("Service unavailable");

      const userId = user?.id;
      if (!userId) throw new Error("Please sign in to place an order");

      // --- Buyout Flow (keep-it) ---
      if (buyoutOrderId) {
        const targetId = buyoutOrderId;
        await supabase.from('orders').update({ status: 'pending_payment' }).eq('id', buyoutOrderId);

        if (paymentMethod === 'cod') {
          await supabase.from('orders').update({ status: 'confirmed' }).eq('id', buyoutOrderId);
          // FIX 6: Clear cart on buyout COD path too
          await clearCartDB().catch(() => { });
          for (const [id] of validCartEntries) removeFromCart(id);
          navigate(`/order-confirmed/${targetId}`);
        } else {
          setIsPlacingOrder(false);
          initiatePayment({
            internalOrderId: targetId,
            amountInRupees: total,
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
        .limit(1)
        .maybeSingle();

      if (existingAddr) {
        addressId = existingAddr.id;
      } else {
        const { data: newAddr, error: addrErr } = await supabase
          .from("addresses")
          .insert({
            user_id: userId,
            label: "Delivery",
            full_address: addrFull,
            latitude: addrLat,
            longitude: addrLng,
            geohash: `${addrLat.toFixed(2)}_${addrLng.toFixed(2)}`,
            is_default: true,
          })
          .select("id")
          .single();

        if (addrErr || !newAddr) throw new Error("Could not save delivery address");
        addressId = newAddr.id;
      }

      // 2) Create the entitled order via RPC
      const rentalDays = 4;
      const deliveryEta = new Date(Date.now() + 60 * 60000).toISOString();

      const rpcItems = validCartEntries.map(([id, qty]) => {
        const rawBaseId = id.includes('_') ? id.split('_')[0] : id;
        const size = id.includes('_') ? id.split('_')[1] : 'S';

        if (!UUID_PATTERN.test(rawBaseId)) {
          throw new Error("One or more cart items are not linked to a live product in the database.");
        }

        return {
          product_id: rawBaseId,
          size,
          quantity: qty,
        };
      });

      const orderResult = await createEntitledOrder({
        deliveryAddressId: addressId,
        items: rpcItems,
        paymentMethod: paymentMethod === 'upi' ? 'upi' : 'cod',
        orderType: selectedOrderType,
        scheduledSlot: selectedScheduledSlot,
        deliveryDistanceKm: actualDistance,
        popInsurance,
        rentalDurationDays: rentalDays,
        deliveryEta,
      });

      // 3) Insert Legal Acceptance Log
      const { error: legalErr } = await supabase.from("legal_acceptances").insert({
        user_id: userId,
        order_id: orderResult.orderId,
        ip_address: userIp || 'unknown',
        tc_version: 'v1.0'
      });
      if (legalErr) {
        console.warn("[Checkout] Legal acceptance logging failed, but order placed. Details:", legalErr);
      }

      // 4) Clear cart (if not buyout)
      if (!buyoutOrderId) {
        await clearCartDB().catch(() => { });
        for (const [id] of validCartEntries) {
          removeFromCart(id);
        }
      }

      // 5) Navigate based on payment method
      const targetId = orderResult.orderId;
      const finalAmount = orderResult.totalAmount;
      if (paymentMethod === 'cod') {
        navigate(`/order-confirmed/${targetId}`);
      } else {
        navigate(`/payment-processing?type=order&orderId=${targetId}&amount=${finalAmount}&method=upi`);
      }
    } catch (err: any) {
      console.error("[Checkout] Failed to place order:", err);
      toast.error(err.message || "Failed to place order. Please try again.");
      setError(err.message || "Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <MobileShell className="bg-[#111111] text-white">
      <main className="flex-1 overflow-y-auto pb-64">
        {buyoutLoading && (
          <div className="flex flex-col items-center justify-center pt-20">
            <div className="w-8 h-8 border-2 border-[#f2546d]/30 border-t-[#f2546d] rounded-full animate-spin" />
            <p className="text-sm text-zinc-500 mt-4">Loading order details...</p>
          </div>
        )}

        {/* Header */}
        <section className="relative px-5 pt-6 pb-2">
          <div className="absolute -top-20 -left-14 w-36 h-36 rounded-full blur-[100px] pointer-events-none" style={{ background: "linear-gradient(180deg, #f2546d 0%, #ff6078 46%, #611624 88%)" }} />
          <button onClick={() => navigate(-1)} className="relative flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </section>

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
          <h2 className="text-lg font-black text-white" style={dmSans}>My Information</h2>
          <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>{profile?.full_name || user?.user_metadata?.full_name || "Guest"}</p>

          <h3 className="text-lg font-black text-white mt-9" style={dmSans}>Contact Details</h3>
          <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>{profile?.phone || user?.phone || "No phone"}</p>
          <p className="text-sm text-[#b4b4b4] mt-1" style={dmSans}>{profile?.email || user?.email}</p>

          <div className="flex items-center justify-between mt-9">
            <h3 className="text-lg font-black text-white" style={dmSans}>Address</h3>
            <button onClick={() => setShowAddressSelector(true)} className="text-xs font-bold text-[#f2546d] uppercase">Change</button>
          </div>
          {deliveryAddress ? (
            <div className="mt-4 p-4 rounded-2xl bg-[#232323] border border-white/5 relative overflow-hidden">
              <p className="text-sm text-[#b4b4b4] leading-relaxed relative z-10" style={dmSans}>{deliveryAddress.formattedAddress}</p>
              <div className="mt-3 flex items-center gap-2 relative z-10">
                {isResolvingAddress ? (
                  <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-zinc-800 animate-pulse">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Resolving address...</span>
                  </div>
                ) : distanceLoading ? (
                  <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-zinc-800 animate-pulse">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Checking distance...</span>
                  </div>
                ) : actualDistance !== null ? (
                  <div className="px-2 py-0.5 rounded-lg bg-[#f2546d]/10 border border-[#f2546d]/20">
                    <span className="text-[10px] font-black text-[#f2546d] uppercase tracking-wider">
                      {actualDistance.toFixed(1)} km from warehouse
                    </span>
                  </div>
                ) : distanceError ? (
                  <div className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">{distanceError}</span>
                  </div>
                ) : !deliveryAddress.lat || !deliveryAddress.lng ? (
                  <div className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Coordinate search failed</span>
                  </div>
                ) : null}
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#f2546d]/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />
            </div>
          ) : (
            <button onClick={() => navigate("/map?returnTo=/checkout")} className="w-full mt-4 p-4 rounded-2xl bg-[#232323] border border-dashed border-white/10 text-zinc-500 text-sm">
              + Select Address
            </button>
          )}

          {!buyoutOrderId && subBenefits && (
            <>
              <h3 className="text-lg font-black text-white mt-9" style={dmSans}>Plan Access</h3>
              <div className="mt-4 p-4 rounded-2xl bg-[#232323] border border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight" style={dmSans}>{subBenefits.planName} plan</p>
                    <p className="text-[11px] text-zinc-500 mt-1 font-bold uppercase tracking-widest">
                      Monthly quota and concurrent active-item limit
                    </p>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-[#f2546d]/10 border border-[#f2546d]/20">
                    <span className="text-[10px] font-black text-[#f2546d] uppercase tracking-wider">
                      ₹{subBenefits.maxItemValue} cap
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#171717] px-3 py-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Monthly left</p>
                    <p className="mt-1 text-lg font-black text-white">{subBenefits.remainingMonthly}/{subBenefits.monthlyItems}</p>
                  </div>
                  <div className="rounded-xl bg-[#171717] px-3 py-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Concurrent left</p>
                    <p className="mt-1 text-lg font-black text-white">{subBenefits.remainingConcurrent}/{subBenefits.concurrentItems}</p>
                  </div>
                </div>
              </div>

              {subBenefits.hasFreeHomeTryOn && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('rental')}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition-colors",
                      selectedOrderType === 'rental'
                        ? "border-[#f2546d] bg-[#f2546d]/10"
                        : "border-white/5 bg-[#232323]"
                    )}
                  >
                    <p className="text-sm font-black text-white uppercase tracking-tight" style={dmSans}>Rental</p>
                    <p className="mt-1 text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Standard subscription checkout</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('home_try_on')}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition-colors",
                      selectedOrderType === 'home_try_on'
                        ? "border-[#f2546d] bg-[#f2546d]/10"
                        : "border-white/5 bg-[#232323]"
                    )}
                  >
                    <p className="text-sm font-black text-white uppercase tracking-tight" style={dmSans}>Home Try-On</p>
                    <p className="mt-1 text-[11px] text-zinc-500 font-bold uppercase tracking-widest">Pro-only scheduled booking</p>
                  </button>
                </div>
              )}

              {(subBenefits.hasAdvanceBooking || selectedOrderType === 'home_try_on') && (
                <div className="mt-4 p-4 rounded-2xl bg-[#232323] border border-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight" style={dmSans}>
                        {selectedOrderType === 'home_try_on' ? 'Schedule Home Try-On' : 'Schedule Delivery Slot'}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
                        {selectedOrderType === 'home_try_on' ? 'Required for try-on bookings' : 'Optional if you want a fixed delivery window'}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      selectedOrderType === 'home_try_on' ? "text-[#f2546d]" : "text-zinc-500"
                    )}>
                      {selectedOrderType === 'home_try_on' ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <TimeSlotPicker
                    selectedSlot={selectedScheduledSlot}
                    onSelect={setSelectedScheduledSlot}
                    className="mt-4"
                  />
                  {selectedScheduledSlot && (
                    <p className="mt-3 text-[11px] text-[#f2546d] font-bold uppercase tracking-widest">
                      Selected: {selectedScheduledSlot.date} • {selectedScheduledSlot.start} - {selectedScheduledSlot.end}
                    </p>
                  )}
                </div>
              )}
            </>
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
                    <p className="text-xs text-zinc-500 mt-0.5">UPI, Card, Netbanking & more</p>
                  </div>
                </>
              ) : paymentMethod === 'cod' ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white" style={dmSans}>Cash on Delivery</p>
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
            <div className="flex justify-between text-lg text-[#b4b4b4]" style={dmSans}>
              <div className="flex flex-col">
                <span>{selectedOrderType === 'home_try_on' ? 'Home try-on delivery' : 'Delivery fee'}</span>
                {isResolvingAddress ? (
                  <span className="text-[11px] text-zinc-500 animate-pulse">Resolving address...</span>
                ) : distanceLoading ? (
                  <span className="text-[11px] text-zinc-500 animate-pulse">Checking distance...</span>
                ) : actualDistance !== null ? (
                  <span className="text-[11px] text-[#f2546d] font-bold">Distance: {actualDistance.toFixed(1)} km</span>
                ) : distanceError ? (
                  <span className="text-[10px] text-amber-500 italic">{distanceError}</span>
                ) : (!deliveryAddress?.lat || !deliveryAddress?.lng) ? (
                  <span className="text-[10px] text-amber-500 italic">Coordinate search failed</span>
                ) : null}
                {distanceSurcharge > 0 && (
                  <span className="text-[10px] text-zinc-500 font-medium">
                    (₹40 base + ₹{distanceSurcharge} long-distance)
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className={cn(isDeliveryFeeWaived && "line-through opacity-50")}>₹ {deliveryFeeBase + distanceSurcharge}</span>
                {isDeliveryFeeWaived && <span className="ml-2">₹ 0</span>}
              </div>
            </div>
            <div className="flex justify-between items-center text-lg text-[#b4b4b4]" style={dmSans}>
              <div className="flex items-center gap-2">
                <span>Pop Insurance</span>
                <button
                  onClick={() => setPopInsurance(!popInsurance)}
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    popInsurance ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700"
                  )}
                >
                  {popInsurance && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                </button>
              </div>
              <span>₹ {insuranceFee}</span>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between text-2xl font-bold text-white" style={dmSans}>
              <span>Total</span>
              <span>₹ {total}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40">
        <div className="bg-[#232323] rounded-t-[32px] px-5 py-6 pb-10 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
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
              <p className="text-2xl font-black text-white" style={dmSans}>₹ {total}</p>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Final Amount</p>
            </div>
            <button
              onClick={subscriptionError ? undefined : handlePlaceOrder}
              disabled={isPlacingOrder || (validCartEntries.length === 0 && !buyoutOrderId) || !!subscriptionError}
              className={cn(
                "h-14 px-12 rounded-2xl font-black text-lg transition-all active:scale-[0.98]",
                (isPlacingOrder || !!subscriptionError) ? "bg-zinc-800 text-zinc-600" : "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/20"
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
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto">
            <div className="p-6 overflow-y-auto">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <div className="flex justify-between items-center mb-6">
                <Drawer.Title className="text-xl font-black text-white" style={dmSans}>Select Address</Drawer.Title>
                <Drawer.Description className="sr-only">Choose a delivery address</Drawer.Description>
                <button onClick={() => navigate("/map?returnTo=/checkout")} className="text-sm font-bold text-[#f2546d]">+ Add New</button>
              </div>
              <div className="space-y-4">
                {addressList.map((addr) => (
                  <button key={addr.formattedAddress} onClick={() => { setDeliveryAddress(addr); setShowAddressSelector(false); }} className={cn("w-full p-4 rounded-2xl text-left border", deliveryAddress?.formattedAddress === addr.formattedAddress ? "bg-[#f2546d]/10 border-[#f2546d]" : "bg-[#141414] border-white/5")}>
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
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto">
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
                      <p className="text-zinc-500 text-xs mt-0.5 font-medium">UPI · Card · Netbanking · Wallets · EMI</p>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", paymentMethod === 'upi' ? "border-[#f2546d] bg-[#f2546d]" : "border-zinc-700")}>
                      {paymentMethod === 'upi' && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                  {paymentMethod === 'upi' && (
                    <p className="text-[11px] text-[#f2546d]/80 font-medium mt-3 ml-16">
                      ✓ Razorpay powers PhonePe, GPay, Paytm & all major banks
                    </p>
                  )}
                </button>

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
                      <p className="text-white font-bold text-base" style={dmSans}>Cash on Delivery</p>
                      <p className="text-zinc-500 text-xs mt-0.5 font-medium">Pay when you receive your order</p>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", paymentMethod === 'cod' ? "border-emerald-500 bg-emerald-500" : "border-zinc-700")}>
                      {paymentMethod === 'cod' && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                </button>
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
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[40px] fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] max-w-[430px] mx-auto border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <div className="p-8 overflow-y-auto scrollbar-hide">
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
                    <a href="/docs/Terms & condition_popclozet.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Terms & Conditions</a>,{' '}
                    <a href="/docs/Privacy policy.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Privacy Policy</a>, and{' '}
                    <a href="/docs/Cookies policy.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#f2546d] underline underline-offset-4 pointer-events-auto">Cookie Policy</a>.
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
          <Drawer.Content className="bg-[#191919] flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] max-w-[430px] mx-auto border-t border-white/10 shadow-2xl">
            <div className="p-8">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 rounded-3xl bg-[#f2546d]/10 flex items-center justify-center mb-6">
                  <Clock className="w-8 h-8 text-[#f2546d]" />
                </div>
                <h2 className="text-2xl font-black text-white leading-tight tracking-tighter" style={dmSans}>Long Distance Delivery</h2>
                <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 w-full">
                  <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                    Your delivery address is <span className="text-white font-bold">{actualDistance?.toFixed(1)} km</span> from our warehouse.
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
                  <span className="text-white font-black text-xl">₹ {deliveryFeeBase + distanceSurcharge}</span>
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
    </MobileShell>
  );
}
