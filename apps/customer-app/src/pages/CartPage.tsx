// src/pages/CartPage.tsx
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "vaul";
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
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();

  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [checkoutBlocked, setCheckoutBlocked] = useState(false);
  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  
  // Drawer states
  const [sizeDrawerOpen, setSizeDrawerOpen] = useState(false);
  const [selectedItemForSize, setSelectedItemForSize] = useState<{ productId: string, plan: string, currentSize: string } | null>(null);

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
    if (!user) {
        navigate('/auth/login');
        return;
    }
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
            <button
              onClick={() => {
                setSelectedItemForSize({ productId, plan, currentSize: size });
                setSizeDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Size:</span>
              <span className="bg-transparent text-white text-[10px] font-black">{size}</span>
            </button>

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
      <main className="flex-1 overflow-y-auto pb-[200px]">

        {/* ─── HEADER: Black Background + Title + Wishlist ─── */}
        <section className="px-5 pt-6 pb-4 bg-black border-b border-white/5">
          <div className="flex items-center justify-between">
            {/* Left: Back */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center p-1"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>

            {/* Center: Title */}
            <h1 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Shopping Bag
            </h1>

            {/* Right: Wishlist button */}
            <button
              onClick={() => navigate('/closet?tab=wishlist')}
              className="p-1"
            >
              <Heart className="w-6 h-6 text-white" />
            </button>
          </div>
        </section>

        {/* ─── GROUPING LOGIC ─── */}
        {(() => {
          const rentalItems = validCartEntries.filter(([, data]) => ['1d', '2d', '3d'].includes(data.plan));
          const buyoutItems = validCartEntries.filter(([, data]) => data.plan === 'buy');

          if (loadingProducts) {
            return (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-10 h-10 border-4 border-[#E95466] border-t-transparent rounded-full animate-spin mb-4" />
                <h3 className="text-lg font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Loading your bag...
                </h3>
              </div>
            );
          }

          if (validCartEntries.length === 0) {
            return (
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
                  className="px-6 py-3 rounded-2xl bg-[#E95466] font-semibold text-white"
                >
                  Browse Collections
                </Link>
              </div>
            );
          }

          return (
            <>
              {/* ─── RENTALS SECTION ─── */}
              {rentalItems.length > 0 && (
                <section className="px-5 mt-6">
                  <h2 className="text-lg font-bold text-white mb-4 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Rentals ({rentalItems.length} {rentalItems.length === 1 ? 'Item' : 'Items'})
                  </h2>
                  <div className="space-y-4">
                    {rentalItems.map(([key, data]) => renderCartItem(key, data, '#1E1E1E'))}
                  </div>
                </section>
              )}

              {/* ─── INSTANT BUY SECTION ─── */}
              {buyoutItems.length > 0 && (
                <section className="px-5 mt-8">
                  <h2 className="text-lg font-bold text-white mb-4 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Instant Buy ({buyoutItems.length} {buyoutItems.length === 1 ? 'Item' : 'Items'})
                  </h2>
                  <div className="space-y-4">
                    {buyoutItems.map(([key, data]) => renderCartItem(key, data, '#2D1414'))}
                  </div>
                </section>
              )}
            </>
          );
        })()}

        {/* ─── ADD ONS SECTION ─── */}
        {validCartEntries.length > 0 && addOnProducts.length > 0 && (
          <section className="mt-10 overflow-hidden">
            <h2 className="px-5 text-lg font-bold text-white mb-4 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Add ons
            </h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-4">
              {addOnProducts.map((addon) => {
                const imageUrl = addon.images?.[0] || '';
                const price = addon.rental_price_1d || addon.rental_price || 0;
                const mrp = addon.buy_price || (price * 5);
                
                const invData = addon.inventory || [];
                const defaultInv = invData.find((i: any) => i.available_stock > 0) || invData[0] || { size: 'One Size', available_stock: 0 };
                const defaultSize = defaultInv.size;
                const available = defaultInv.available_stock || 0;
                
                // We use '1d' by default as requested
                const currentQty = cartItems[`${addon.id}_${defaultSize}_1d`]?.quantity || 0;
                const isMaxReached = currentQty >= available;
                
                return (
                  <div 
                    key={addon.id} 
                    className="w-40 flex-shrink-0 bg-[#1E1E1E] rounded-3xl p-3 border border-white/5 transition-transform active:scale-95 cursor-pointer"
                    onClick={() => navigate(`/product/${addon.id}`)}
                  >
                    <div className="w-full aspect-square bg-zinc-800 rounded-2xl mb-3 overflow-hidden">
                      {imageUrl && (
                        <img src={imageUrl} alt={addon.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white truncate">{addon.name}</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">₹{price}</p>
                        <p className="text-[10px] text-zinc-600 line-through">₹{mrp}</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMaxReached) {
                            toast.error('Maximum available stock reached for this add-on');
                            return;
                          }
                          // addToCart handles creation or qty update under the hood
                          addToCart(addon.id, defaultSize, '1d');
                        }}
                        className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", isMaxReached ? "bg-white/5 cursor-not-allowed" : "bg-zinc-800 hover:bg-[#E95466]")}
                        disabled={isMaxReached}
                      >
                        <Plus className={cn("w-4 h-4 text-white", isMaxReached && "opacity-30")} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── COUPON SECTION ─── */}
        {validCartEntries.length > 0 && (
          <section className="px-5 mt-8">
            <h2 className="text-lg font-bold text-white mb-4 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Coupons
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter code (e.g. POP20)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm focus:outline-none focus:border-[#E95466]/50 transition-colors"
              />
              <button
                onClick={handleApplyCoupon}
                className="px-6 py-3 bg-white/10 rounded-2xl text-sm font-bold text-white hover:bg-white/20 transition-colors"
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
        )}

        {/* ─── PRICE DETAILS ─── */}
        {validCartEntries.length > 0 && (
          <section className="px-5 mt-10">
            <h2 className="text-lg font-bold text-white mb-6 tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Price details
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-base">
                <span className="text-zinc-500 font-medium">Order value</span>
                <span className="text-white font-bold">₹ {originalTotal}</span>
              </div>

              <div className="flex items-center justify-between text-base">
                <span className="text-zinc-500 font-medium">Discount</span>
                <span className="text-[#E95466] font-bold">- ₹ {discount + couponDiscount}</span>
              </div>

              {appliedCoupon && (
                <div className="flex items-center justify-between text-base">
                  <span className="text-green-500 font-medium">Coupon ({appliedCoupon.id})</span>
                  <span className="text-green-500 font-bold">- ₹ {couponDiscount}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-base">
                <span className="text-zinc-500 font-medium">Delivery fee</span>
                <span className="text-white font-bold">₹ {deliveryFee}</span>
              </div>

              <div className="w-full h-px bg-white/5 mt-6" />

              <div className="flex items-center justify-between mt-6">
                <span className="text-xl font-black text-white">Total</span>
                <span className="text-xl font-black text-white">₹ {grandTotal}</span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      {validCartEntries.length > 0 && !loadingProducts && (
        <div className="fixed bottom-[85px] left-0 right-0 z-40">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none" />
          <div className="relative border-t border-white/5 bg-black/40 backdrop-blur-xl px-5 py-6 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="max-w-[430px] mx-auto space-y-6">
            {/* --- Subscribe Banner (commented out) --- */}
            {/* <button
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
            </button> */}

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
        </div>
      </div>
      )}

      {/* Size Selector Drawer */}
      <Drawer.Root open={sizeDrawerOpen} onOpenChange={setSizeDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-[#111111] rounded-t-[32px] border-t border-white/10 z-50 focus:outline-none pb-safe">
            <div className="p-6">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-bold text-white mb-6 text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Select Size
              </h3>
              {selectedItemForSize && (
                <div className="grid grid-cols-4 gap-3">
                  {(cartInventory[selectedItemForSize.productId] || []).map((inv: any) => {
                    const isSelected = inv.size === selectedItemForSize.currentSize;
                    const isAvailable = inv.available_stock > 0;
                    return (
                      <button
                        key={inv.size}
                        disabled={!isAvailable}
                        onClick={() => {
                          updateSize(selectedItemForSize.productId, selectedItemForSize.currentSize, inv.size, selectedItemForSize.plan as any);
                          setSizeDrawerOpen(false);
                        }}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-[#E95466] border-[#E95466] text-white"
                            : isAvailable
                            ? "bg-white/5 border-white/10 text-white hover:border-[#E95466]/50 hover:bg-white/10"
                            : "bg-white/5 border-transparent text-zinc-600 cursor-not-allowed hidden"
                        }`}
                      >
                        <span className="font-bold text-lg">{inv.size}</span>
                        {!isAvailable && <span className="text-[10px] mt-1">Sold out</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
      <CheckoutBlockedModal open={checkoutBlocked} onClose={() => setCheckoutBlocked(false)} />
      <CitySelectorModal open={citySelectorOpen} onClose={() => setCitySelectorOpen(false)} />
    </MobileShell>
  );
};

export default CartPage;
