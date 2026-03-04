// src/pages/CartPage.tsx
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { useCart } from "@/context/CartContext";
import { useServiceAvailability } from "@/hooks/useServiceAvailability";
import {
  ChevronLeft,
  Heart,
  X,
  ShoppingBag,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@popclozet/api-client";
import SignupModal from "@/components/SignupModal";
import { Link, useNavigate } from "react-router-dom";
import { CheckoutBlockedModal } from "@/components/CheckoutBlockedModal";
import { CitySelectorModal } from "@/components/CitySelectorModal";
import { getLocalAddresses, SavedAddress } from "@/services/addressService";
import { calculateDeliveryPricing, calculateETA } from "@/services/deliveryService";

/* ---------------------------------- */
/* Mock Add-ons                       */
/* ---------------------------------- */
const ADD_ONS = [
  { id: "addon1", title: "Bracelets", price: 699, originalPrice: 4000 },
  { id: "addon2", title: "Earrings", price: 499, originalPrice: 2500 },
  { id: "addon3", title: "Clutch Bag", price: 899, originalPrice: 3500 },
];

/* ---------------------------------- */
/* Helpers                            */
/* ---------------------------------- */
const hasManualCity = () => {
  try {
    const raw = localStorage.getItem("service_availability");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.source === "manual";
  } catch {
    return false;
  }
};

const getSavedHub = () => {
  try {
    const raw = localStorage.getItem("selected_hub");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity } = useCart();
  const service = useServiceAvailability();
  const navigate = useNavigate();

  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [checkoutBlocked, setCheckoutBlocked] = useState(false);
  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress | null>(null);
  const [selectedHub, setSelectedHub] = useState<{ name: string; distance_km: number; estimated_minutes: number } | null>(null);

  const [cartProducts, setCartProducts] = useState<Record<string, any>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);

  const cartEntries = Object.entries(cartItems);

  const validCartEntries = useMemo(() => {
    return cartEntries.filter(([id]) => {
      const baseId = id.split('_')[0];
      return cartProducts[baseId] !== undefined;
    });
  }, [cartEntries, cartProducts]);

  const totalItems = validCartEntries.reduce((sum, [, qty]) => sum + qty, 0);

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

  // Calculate subtotal
  const subtotal = useMemo(() => {
    return validCartEntries.reduce((total, [id, qty]) => {
      const baseId = id.split('_')[0];
      const product = cartProducts[baseId];
      return total + (product?.price || 0) * qty;
    }, 0);
  }, [validCartEntries, cartProducts]);

  // Original total (before discount)
  const originalTotal = useMemo(() => {
    return validCartEntries.reduce((total, [id, qty]) => {
      const baseId = id.split('_')[0];
      const product = cartProducts[baseId];
      const orig = product?.originalPrice || product?.price || 0;
      return total + orig * qty;
    }, 0);
  }, [validCartEntries, cartProducts]);

  const discount = originalTotal - subtotal;

  // Calculate delivery pricing
  const deliveryInfo = useMemo(() => {
    if (!selectedHub) {
      return { pricing: null, eta: null };
    }
    const pricing = calculateDeliveryPricing(selectedHub.distance_km, subtotal, 'delivery');
    const eta = calculateETA(selectedHub.distance_km, selectedHub.estimated_minutes);
    return { pricing, eta };
  }, [selectedHub, subtotal]);

  const deliveryFee = deliveryInfo.pricing?.totalFee || 50;
  const grandTotal = subtotal + deliveryFee;

  // Load saved address and hub on mount
  useEffect(() => {
    const addresses = getLocalAddresses();
    if (addresses.length > 0) {
      setDeliveryAddress(addresses[0]);
    }
    const hub = getSavedHub();
    if (hub) {
      setSelectedHub(hub);
    }
  }, []);

  /* ---------------------------------- */
  /* Checkout handler                   */
  /* ---------------------------------- */
  const handleCheckout = () => {
    if (!deliveryAddress) {
      navigate("/map?returnTo=/cart");
      return;
    }
    navigate("/checkout");
  };

  return (
    <MobileShell className="bg-[#111111] text-white">

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto pb-56">

        {/* ─── HEADER: Gradient Glow + Title ─── */}
        <section className="relative px-5 pt-6 pb-4">
          {/* Gradient Glow Orb */}
          <div
            className="absolute -top-20 -left-12 w-36 h-36 rounded-full rotate-[23deg] blur-[100px] pointer-events-none"
            style={{
              background: "linear-gradient(180deg, #f2546d 0%, #ff6078 46%, #611624 88%)",
            }}
          />

          <div className="relative flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Shopping Bag
              </h1>
            </div>

            {/* Right: Wishlist button */}
            <button
              onClick={() => navigate('/closet?tab=wishlist')}
              className="w-10 h-10 flex items-center justify-center bg-[#303135] rounded-full"
            >
              <Heart className="w-[19px] h-[19px] text-white/80" />
            </button>
          </div>

          {/* Subtitle */}
          {validCartEntries.length > 0 && !loadingProducts && (
            <p className="mt-3 ml-8 text-lg font-black text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Rentals ({totalItems} {totalItems === 1 ? 'Item' : 'Items'})
            </p>
          )}
        </section>


        {/* ─── LOADING & EMPTY STATES ─── */}
        {loadingProducts ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-10 h-10 border-4 border-[#f2546d] border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Loading your bag...
            </h3>
          </div>
        ) : validCartEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-[#232323] flex items-center justify-center mb-4">
              <ShoppingBag className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Your bag is empty
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              Start exploring and add items to your bag.
            </p>
            <Link
              to="/collections"
              className="px-6 py-3 rounded-2xl bg-[#f2546d] font-semibold text-white"
            >
              Browse Collections
            </Link>
          </div>
        ) : (
          <>
            {/* ─── RENTAL ITEMS ─── */}
            <section className="px-5 space-y-4">
              <AnimatePresence>
                {validCartEntries.map(([id, qty]) => {
                  const baseId = id.split('_')[0];
                  const size = id.split('_')[1] || 'S';
                  const product = cartProducts[baseId];
                  if (!product) return null;

                  return (
                    <motion.div
                      key={id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="flex items-center gap-3 p-3 bg-[#232323] rounded-2xl"
                    >
                      {/* Product Image */}
                      <div className="w-28 h-28 bg-[#2a2a2a] rounded-lg flex-shrink-0 overflow-hidden">
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: Brand + Delete */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                              {product.category || "Zara"}
                            </h3>
                            <p className="text-sm text-[#7c7c7c] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                              {product.name}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(id)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <X className="w-3 h-3 text-zinc-400" />
                          </button>
                        </div>

                        {/* Date badge */}
                        <div className="mt-3 inline-flex px-2 py-1 bg-[#2a2a2a] rounded">
                          <span className="text-sm text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            Dates: 1 Feb - 2 Feb
                          </span>
                        </div>

                        {/* Bottom row: Size + Qty + Prices */}
                        <div className="flex items-center mt-2 gap-2">
                          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#2a2a2a] rounded">
                            <span className="text-sm text-white uppercase text-xs font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>Size: {size}</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#2a2a2a] rounded">
                            <span className="text-sm text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>Qty: {qty}</span>
                          </div>

                          {/* Prices */}
                          <div className="ml-auto flex flex-col items-end">
                            {product.originalPrice && product.originalPrice > product.price && (
                              <div className="relative">
                                <span className="text-sm text-[#5f606a]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                  ₹ {product.originalPrice}
                                </span>
                                <div className="absolute top-1/2 left-0 right-0 h-px bg-[#5f606a]" />
                              </div>
                            )}
                            <span className="text-lg font-black text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                              ₹ {product.price * qty}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </section>


            {/* ─── PRICE DETAILS ─── */}
            <section className="px-5 mt-8">
              <h2 className="text-2xl font-semibold text-white mb-6 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Price details
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Order value
                  </span>
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    ₹ {originalTotal || 4000}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Discount
                  </span>
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    -₹ {discount || 500}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Delivery fee
                  </span>
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    ₹ {deliveryFee}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="w-full h-px bg-[#484848] mt-6" />

              {/* Total */}
              <div className="flex items-center justify-between mt-6">
                <span className="text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Total
                </span>
                <span className="text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  ₹ {grandTotal || 4250}
                </span>
              </div>
            </section>
          </>
        )}
      </main>


      {/* ─── CHECKOUT FOOTER ─── */}
      {validCartEntries.length > 0 && !loadingProducts && (
        <div className="bg-[#232323] rounded-t-[20px] px-5 py-6 space-y-4">

          {/* Subscribe Banner */}
          <div className="flex items-center gap-4 px-4 py-4 bg-[#732230] rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Subscribe to the Future
              </p>
              <p className="text-sm text-white/80 mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Pick any 4 items you like each month for just 1799
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white flex-shrink-0" />
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-[11px]">
            <div className="flex-1 h-1 bg-[#f2546d] rounded-sm" />
            <div className="flex-1 h-1 bg-[#484848] rounded-sm" />
            <div className="flex-1 h-1 bg-[#484848] rounded-sm" />
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            className="w-full h-12 flex items-center justify-center bg-[#f2546d] rounded-2xl font-semibold text-lg text-white tracking-tight transition-colors hover:bg-[#e04860]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {!deliveryAddress ? "Select Address" : "Check Out"}
          </button>
        </div>
      )}

      <BottomNavBar />

      {/* Modals */}
      <SignupModal
        isOpen={isSignupOpen}
        onClose={() => setIsSignupOpen(false)}
      />

      <CheckoutBlockedModal
        open={checkoutBlocked}
        onClose={() => setCheckoutBlocked(false)}
      />

      <CitySelectorModal
        open={citySelectorOpen}
        onClose={() => setCitySelectorOpen(false)}
      />
    </MobileShell>
  );
};

export default CartPage;
