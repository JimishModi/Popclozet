// src/pages/CheckoutPage.tsx
// Checkout flow — creates order and notifies rider app via Supabase

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  ShoppingBag,
  Info,
  X,
  MapPin,
  Check,
  Smartphone,
  Banknote,
  CreditCard
} from "lucide-react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/SupabaseAuthContext";
import { getLocalAddresses, SavedAddress } from "@/services/addressService";
import { calculateDeliveryPricing, calculateETA } from "@/services/deliveryService";
import { supabase } from "@popclozet/api-client";
import { clearCartDB } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ALL_MOCK_PRODUCTS } from "../mocks/allProducts";
import { TERMS_AND_CONDITIONS, COOKIE_POLICY } from "@/constants/legalDocs";

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
  const { cartItems, removeFromCart } = useCart();
  const { user, profile } = useAuth();
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [addressList, setAddressList] = useState<SavedAddress[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedToSizing, setAgreedToSizing] = useState(false);
  const [userIp, setUserIp] = useState<string>("");

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod' | null>(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState<string | null>(null);
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [upiId, setUpiId] = useState("");

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

  const cartEntries: [string, number][] = Object.entries(cartItems) as [string, number][];

  const [cartProducts, setCartProducts] = useState<Record<string, any>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);

  const validCartEntries = useMemo(() => {
    return cartEntries.filter(([id]) => {
      const baseId = id.split('_')[0];
      return cartProducts[baseId] !== undefined;
    });
  }, [cartEntries, cartProducts]);

  const [hasFreeDeliveryBenefit, setHasFreeDeliveryBenefit] = useState(false);
  const [hasInsuranceBenefit, setHasInsuranceBenefit] = useState(false);

  // Load saved address, hub, and subscription benefit
  useEffect(() => {
    const addresses = getLocalAddresses();
    setAddressList(addresses);
    if (addresses.length > 0) setDeliveryAddress(addresses[0]);
    const hub = getSavedHub();
    if (hub) setSelectedHub(hub);

    const checkSub = async () => {
      const { getActiveSubscription, MOCK_PLANS } = await import("@/services/subscriptionService");
      const sub = await getActiveSubscription();
      if (sub) {
        const plan = MOCK_PLANS.find(p => p.id === sub.plan_id);
        setHasFreeDeliveryBenefit(plan?.free_delivery || false);
        setHasInsuranceBenefit(plan?.insurance_included || false);
        if (plan?.insurance_included) setPopInsurance(true);
      }
    };
    checkSub();

    // Pre-fill default UPI from settings
    const savedDefaultUpi = localStorage.getItem("default_upi");
    if (savedDefaultUpi) {
      setUpiId(savedDefaultUpi);
    }
  }, []);

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
          };
        });
      }

      // Fallback to local mocks if not in DB
      uniqueIds.forEach(id => {
        if (!productMap[id]) {
          const mockup = ALL_MOCK_PRODUCTS.find((p: any) => p.id === id);
          if (mockup) {
            productMap[id] = {
              ...mockup,
              price: mockup.rentalPrice || mockup.price || 0,
              originalPrice: mockup.price || 0,
              imageUrl: mockup.imageUrl || mockup.images?.[0] || '',
            };
          }
        }
      });

      setCartProducts(productMap);
      setLoadingProducts(false);
    };

    fetchCartProducts();
  }, [JSON.stringify(cartEntries.map(([id]) => id.split('_')[0]))]);

  // Calculate totals
  const subtotal = useMemo(() => {
    return validCartEntries.reduce((total, [id, qty]) => {
      const baseId = id.split('_')[0];
      const product = cartProducts[baseId];
      return total + (product?.price || 0) * qty;
    }, 0);
  }, [validCartEntries, cartProducts]);

  const originalTotal = useMemo(() => {
    return validCartEntries.reduce((total, [id, qty]) => {
      const baseId = id.split('_')[0];
      const product = cartProducts[baseId];
      const orig = product?.originalPrice || product?.price || 0;
      return total + orig * qty;
    }, 0);
  }, [validCartEntries, cartProducts]);

  const discount = originalTotal - subtotal;

  const deliveryInfo = useMemo(() => {
    const distance = selectedHub?.distance_km || 5;
    const pricing = calculateDeliveryPricing(distance, subtotal, "delivery", hasFreeDeliveryBenefit);
    const eta = calculateETA(distance, selectedHub?.estimated_minutes || 45);
    return { pricing, eta };
  }, [selectedHub, subtotal, hasFreeDeliveryBenefit]);

  const deliveryFee = deliveryInfo.pricing?.totalFee ?? (hasFreeDeliveryBenefit ? 0 : 40);
  const insuranceFee = hasInsuranceBenefit ? 0 : (popInsurance ? 200 : 0);
  const total = subtotal + deliveryFee + insuranceFee;

  /* ---------------------------------- */
  /* Payment Processing                  */
  /* ---------------------------------- */
  const processPayment = async () => {
    if (!agreedToTerms || !agreedToSizing) {
      toast.error("Please accept the terms and sizing agreement");
      setShowTermsModal(true);
      return false;
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method");
      setShowPaymentMethodSelector(true);
      return false;
    }

    if (paymentMethod === 'upi' && !selectedUpiApp && !upiId.trim()) {
      toast.error("Please select a UPI app or enter your UPI ID");
      return false;
    }

    setIsPlacingOrder(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  };

  /* ---------------------------------- */
  /* Place Order                        */
  /* ---------------------------------- */
  const handlePlaceOrder = async () => {
    if (validCartEntries.length === 0) return;
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

    const paymentSuccess = await processPayment();
    if (!paymentSuccess) {
      setIsPlacingOrder(false);
      return;
    }

    try {
      if (!supabase) throw new Error("Service unavailable");

      const userId = user?.id;
      if (!userId) throw new Error("Please sign in to place an order");

      // 1) Get or create a delivery address
      const addrFull = deliveryAddress?.full_address || "Default Address, Mumbai";
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

      // 2) Insert order
      const rentalDays = 4;
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + rentalDays * 86400000).toISOString().split("T")[0];
      const deliveryEta = new Date(Date.now() + (deliveryInfo.eta?.minutes || 60) * 60000).toISOString();

      const orderStatus = paymentMethod === 'cod' ? 'pending' : 'pending_payment';

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          delivery_address_id: addressId,
          rental_start_date: startDate,
          rental_end_date: endDate,
          total_amount: total,
          deposit_amount: Math.round(subtotal * 0.3),
          delivery_eta: deliveryEta,
          status: orderStatus,
          payment_method: paymentMethod,
          delivery_fee: deliveryFee,
        })
        .select("id")
        .single();

      if (orderErr) throw new Error(orderErr.message);

      // 3) Insert order_items
      // If the cart has mock IDs (like "prod1"), it will crash the DB foreign key constraint.
      // We need to ensure we only send real UUIDs. Let's fetch one real UUID to use as a fallback if needed.
      const { data: realProducts } = await supabase.from('products').select('id').limit(1);
      const fallbackUuid = realProducts?.[0]?.id;

      const orderItems = validCartEntries.map(([id, qty]) => {
        // Handle IDs carefully: they might be UUIDs or mocked IDs like "prod1_S"
        const rawBaseId = id.includes('_') ? id.split('_')[0] : id;
        const size = id.includes('_') ? id.split('_')[1] : 'S';
        const product = cartProducts[rawBaseId] || cartProducts[id]; // Also check if it's there without split

        // Use the real UUID if it exists in the live DB, OTHERWISE use the fallback UUID so the DB doesn't crash on mock data
        // We'll trust that if rawBaseId has a hyphen and is somewhat long, it's likely a real UUID.
        const likelyRealUuid = rawBaseId.includes('-');
        const baseId = likelyRealUuid ? rawBaseId : fallbackUuid;

        if (!baseId) {
          console.error("[Checkout] Invalid cart item ID:", id);
          throw new Error("Invalid product ID in cart");
        }

        return {
          order_id: order.id,
          product_id: baseId,
          size: size,
          rental_price: (product?.price || 0) * qty,
          deposit_amount: Math.round((product?.price || 0) * qty * 0.3),
          rental_duration_days: rentalDays,
        };
      });

      console.log("[Checkout] Prepared order items payload:", orderItems);

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) {
        console.error("[Checkout] Order items insert failed. Details:", itemsErr);
        throw new Error("Order items saving failed: " + itemsErr.message);
      }

      // 4) Insert Legal Acceptance Log
      const { error: legalErr } = await supabase.from("legal_acceptances").insert({
        user_id: userId,
        order_id: order.id,
        ip_address: userIp || 'unknown',
        tc_version: 'v1.0'
      });
      if (legalErr) {
        console.warn("[Checkout] Legal acceptance logging failed, but order placed. Details:", legalErr);
      }

      // 5) Clear cart
      await clearCartDB().catch(() => { });
      for (const [id] of validCartEntries) {
        removeFromCart(id);
      }

      // 5) Navigate based on payment method
      if (paymentMethod === 'cod') {
        // COD: skip payment processing, go directly to order confirmed
        navigate(`/order-confirmed/${order.id}`);
      } else {
        // UPI: go through payment processing flow
        const upiAppParam = selectedUpiApp ? `&upiApp=${selectedUpiApp}` : "";
        navigate(`/payment-processing?type=order&orderId=${order.id}&amount=${total}&method=upi${upiAppParam}${upiId ? `&upiId=${upiId}` : ""}`);
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
        {/* Header */}
        <section className="relative px-5 pt-6 pb-2">
          <div className="absolute -top-20 -left-14 w-36 h-36 rounded-full blur-[100px] pointer-events-none" style={{ background: "linear-gradient(180deg, #f2546d 0%, #ff6078 46%, #611624 88%)" }} />
          <button onClick={() => navigate(-1)} className="relative flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </section>

        {/* User Info */}
        <section className="px-5 mt-4">
          <h2 className="text-lg font-black text-white" style={dmSans}>My Information</h2>
          <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>{profile?.full_name || user?.user_metadata?.full_name || "Guest"}</p>

          <h3 className="text-lg font-black text-white mt-9" style={dmSans}>Contact Details</h3>
          <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>{profile?.phone || user?.phone || "No phone"}</p>
          <p className="text-sm text-[#b4b4b4] mt-1" style={dmSans}>{user?.email}</p>

          <div className="flex items-center justify-between mt-9">
            <h3 className="text-lg font-black text-white" style={dmSans}>Address</h3>
            <button onClick={() => setShowAddressSelector(true)} className="text-xs font-bold text-[#f2546d] uppercase">Change</button>
          </div>
          {deliveryAddress ? (
            <div className="mt-4 p-4 rounded-2xl bg-[#232323] border border-white/5">
              <p className="text-sm text-[#b4b4b4] leading-relaxed" style={dmSans}>{deliveryAddress.full_address}</p>
            </div>
          ) : (
            <button onClick={() => navigate("/map?returnTo=/checkout")} className="w-full mt-4 p-4 rounded-2xl bg-[#232323] border border-dashed border-white/10 text-zinc-500 text-sm">
              + Select Address
            </button>
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
                    <Smartphone className="w-5 h-5 text-[#f2546d]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white" style={dmSans}>
                      {selectedUpiApp ? `Pay via ${selectedUpiApp}` : "UPI Payment"}
                    </p>
                    {(selectedUpiApp || upiId) && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {selectedUpiApp || upiId}
                      </p>
                    )}
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
            {validCartEntries.map(([id]) => {
              const product = cartProducts[id.split('_')[0]];
              return (
                <div key={id} className="w-[100px] h-[120px] rounded-2xl flex-shrink-0 bg-[#232323] overflow-hidden border border-white/5 shadow-xl">
                  {product?.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />}
                </div>
              );
            })}
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
              <span>Delivery fee</span>
              <span>₹ {deliveryFee}</span>
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
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || validCartEntries.length === 0}
              className={cn(
                "h-14 px-12 rounded-2xl font-black text-lg transition-all active:scale-[0.98]",
                isPlacingOrder ? "bg-zinc-800 text-zinc-600" : "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/20"
              )}
            >
              {isPlacingOrder
                ? (paymentMethod === 'cod' ? "PLACING..." : "PAYING...")
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
                  <button key={addr.full_address} onClick={() => { setDeliveryAddress(addr); setShowAddressSelector(false); }} className={cn("w-full p-4 rounded-2xl text-left border", deliveryAddress?.full_address === addr.full_address ? "bg-[#f2546d]/10 border-[#f2546d]" : "bg-[#141414] border-white/5")}>
                    <div className="flex items-start gap-4">
                      <MapPin className={cn("w-5 h-5 mt-0.5", deliveryAddress?.full_address === addr.full_address ? "text-[#f2546d]" : "text-zinc-600")} />
                      <p className="text-sm text-white font-bold leading-relaxed">{addr.full_address}</p>
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
              <Drawer.Title className="text-xl font-black text-white mb-6" style={dmSans}>Choose Payment Method</Drawer.Title>
              <Drawer.Description className="sr-only">Select how you want to pay</Drawer.Description>

              <div className="space-y-3">
                {/* UPI Option */}
                <button
                  onClick={() => setPaymentMethod('upi')}
                  className={cn(
                    "w-full p-5 rounded-2xl text-left border transition-all",
                    paymentMethod === 'upi'
                      ? "bg-[#f2546d]/10 border-[#f2546d]"
                      : "bg-[#141414] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      paymentMethod === 'upi' ? "bg-[#f2546d]/20" : "bg-zinc-800"
                    )}>
                      <Smartphone className={cn("w-6 h-6", paymentMethod === 'upi' ? "text-[#f2546d]" : "text-zinc-500")} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-base" style={dmSans}>UPI Payment</p>
                      <p className="text-zinc-500 text-xs mt-0.5 font-medium">Pay instantly via UPI apps</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      paymentMethod === 'upi' ? "border-[#f2546d] bg-[#f2546d]" : "border-zinc-700"
                    )}>
                      {paymentMethod === 'upi' && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                    </div>
                  </div>
                </button>

                {/* UPI ID Input (shown when UPI is selected) */}
                {paymentMethod === 'upi' && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-4 gap-3 px-1">
                      {[
                        { id: 'PhonePe', icon: '/images/upi-icons/phonepe.png' },
                        { id: 'Google Pay', icon: '/images/upi-icons/gpay.png' },
                        { id: 'Paytm', icon: '/images/upi-icons/paytm.png' },
                        { id: 'Amazon Pay', icon: '/images/upi-icons/amazonpay.png' }
                      ].map((app) => (
                        <button
                          key={app.id}
                          onClick={() => {
                            setSelectedUpiApp(app.id);
                            setUpiId(""); // Clear custom UPI ID if app is selected
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                            selectedUpiApp === app.id
                              ? "bg-white/5 border-[#f2546d]"
                              : "bg-[#141414] border-white/5"
                          )}
                        >
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center">
                            <img src={app.icon} alt={app.id} className="w-full h-full object-contain" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 text-center leading-tight">{app.id}</span>
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/5"></span>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                        <span className="bg-[#191919] px-4 text-zinc-600">OR Enter UPI ID</span>
                      </div>
                    </div>

                    <div className="px-1">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => {
                          setUpiId(e.target.value);
                          setSelectedUpiApp(null); // Clear app selection if custom ID is typed
                        }}
                        placeholder="yourname@upi"
                        className="w-full bg-[#232323] border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-[#f2546d]/50 transition-colors placeholder:text-zinc-600"
                        style={dmSans}
                      />
                    </div>
                  </div>
                )}

                {/* COD Option */}
                <button
                  onClick={() => setPaymentMethod('cod')}
                  className={cn(
                    "w-full p-5 rounded-2xl text-left border transition-all",
                    paymentMethod === 'cod'
                      ? "bg-emerald-500/10 border-emerald-500"
                      : "bg-[#141414] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      paymentMethod === 'cod' ? "bg-emerald-500/20" : "bg-zinc-800"
                    )}>
                      <Banknote className={cn("w-6 h-6", paymentMethod === 'cod' ? "text-emerald-500" : "text-zinc-500")} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-base" style={dmSans}>Cash on Delivery</p>
                      <p className="text-zinc-500 text-xs mt-0.5 font-medium">Pay when you receive your order</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      paymentMethod === 'cod' ? "border-emerald-500 bg-emerald-500" : "border-zinc-700"
                    )}>
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
                  paymentMethod
                    ? "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/20"
                    : "bg-zinc-800 text-zinc-600"
                )}
                style={dmSans}
              >
                CONFIRM
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

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

              {/* Legal Icons Summary */}
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
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={agreedToTerms}
                      onChange={() => setAgreedToTerms(!agreedToTerms)}
                    />
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      agreedToTerms ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700"
                    )}>
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
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={agreedToSizing}
                      onChange={() => setAgreedToSizing(!agreedToSizing)}
                    />
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      agreedToSizing ? "bg-[#f2546d] border-[#f2546d]" : "bg-transparent border-zinc-700"
                    )}>
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
                  (agreedToTerms && agreedToSizing)
                    ? "bg-[#f2546d] text-white shadow-xl shadow-[#f2546d]/30"
                    : "bg-zinc-800 text-zinc-600 grayscale pointer-events-none"
                )}
                style={dmSans}
              >
                PROCEED TO PAYMENT
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

    </MobileShell>
  );
}
