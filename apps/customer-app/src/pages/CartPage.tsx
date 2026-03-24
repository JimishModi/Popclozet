// src/pages/CartPage.tsx
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useServiceAvailability } from "@/hooks/useServiceAvailability";
import { toast } from "sonner";
import {
  ChevronLeft,
  ShoppingBag,
  ChevronRight,
  X,
  Heart,
  Calendar,
  Info,
  Plus
} from "lucide-react";
import { ClosetIcon } from "@/components/icons/ClosetIcon";
import { supabase } from "@popclozet/api-client";
import SignupModal from "@/components/SignupModal";
import { Link, useNavigate } from "react-router-dom";
import { CheckoutBlockedModal } from "@/components/CheckoutBlockedModal";
import { CitySelectorModal } from "@/components/CitySelectorModal";
import { getLocalAddresses, SavedAddress } from "@/services/addressService";
import { calculateDeliveryPricing, calculateETA } from "@/services/deliveryService";
import { cn } from "@/lib/utils";
import type { PricingPlan } from "@/context/CartContext";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity, updateSize, updatePlan, addToCart } = useCart();
  const service = useServiceAvailability();
  const navigate = useNavigate();

  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [checkoutBlocked, setCheckoutBlocked] = useState(false);
  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SavedAddress | null>(null);
  const [selectedHub, setSelectedHub] = useState<{ name: string; distance_km: number; estimated_minutes: number } | null>(null);

  const [cartProducts, setCartProducts] = useState<Record<string, any>>({});
  const [cartInventory, setCartInventory] = useState<Record<string, any[]>>({});
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string, discount: number, type: 'percent' | 'fixed' } | null>(null);
  const [addOnProducts, setAddOnProducts] = useState<any[]>([]);

  const cartEntries = Object.entries(cartItems);

  const validCartEntries = useMemo(() => {
    return cartEntries.filter(([key, data]) => {
      const parts = key.split('_');
      const productId = parts[0];
      return cartProducts[productId] !== undefined;
    });
  }, [cartEntries, cartProducts]);

  const totalItems = validCartEntries.reduce((sum, [, data]) => sum + data.quantity, 0);

  useEffect(() => {
    const fetchCartProducts = async () => {
      const uniqueIds = Array.from(new Set(cartEntries.map(([id]) => id.split('_')[0])));
      if (uniqueIds.length === 0) {
        setCartProducts({});
        setCartInventory({});
        setLoadingProducts(false);
        return;
      }

      const [productsRes, inventoryRes] = await Promise.all([
        supabase.from('products').select('*, product_discounts(*)').in('id', uniqueIds),
        supabase.from('inventory').select('*').in('product_id', uniqueIds)
      ]);

      if (productsRes.data && !productsRes.error) {
        const productMap: Record<string, any> = {};
        productsRes.data.forEach((p: any) => {
          const originalPriceValue = parseFloat(p.rental_price ?? p.price ?? '0');
          const disc = p.product_discounts?.[0];

          let finalPrice = originalPriceValue;
          if (disc) {
            if (disc.discount_type === 'percentage') {
              finalPrice = originalPriceValue - (originalPriceValue * (disc.discount_value / 100));
            } else if (disc.discount_type === 'fixed_amount') {
              finalPrice = Math.max(0, originalPriceValue - disc.discount_value);
            }
          }
          finalPrice = Math.round(finalPrice);

          productMap[p.id] = {
            ...p,
            price: finalPrice,
            originalPrice: originalPriceValue,
            imageUrl: p.images?.[0] || '',
            isLiveProduct: true,
          };
        });
        setCartProducts(productMap);
      }

      if (inventoryRes.data && !inventoryRes.error) {
        const invMap: Record<string, any[]> = {};
        inventoryRes.data.forEach((item: any) => {
          if (!invMap[item.product_id]) invMap[item.product_id] = [];
          invMap[item.product_id].push(item);
        });
        setCartInventory(invMap);
      }
      setLoadingProducts(false);
    };

    fetchCartProducts();
  }, [JSON.stringify(cartEntries.map(([key]) => key.split('_')[0]))]);

  useEffect(() => {
    const fetchAddOns = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, rental_price_1d, rental_price, rental_price_3d, buy_price, images, inventory(size, available_stock)')
          .in('category', ['accessories', 'neck chain', 'neclace', 'bracelet'])
          .limit(8);

        if (data && !error) {
          setAddOnProducts(data);
        }
      } catch (err) {
        console.error("Add-ons fetch failed:", err);
      }
    };
    fetchAddOns();
  }, []);

  // --- Subscription state (commented out) ---
  // const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  // const [subBenefits, setSubBenefits] = useState<SubscriptionBenefits | null>(null);

  // Calculate cart metrics
  // const totalQty = useMemo(() => {
  //   return validCartEntries.reduce((sum, [, data]) => sum + data.quantity, 0);
  // }, [validCartEntries]);

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

    // --- Subscription check (commented out) ---
    // const checkSub = async () => {
    //   const benefits = await getSubscriptionBenefits();
    //   if (benefits) {
    //     setHasActiveSubscription(benefits.hasActiveSubscription);
    //     setSubBenefits(benefits);
    //   } else {
    //     setHasActiveSubscription(false);
    //     setSubBenefits(null);
    //   }
    // };
    // checkSub();
  }, []);

  // --- Subscription limit checks (commented out) ---
  // const invalidCatalogItem = validCartEntries.find(([id]) => {
  //   const baseId = id.split('_')[0];
  //   const product = cartProducts[baseId];
  //   return !product?.isLiveProduct || !UUID_PATTERN.test(baseId);
  // });
  // const exceedsMonthlyLimit = subBenefits ? totalQty > subBenefits.remainingMonthly : false;
  // const exceedsConcurrentLimit = subBenefits ? totalQty > subBenefits.remainingConcurrent : false;
  // const expensiveItem = subBenefits ? validCartEntries.find(([id]) => {
  //   const p = cartProducts[id.split('_')[0]];
  //   const value = p?.mrp || p?.originalPrice || p?.price || 0;
  //   return value > subBenefits.maxItemValue;
  // }) : undefined;
  // const hasExpensiveItem = !!expensiveItem;

  // const subscriptionError = (() => {
  //   if (invalidCatalogItem) {
  //     return "One or more items in your bag are not linked to a live catalog product. Remove them before checkout.";
  //   }
  //   if (!subBenefits) return null;
  //   if (exceedsMonthlyLimit) {
  //     return `Your ${subBenefits.planName} plan has ${subBenefits.remainingMonthly} monthly rental slot(s) left this cycle. Please remove ${totalQty - subBenefits.remainingMonthly} item(s).`;
  //   }
  //   if (exceedsConcurrentLimit) {
  //     return `Your ${subBenefits.planName} plan has ${subBenefits.remainingConcurrent} concurrent item slot(s) left right now. Please remove ${totalQty - subBenefits.remainingConcurrent} item(s).`;
  //   }
  //   if (hasExpensiveItem) return `Your ${subBenefits.planName} plan covers items up to ₹${subBenefits.maxItemValue} retail value. An item in your cart exceeds this limit.`;
  //   return null;
  // })();

  const canCheckout = validCartEntries.length > 0;

  const getPlanPrice = (product: any, plan: string) => {
    if (!product) return 0;
    switch (plan) {
      case '1d': return product.rental_price_1d;
      case '2d': return product.rental_price_2d;
      case '3d': return product.rental_price_3d || product.price;
      case 'buy': return product.buy_price;
      default: return product.price;
    }
  };

  // Calculate subtotal
  const subtotal = useMemo(() => {
    return validCartEntries.reduce((total, [key, data]) => {
      const productId = key.split('_')[0];
      const product = cartProducts[productId];
      const price = getPlanPrice(product, data.plan);
      return total + (price || 0) * data.quantity;
    }, 0);
  }, [validCartEntries, cartProducts]);

  // Original total (using MRP or 5x 3d rental as baseline)
  const originalTotal = useMemo(() => {
    return validCartEntries.reduce((total, [key, data]) => {
      const productId = key.split('_')[0];
      const product = cartProducts[productId];
      const mrp = product?.mrp || (getPlanPrice(product, '3d') * 5);
      return total + mrp * data.quantity;
    }, 0);
  }, [validCartEntries, cartProducts]);

  const discount = originalTotal - subtotal;

  // Calculate delivery pricing
  const deliveryInfo = useMemo(() => {
    if (!selectedHub) {
      return { pricing: null, eta: null };
    }
    // const isFree = subBenefits?.freeDelivery || false;
    const isFree = false;
    const pricing = calculateDeliveryPricing(selectedHub.distance_km, subtotal, 'delivery', isFree);
    const eta = calculateETA(selectedHub.distance_km, selectedHub.estimated_minutes);
    return { pricing, eta };
  }, [selectedHub, subtotal]);

  // const deliveryFee = deliveryInfo.pricing?.totalFee ?? (subBenefits?.freeDelivery ? 0 : 40);
  const deliveryFee = deliveryInfo.pricing?.totalFee ?? 40;

  // Final math with coupons
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') {
      return Math.round(subtotal * (appliedCoupon.discount / 100));
    }
    return appliedCoupon.discount;
  }, [appliedCoupon, subtotal]);

  const grandTotal = subtotal - couponDiscount;

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'POP20') {
      setAppliedCoupon({ id: 'POP20', discount: 20, type: 'percent' });
      toast.success("Coupon applied! 20% off");
    } else if (couponCode.toUpperCase() === 'FIRST100') {
      setAppliedCoupon({ id: 'FIRST100', discount: 100, type: 'fixed' });
      toast.success("Coupon applied! ₹100 off");
    } else {
      toast.error("Invalid coupon code");
    }
  };

  /* ---------------------------------- */
  /* Checkout handler                   */
  /* ---------------------------------- */
  const handleCheckout = () => {
    navigate("/checkout/address");
  };

  const renderCartItem = (key: string, data: any, bgColor: string) => {
    const parts = key.split('_');
    const productId = parts[0];
    const product = cartProducts[productId];
    if (!product) return null;

    const { quantity, size, plan } = data;
    const itemPrice = getPlanPrice(product, plan);
    const isRental = ['1d', '2d', '3d'].includes(plan);

    return (
      <motion.div
        key={key}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, x: -50 }}
        className="relative flex gap-4 p-4 rounded-3xl overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {/* Remove Button (Top Right) */}
        <button
          onClick={() => removeFromCart(productId, size, plan)}
          className="absolute top-4 right-4 text-white/40 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product Image */}
        <div className="w-24 h-24 rounded-2xl bg-zinc-800 flex-shrink-0 overflow-hidden border border-white/5">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-base font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {product.category || "Zara"}
          </h3>
          <p className="text-sm text-zinc-500 font-medium truncate mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {product.name}
          </p>

          {/* Date Selector (Rentals Only) */}
          {isRental && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
              <Calendar className="w-3.5 h-3.5 text-white/60" />
              <span className="text-xs font-medium text-white/90" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                1 Feb - 2 Feb
              </span>
            </div>
          )}

          {/* Pills: Size & Qty */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Size:</span>
              <select
                value={size}
                onChange={(e) => updateSize(productId, size, e.target.value, plan)}
                className="bg-transparent text-white text-[10px] font-black focus:outline-none appearance-none"
              >
                {(cartInventory[productId] || []).map((inv: any) => (
                  <option key={inv.size} value={inv.size} disabled={inv.available_stock <= 0}>
                    {inv.size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Qty:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(productId, size, plan, quantity - 1)}
                  className="text-white/60 hover:text-white text-xs font-bold px-1"
                >
                  -
                </button>
                <span className="text-[10px] font-black text-white min-w-[12px] text-center">{quantity}</span>
                <button
                  onClick={() => {
                     const currentInv = cartInventory[productId]?.find((i: any) => i.size === size);
                     const maxQty = currentInv?.available_stock || 0;
                     if (quantity < maxQty) {
                        updateQuantity(productId, size, plan, quantity + 1);
                     } else {
                        toast.error('Maximum available stock reached');
                     }
                  }}
                  className={cn("text-xs font-bold px-1 transition-colors", quantity >= (cartInventory[productId]?.find((i: any) => i.size === size)?.available_stock || 0) ? "text-white/20 cursor-not-allowed" : "text-white/60 hover:text-white")}
                  disabled={quantity >= (cartInventory[productId]?.find((i: any) => i.size === size)?.available_stock || 0)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base font-black text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ₹ {itemPrice * quantity}
            </span>
            <span className="text-sm font-medium text-zinc-600 line-through" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ₹ {(product.originalPrice || itemPrice * 5) * quantity}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <MobileShell className="bg-black text-white">

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto pb-56 lg:pb-12 lg:px-8 w-full max-w-7xl mx-auto flex flex-col">

        {/* ─── HEADER: Gradient Glow + Title ─── */}
        <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg px-4 pt-4 pb-3 md:px-5 md:pt-6 md:pb-4">
          {/* Error Banner */}
          {subscriptionError && (
            <div className="absolute top-20 left-4 right-4 z-50 bg-red-500/20 border border-red-500/50 text-red-100 p-4 rounded-xl flex items-start gap-3 text-sm shadow-xl backdrop-blur-md">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <p className="leading-tight">{subscriptionError}</p>
            </div>
          )}

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
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/5 bg-white/5 transition-all active:scale-95"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </button>
              <h1 className="text-lg md:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Shopping Bag
              </h1>
            </div>

            {/* Right: Wishlist button */}
            <button
              onClick={() => navigate('/closet?tab=wishlist')}
              className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[#303135] rounded-full active:scale-95 transition-all"
            >
              <Heart className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Subtitle */}
          {validCartEntries.length > 0 && !loadingProducts && (
            <p className="mt-2 ml-8 text-base md:text-lg font-black text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Rentals ({totalItems} {totalItems === 1 ? 'Item' : 'Items'})
            </p>
          )}
        </header>

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
          <div className="lg:flex lg:gap-12 lg:items-start lg:mt-6 w-full flex-1">
            {/* Left Column */}
            <div className="lg:w-2/3 lg:pr-4">
            {/* ─── RENTAL ITEMS ─── */}
            <section className="px-5 lg:px-0 space-y-4">
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
                        <div className="flex items-center mt-3 gap-3">
                          {/* Size Selector */}
                          <div className="relative">
                            <select
                              value={size}
                              onChange={(e) => updateSize(id, e.target.value)}
                              className="appearance-none bg-[#2a2a2a] text-white text-[11px] font-bold uppercase px-3 py-1.5 rounded-xl border border-white/5 focus:outline-none"
                              style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                              {(cartInventory[baseId] || []).map((inv: any) => (
                                <option key={inv.size} value={inv.size} disabled={inv.available_stock <= 0}>
                                  {inv.size} {inv.available_stock <= 0 ? '(OOS)' : ''}
                                </option>
                              ))}
                              {/* Fallback if inventory is loading or empty */}
                              {!(cartInventory[baseId] || []).some((inv: any) => inv.size === size) && (
                                <option value={size}>{size}</option>
                              )}
                            </select>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center bg-[#2a2a2a] rounded-xl border border-white/5">
                            <button
                              onClick={() => updateQuantity(id, qty - 1)}
                              className="px-2 py-1.5 text-zinc-400 hover:text-white transition-colors"
                            >
                              -
                            </button>
                            <span className="text-[11px] font-bold text-white min-w-[20px] text-center">{qty}</span>
                            <button
                              onClick={() => updateQuantity(id, qty + 1)}
                              className="px-2 py-1.5 text-zinc-400 hover:text-white transition-colors"
                            >
                              +
                            </button>
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
            </div>

            {/* Right Column */}
            <div className="lg:w-1/3 lg:sticky lg:top-32 mt-12 lg:mt-0 flex flex-col gap-8">
            {/* ─── COUPON SECTION ─── */}
            <section className="px-5 lg:px-0">
              <h2 className="text-xl font-bold text-white mb-4 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Coupons
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code (e.g. POP20)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 bg-[#232323] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#f2546d]/50 transition-colors"
                />
                <button
                  onClick={handleApplyCoupon}
                  className="px-6 py-3 bg-[#303135] rounded-2xl text-sm font-bold text-white hover:bg-[#404045] transition-colors"
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <div className="mt-3 flex items-center justify-between px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <span className="text-sm font-bold text-green-500">{appliedCoupon.id} applied!</span>
                  <button onClick={() => setAppliedCoupon(null)} className="text-zinc-500 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </section>

            {/* ─── PRICE DETAILS ─── */}
            <section className="px-5 lg:px-0">
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
                    -₹ {discount + couponDiscount}
                  </span>
                </div>

                {appliedCoupon && (
                  <div className="flex items-center justify-between">
                    <span className="text-lg text-green-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      Coupon ({appliedCoupon.id})
                    </span>
                    <span className="text-lg text-green-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      -₹ {couponDiscount}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Delivery fee
                  </span>
                  <span className="text-lg text-[#b4b4b4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    ₹ {deliveryFee}
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-white/5 mt-6" />

              <div className="flex items-center justify-between mt-6">
                <span className="text-xl font-black text-white">Total</span>
                <span className="text-xl font-black text-white">₹ {grandTotal}</span>
              </div>
            </section>

            {/* Desktop Checkout Footer inside Right Column */}
            <div className="hidden lg:block bg-[#232323] rounded-2xl px-6 py-6 space-y-5 shadow-2xl">
              {!hasActiveSubscription && (
                <button onClick={() => navigate('/subscription-plans')} className="w-full text-left">
                  <div className="flex items-center gap-4 px-5 py-5 bg-[#732230] rounded-xl group overflow-hidden hover:scale-[1.02] transition-transform">
                    <div className="flex-1 min-w-0">
                      <p className="text-[17px] font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Subscribe to the Future</p>
                      <p className="text-[14px] text-white/90 mt-1 font-medium tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Pick any 4 items you like each month for just 1799</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white flex-shrink-0" />
                  </div>
                </button>
              )}

              {subBenefits && (
                <div className="rounded-2xl border border-white/5 bg-[#171717] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>{subBenefits.planName} plan active</p>
                      <p className="mt-1 text-[11px] text-zinc-500 uppercase tracking-widest font-bold">Monthly quota and concurrent hold limit</p>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#f2546d]">₹{subBenefits.maxItemValue} cap</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#232323] px-3 py-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Monthly left</p>
                      <p className="mt-1 text-lg font-black text-white">{subBenefits.remainingMonthly}/{subBenefits.monthlyItems}</p>
                    </div>
                    <div className="rounded-xl bg-[#232323] px-3 py-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Concurrent left</p>
                      <p className="mt-1 text-lg font-black text-white">{subBenefits.remainingConcurrent}/{subBenefits.concurrentItems}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={canCheckout ? handleCheckout : undefined}
                disabled={!canCheckout}
                className={cn(
                  "w-full h-14 flex items-center justify-center rounded-2xl font-bold text-lg text-white tracking-tight transition-colors",
                  canCheckout ? "bg-[#f2546d] hover:bg-[#e04860] shadow-xl shadow-[#f2546d]/20" : "bg-white/10 text-white/40 cursor-not-allowed"
                )}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {subscriptionError ? "Limit Exceeded" : !deliveryAddress ? "Select Address" : "Check Out"}
              </button>
            </div>

            </div>
          </div>
        )}
      </main>


      {/* ─── CHECKOUT FOOTER (Mobile only) ─── */}
      {validCartEntries.length > 0 && !loadingProducts && (
        <div className="bg-[#232323] rounded-t-[20px] px-5 py-6 space-y-4 lg:hidden">

          {/* Subscribe Banner */}
          {!hasActiveSubscription && (
            <button
              onClick={() => navigate('/subscription-plans')}
              className="w-full text-left"
            >
              <div className="flex items-center gap-4 px-5 py-4 bg-[#2D1414] rounded-2xl relative overflow-hidden active:scale-[0.98] transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white tracking-tight">
                    Subscribe to the Future
                  </p>
                  <p className="text-xs text-white/60 mt-0.5 font-medium">
                    Pick any 4 items you like each month for just 1799
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </div>
            </button>
          )}

            {/* Progress Bars */}
            <div className="flex items-center gap-2 px-1">
              <div className="flex-1 h-1.5 bg-[#E95466] rounded-full" />
              <div className="flex-1 h-1.5 bg-white/10 rounded-full" />
              <div className="flex-1 h-1.5 bg-white/10 rounded-full" />
            </div>

            {/* Checkout CTA */}
            <button
              onClick={handleCheckout}
              className="w-full h-14 flex items-center justify-center bg-[#E95466] rounded-full font-black text-lg text-white shadow-lg shadow-[#E95466]/20 active:scale-[0.98] transition-all"
            >
              Check Out
            </button>
        </div>
      )}

      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
      <CheckoutBlockedModal open={checkoutBlocked} onClose={() => setCheckoutBlocked(false)} />
      <CitySelectorModal open={citySelectorOpen} onClose={() => setCitySelectorOpen(false)} />
    </MobileShell>
  );
};

export default CartPage;
