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
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/SupabaseAuthContext";
import { getLocalAddresses, SavedAddress } from "@/services/addressService";
import { calculateDeliveryPricing, calculateETA } from "@/services/deliveryService";
import { supabase } from "@popclozet/api-client";
import { clearCartDB } from "@/lib/db";

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
  const { user } = useAuth();

  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress | null>(null);
  const [selectedHub, setSelectedHub] = useState<any>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
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

  const totalItems = validCartEntries.reduce((sum, [, qty]) => sum + qty, 0);

  // Load saved address and hub
  useEffect(() => {
    const addresses = getLocalAddresses();
    if (addresses.length > 0) setDeliveryAddress(addresses[0]);
    const hub = getSavedHub();
    if (hub) setSelectedHub(hub);
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
      if (data && !error) {
        const productMap: Record<string, any> = {};
        data.forEach((p: any) => {
          productMap[p.id] = {
            ...p,
            price: parseFloat(p.rental_price ?? p.price ?? '0'),
            originalPrice: parseFloat(p.price ?? '0'),
            imageUrl: p.images?.[0] || '',
          };
        });
        setCartProducts(productMap);
      }
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
    const pricing = calculateDeliveryPricing(distance, subtotal, "delivery");
    const eta = calculateETA(distance, selectedHub?.estimated_minutes || 45);
    return { pricing, eta };
  }, [selectedHub, subtotal]);

  const deliveryFee = deliveryInfo.pricing?.totalFee || 50;
  const insuranceFee = popInsurance ? 200 : 0;
  const total = subtotal + deliveryFee + insuranceFee;

  /* ---------------------------------- */
  /* Place Order                        */
  /* ---------------------------------- */
  const handlePlaceOrder = async () => {
    if (cartEntries.length === 0) return;

    console.log('[Checkout] Starting order placement...');
    setIsPlacingOrder(true);
    setError(null);

    try {
      if (!supabase) throw new Error("Service unavailable");

      const userId = user?.id;
      console.log('[Checkout] User ID:', userId);
      if (!userId) throw new Error("Please sign in to place an order");

      // 1) Get or create a delivery address
      const addrFull = deliveryAddress?.full_address || "Default Address, Mumbai";
      const addrLat = deliveryAddress?.lat || 19.076;
      const addrLng = deliveryAddress?.lng || 72.8777;

      let addressId: string;
      console.log('[Checkout] Looking for existing address...');

      const addressQueryPromise = supabase
        .from("addresses")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout after 5s' } }), 5000)
      );

      const { data: existingAddr, error: addrQueryErr } = await Promise.race([
        addressQueryPromise,
        timeoutPromise
      ]);

      console.log('[Checkout] Address query result:', { existingAddr, addrQueryErr });

      if (existingAddr) {
        addressId = existingAddr.id;
        console.log('[Checkout] Using existing address:', addressId);
      } else {
        console.log('[Checkout] Creating new address...');
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

        console.log('[Checkout] Address insert result:', { newAddr, addrErr });
        if (addrErr || !newAddr) throw new Error("Could not save delivery address: " + (addrErr?.message || "Unknown error"));
        addressId = newAddr.id;
      }

      // 2) Insert order (status will use DEFAULT value 'pending')
      console.log('[Checkout] Creating order with addressId:', addressId);
      const rentalDays = 4;
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + rentalDays * 86400000)
        .toISOString()
        .split("T")[0];
      const deliveryEta = new Date(
        Date.now() + (deliveryInfo.eta?.minutes || 60) * 60000
      ).toISOString();

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
          // DON'T send status - let database use DEFAULT 'pending'
        })
        .select("id")
        .single();

      console.log('[Checkout] Order insert result:', { order, orderErr });
      if (orderErr) throw new Error(orderErr.message);
      setPlacedOrderId(order.id);

      // 3) Insert order_items in background
      console.log('[Checkout] Inserting order items in background...');
      const orderItems = validCartEntries.map(([id, qty]) => {
        const baseId = id.split('_')[0];
        const size = id.split('_')[1] || 'S';
        const product = cartProducts[baseId];
        return {
          order_id: order.id,
          product_id: baseId,
          size: size,
          rental_price: (product?.price || 0) * qty,
          deposit_amount: Math.round((product?.price || 0) * qty * 0.3),
          rental_duration_days: rentalDays,
        };
      });

      supabase.from("order_items").insert(orderItems).then(({ error: e }) => {
        if (e) console.warn("Order items note:", e.message);
        else console.log('[Checkout] Order items inserted successfully');
      });

      // 4) Clear cart
      console.log('[Checkout] Clearing cart...');
      clearCartDB().catch(() => { });
      for (const [id] of validCartEntries) {
        removeFromCart(id);
      }

      console.log('[Checkout] Order placed successfully!');
      setOrderPlaced(true);
    } catch (err: any) {
      console.error("[Checkout] Failed to place order:", err);
      setError(err.message || "Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  /* ---------------------------------- */
  /* Order Success Screen               */
  /* ---------------------------------- */
  if (orderPlaced) {
    return (
      <MobileShell className="bg-[#111111] text-white">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
              <CheckCircle className="w-14 h-14 text-green-500" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-2"
            style={dmSans}
          >
            Order Placed! 🎉
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-zinc-400 mb-2"
          >
            Your order has been sent to our delivery team.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-zinc-500 mb-8"
          >
            A rider will be assigned shortly to prepare and deliver your order.
          </motion.p>

          {deliveryInfo.eta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-4 rounded-2xl bg-[#232323] mb-8 w-full max-w-xs"
            >
              <div className="flex items-center justify-center gap-2 text-[#f2546d]">
                <Clock className="w-5 h-5" />
                <span className="font-semibold" style={dmSans}>
                  Estimated: {deliveryInfo.eta.displayText}
                </span>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            {placedOrderId && (
              <button
                onClick={() => navigate(`/tracking/${placedOrderId}`)}
                className="w-full py-4 rounded-2xl font-bold bg-[#f2546d] text-white"
                style={dmSans}
              >
                Track Order
              </button>
            )}

            <button
              onClick={() => navigate("/orders")}
              className="w-full py-4 rounded-2xl font-bold bg-[#232323] text-white"
              style={dmSans}
            >
              View Orders
            </button>

            <button
              onClick={() => navigate("/home")}
              className="w-full py-3 rounded-2xl font-medium text-zinc-400"
              style={dmSans}
            >
              Continue Shopping
            </button>
          </motion.div>
        </div>
      </MobileShell>
    );
  }

  /* ---------------------------------- */
  /* Checkout Form (Figma Design)       */
  /* ---------------------------------- */
  return (
    <MobileShell className="bg-[#111111] text-white">
      <main className="flex-1 overflow-y-auto pb-56">

        {/* ─── HEADER: Gradient Glow + Back ─── */}
        <section className="relative px-5 pt-6 pb-2">
          {/* Gradient Glow Orb */}
          <div
            className="absolute -top-20 -left-14 w-36 h-36 rounded-full rotate-[23deg] blur-[100px] pointer-events-none"
            style={{
              background: "linear-gradient(180deg, #f2546d 0%, #ff6078 46%, #611624 88%)",
            }}
          />

          <div className="relative flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          </div>
        </section>


        {/* ─── MY INFORMATION ─── */}
        <section className="px-5 mt-4">
          <h2 className="text-lg font-black text-white tracking-tight" style={dmSans}>
            My Information
          </h2>

          {/* Name placeholder */}
          <div className="w-[83px] h-2.5 bg-[#b4b4b4] rounded-sm mt-2" />

          {/* Contact Details */}
          <h3 className="text-lg font-black text-white tracking-tight mt-9" style={dmSans}>
            Contact Details
          </h3>

          {/* Phone placeholder */}
          <div className="w-[89px] h-2.5 bg-[#b4b4b4] rounded-sm mt-4" />
          {/* Email placeholder */}
          <div className="w-[152px] h-2.5 bg-[#b4b4b4] rounded-sm mt-2" />

          {/* Actual user info (if available) */}
          {user?.email && (
            <p className="text-sm text-[#b4b4b4] mt-2" style={dmSans}>
              {user.email}
            </p>
          )}

          {/* Address */}
          <h3 className="text-lg font-black text-white tracking-tight mt-9" style={dmSans}>
            Address
          </h3>

          {deliveryAddress ? (
            <div className="mt-4">
              <p className="text-sm text-[#b4b4b4] leading-relaxed" style={dmSans}>
                {deliveryAddress.full_address}
              </p>
            </div>
          ) : (
            <div className="w-[132px] h-16 bg-[#b4b4b4] rounded-sm mt-4" />
          )}

          {/* Payment label */}
          <h3 className="text-lg font-black text-white tracking-tight mt-9" style={dmSans}>
            Payment
          </h3>
        </section>


        {/* ─── EDIT ICONS (Right-aligned) ─── */}
        {/* The Figma shows edit icons on the right; they're decorative here */}


        {/* ─── ITEM THUMBNAILS ─── */}
        <section className="px-5 mt-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Show actual cart items as small thumbnails */}
            {validCartEntries.map(([id], i) => {
              const baseId = id.split('_')[0];
              const product = cartProducts[baseId];
              return (
                <div
                  key={id}
                  className={`w-[100px] h-[120px] rounded-2xl flex-shrink-0 overflow-hidden ${i < 2 ? "bg-[#8d303f]" : "bg-[#232323]"
                    }`}
                >
                  {product?.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name || 'Product'}
                      className="w-full h-full object-cover opacity-80"
                    />
                  )}
                </div>
              );
            })}
            {/* Placeholder thumbnails if less than 4 items */}
            {Array.from({ length: Math.max(0, 4 - validCartEntries.length) }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className={`w-[100px] h-[120px] rounded-2xl flex-shrink-0 ${validCartEntries.length + i < 2 ? "bg-[#8d303f]" : "bg-[#232323]"
                  }`}
              />
            ))}
          </div>
        </section>


        {/* ─── PRICE DETAILS ─── */}
        <section className="px-5 mt-10">
          <h2 className="text-2xl font-semibold text-white mb-6 tracking-tight" style={dmSans}>
            Price details
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg text-[#b4b4b4]" style={dmSans}>Order value</span>
              <span className="text-lg text-[#b4b4b4]" style={dmSans}>₹ {originalTotal || 4000}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-lg text-[#b4b4b4]" style={dmSans}>Discount</span>
              <span className="text-lg text-[#b4b4b4]" style={dmSans}>-₹ {discount || 500}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-lg text-[#b4b4b4]" style={dmSans}>Delivery fee</span>
              <span className="text-lg text-[#b4b4b4]" style={dmSans}>₹ {deliveryFee}</span>
            </div>
          </div>

          {/* ─── POP INSURANCE ─── */}
          <div className="flex items-center mt-6">
            <button
              onClick={() => setPopInsurance(!popInsurance)}
              className={`w-6 h-6 rounded flex items-center justify-center border border-[#5f606a] flex-shrink-0 transition-colors ${popInsurance ? "bg-[#f2546d]" : "bg-transparent"
                }`}
            >
              {popInsurance && (
                <svg className="w-4 h-3 text-white" viewBox="0 0 16 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 7L6 11.5L14.5 1.5" />
                </svg>
              )}
            </button>
            <span className="ml-3 text-lg font-semibold text-white" style={dmSans}>
              Pop Insurance
            </span>
            <div className="ml-3 w-[18px] h-[18px] rounded-full border border-[#f2546d] flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-[#f2546d]" style={dmSans}>i</span>
            </div>
            <span className="ml-auto text-lg text-[#b4b4b4]" style={dmSans}>₹ {insuranceFee}</span>
          </div>

          {/* ─── TOTAL ─── */}
          <div className="flex items-center justify-between mt-12">
            <span className="text-2xl font-semibold text-white tracking-tight" style={dmSans}>
              Total
            </span>
            <span className="text-2xl font-semibold text-white tracking-tight" style={dmSans}>
              ₹ {total || 4250}
            </span>
          </div>
        </section>
      </main>


      {/* ─── ERROR ─── */}
      {error && (
        <div className="px-5 pb-2">
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        </div>
      )}


      {/* ─── CHECKOUT FOOTER ─── */}
      <div className="bg-[#232323] rounded-t-[20px] px-5 py-6 space-y-4">

        {/* Subscribe Banner */}
        <div className="flex items-center gap-4 px-4 py-4 bg-[#732230] rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white" style={dmSans}>
              Subscribe to the Future
            </p>
            <p className="text-sm text-white/80 mt-0.5" style={dmSans}>
              Pick any 4 items you like each month for just 1799
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-white flex-shrink-0" />
        </div>

        {/* Progress Steps — Step 2 active */}
        <div className="flex items-center gap-[13px]">
          <div className="flex-1 h-1 bg-[#484848] rounded-sm" />
          <div className="flex-1 h-1 bg-[#f2546d] rounded-sm" />
          <div className="flex-1 h-1 bg-[#484848] rounded-sm" />
        </div>

        {/* Bottom Row: Final Amount + Pay Button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold text-white tracking-tight" style={dmSans}>
              ₹ {total || 4250}
            </p>
            <p className="text-sm text-[#b4b4b4] mt-1" style={dmSans}>
              Final Amount
            </p>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || validCartEntries.length === 0}
            className={`h-12 px-[77px] flex items-center justify-center rounded-2xl font-semibold text-lg transition-all ${isPlacingOrder
              ? "bg-zinc-700 text-zinc-400"
              : "bg-[#f2546d] text-white"
              }`}
            style={dmSans}
          >
            {isPlacingOrder ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                Pay
                <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
