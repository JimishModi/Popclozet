// src/pages/CartPage.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "vaul";
import { useCart } from "@/context/CartContext";
import { useServiceAvailability } from "@/hooks/useServiceAvailability";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  X,
  Heart,
  Calendar,
  Plus,
  Info
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
import { previewOrder } from "@/services/ordersService";
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

const CARD_GAP = 12;

const AddOnsCarousel = ({
  addOnProducts,
  primaryRentalDays,
  addToCart,
}: {
  addOnProducts: any[];
  primaryRentalDays: number;
  addToCart: (id: string, size: string, plan: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(2);
  const [cardWidth, setCardWidth] = useState(160);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      const perPage = w >= 700 ? 4 : w >= 480 ? 3 : 2;
      const cw = (w - (perPage - 1) * CARD_GAP) / perPage;
      setCardsPerPage(perPage);
      setCardWidth(cw);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const totalPages = Math.ceil(addOnProducts.length / cardsPerPage);
  const pageOffset = cardsPerPage * (cardWidth + CARD_GAP);

  return (
    <section className="px-5 lg:px-0 mt-8 overflow-hidden" ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#f2546d]" />
          <h2 className="text-base font-black text-white uppercase tracking-widest" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Add-Ons
          </h2>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-8 h-8 rounded-full bg-[#232323] border border-white/10 flex items-center justify-center transition-opacity"
              style={{ opacity: page === 0 ? 0.3 : 1 }}
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="w-8 h-8 rounded-full bg-[#232323] border border-white/10 flex items-center justify-center transition-opacity"
              style={{ opacity: page === totalPages - 1 ? 0.3 : 1 }}
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
      <div className="overflow-hidden w-full">
        <motion.div
          className="flex"
          style={{ gap: CARD_GAP }}
          animate={{ x: -page * pageOffset }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {addOnProducts.map((product: any) => {
            const basePrice = product.rental_price_1d || product.rental_price || 0;
            const displayPrice = basePrice * primaryRentalDays;
            return (
              <motion.div
                key={product.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => addToCart(product.id, 'One Size', '1d')}
                className="relative rounded-2xl overflow-hidden bg-[#1C1C1E] border border-white/5 cursor-pointer flex-shrink-0"
                style={{ width: cardWidth }}
              >
                <div className="bg-zinc-900 overflow-hidden" style={{ height: cardWidth }}>
                  {product.images?.[0] && (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white truncate">{product.name}</p>
                  <p className="text-xs text-[#f2546d] font-black mt-0.5">
                    ₹{displayPrice}
                    {primaryRentalDays > 1 && (
                      <span className="text-white/30 font-normal ml-1">({primaryRentalDays}d)</span>
                    )}
                  </p>
                </div>
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#f2546d] flex items-center justify-center shadow-lg">
                  <Plus className="w-3.5 h-3.5 text-white" />
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

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
  const [activeInfoTooltip, setActiveInfoTooltip] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const planDays = (plan: string) => {
    if (plan === '1d') return 1;
    if (plan === '2d') return 2;
    if (plan === '3d') return 3;
    return 1;
  };

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
          // MRP comes from the DB — this is the true retail price
          const mrp = parseFloat(p.mrp ?? '0');

          productMap[p.id] = {
            ...p,
            mrp,
            rental_price_1d: parseFloat(p.rental_price_1d ?? '0'),
            rental_price_2d: parseFloat(p.rental_price_2d ?? '0'),
            rental_price_3d: parseFloat(p.rental_price_3d ?? p.rental_price ?? p.price ?? '0'),
            buy_price: parseFloat(p.buy_price ?? '0'),
            price: parseFloat(p.rental_price ?? p.price ?? '0'),
            originalPrice: mrp,
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

  // Calculate cart metrics
  const totalQty = useMemo(() => {
    return validCartEntries.reduce((sum, [, data]) => sum + data.quantity, 0);
  }, [validCartEntries]);

  const primaryRentalDays = useMemo(() => {
    const rentalEntry = validCartEntries.find(([, data]) => ['1d', '2d', '3d'].includes(data.plan));
    return rentalEntry ? planDays(rentalEntry[1].plan) : 1;
  }, [validCartEntries]);

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

  // Original total = sum of MRP (if available) or plan price for each item
  const originalTotal = useMemo(() => {
    return validCartEntries.reduce((total, [key, data]) => {
      const productId = key.split('_')[0];
      const product = cartProducts[productId];
      const planPrice = getPlanPrice(product, data.plan) || 0;
      const mrp = product?.mrp || planPrice;
      return total + Math.max(mrp, planPrice) * data.quantity;
    }, 0);
  }, [validCartEntries, cartProducts]);

  const discount = Math.max(0, originalTotal - subtotal);

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

  const grandTotal = subtotal - couponDiscount + deliveryFee;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    try {
      // Validate coupon via server-side preview_order RPC (never trust client-only checks)
      const previewItems = validCartEntries.map(([key, data]) => ({
        product_id: key.split('_')[0],
        plan: data.plan || '3d',
        quantity: data.quantity || 1,
      }));

      const result = await previewOrder({
        items: previewItems,
        couponCode: couponCode.trim(),
        distanceKm: 0,
      });

      if (!result.success) {
        toast.error("Failed to validate coupon");
        return;
      }

      if (!result.coupon?.valid) {
        toast.error(result.coupon?.message || "Invalid coupon code");
        return;
      }

      const serverDiscount = result.coupon_discount ?? 0;
      const type = result.coupon?.discount_type === 'percentage' ? 'percent' : 'fixed';
      setAppliedCoupon({ id: couponCode.trim().toUpperCase(), discount: serverDiscount, type });
      toast.success(`Coupon applied! -₹${serverDiscount} off`);
    } catch {
      toast.error("Failed to validate coupon. Try again.");
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
    navigate("/checkout/address", {
      state: { couponCode: appliedCoupon?.id || null },
    });
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
        <div
          onClick={() => navigate(`/product/${productId}`)}
          className="w-24 h-24 rounded-2xl bg-zinc-800 flex-shrink-0 overflow-hidden border border-white/5 cursor-pointer hover:opacity-80 transition-opacity"
        >
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
          <div onClick={() => navigate(`/product/${productId}`)} className="cursor-pointer group inline-block max-w-full">
            <h3 className="text-base font-bold text-white tracking-tight group-hover:underline" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {product.category || "Zara"}
            </h3>
            <p className="text-sm text-zinc-500 font-medium truncate mt-0.5 group-hover:text-zinc-300 transition-colors" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {product.name}
            </p>
          </div>

          {/* Date Selector (Rentals Only) */}
          {isRental && (
            <div className="mt-2 flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                <Calendar className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs font-medium text-white/90" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  1 Feb - 2 Feb
                </span>
              </div>
              <div className="relative">
                <button
                  onClick={(e) => {
                    if (activeInfoTooltip === key) {
                      setActiveInfoTooltip(null);
                    } else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const tooltipWidth = 200;
                      const left = Math.min(rect.left, window.innerWidth - tooltipWidth - 16);
                      setTooltipPos({ top: rect.bottom + 8, left: Math.max(16, left) });
                      setActiveInfoTooltip(key);
                    }
                  }}
                  className="text-white/40 hover:text-white/70 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
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
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-base font-black text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ₹ {itemPrice * quantity}
            </span>
            {product.mrp > 0 && product.mrp !== itemPrice && (
              <span className="text-sm font-medium text-zinc-600 line-through" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                ₹ {product.mrp * quantity}
              </span>
            )}
            {isRental && (
              <span className="text-xs text-zinc-500 font-medium ml-1">
                ({planDays(plan)}d rental)
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <MobileShell className="bg-black text-white">

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-56 lg:pb-12 lg:px-8 w-full max-w-7xl mx-auto flex flex-col">

        {/* ─── HEADER: Gradient Glow + Title ─── */}
        <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg px-4 pt-4 pb-3 md:px-5 md:pt-6 md:pb-4">
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
              onClick={() => navigate('/wishlist')}
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
          <div className="lg:flex lg:gap-8 lg:items-start lg:mt-6 w-full flex-1 min-w-0">
            {/* Left Column */}
            <div className="lg:flex-1 min-w-0">
              {/* ─── RENTAL ITEMS ─── */}
              <section className="px-5 lg:px-0 space-y-4">
                <AnimatePresence>
                  {validCartEntries.map(([key, data], i) => {
                    const bgColors = ['#1A1A1E', '#1C1C20', '#181820'];
                    return renderCartItem(key, data, bgColors[i % bgColors.length]);
                  })}
                </AnimatePresence>
              </section>

              {/* ─── ADD-ONS ─── */}
              {addOnProducts.length > 0 && (
                <AddOnsCarousel
                  addOnProducts={addOnProducts}
                  primaryRentalDays={primaryRentalDays}
                  addToCart={addToCart}
                />
              )}
            </div>

            {/* Right Column */}
            <div className="lg:w-[340px] lg:flex-shrink-0 lg:sticky lg:top-32 mt-12 lg:mt-0 flex flex-col gap-8">
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
                      ₹ {originalTotal}
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
                <button
                  onClick={canCheckout ? handleCheckout : undefined}
                  disabled={!canCheckout}
                  className={cn(
                    "w-full h-14 flex items-center justify-center rounded-2xl font-bold text-lg text-white tracking-tight transition-colors",
                    canCheckout ? "bg-[#f2546d] hover:bg-[#e04860] shadow-xl shadow-[#f2546d]/20" : "bg-white/10 text-white/40 cursor-not-allowed"
                  )}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {!deliveryAddress ? "Select Address" : "Check Out"}
                </button>
              </div>

            </div>
          </div>
        )}
      </main>


      {/* ─── CHECKOUT FOOTER (Mobile only) ─── */}
      {validCartEntries.length > 0 && !loadingProducts && (
        <div className="bg-[#232323] rounded-t-[20px] px-5 py-6 space-y-4 lg:hidden">
          {/* Checkout CTA */}
          <button
            onClick={handleCheckout}
            className="w-full h-14 flex items-center justify-center bg-[#E95466] rounded-full font-black text-lg text-white shadow-lg shadow-[#E95466]/20 active:scale-[0.98] transition-all"
          >
            Check Out
          </button>
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
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all ${isSelected
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
      {/* ─── INFO TOOLTIP (global, always in-bounds) ─── */}
      {activeInfoTooltip && (() => {
        const entry = validCartEntries.find(([k]) => k === activeInfoTooltip);
        const days = entry ? planDays(entry[1].plan) : 1;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setActiveInfoTooltip(null)} />
            <div
              className="fixed z-50 w-[200px] bg-[#2a2a2e] border border-white/10 rounded-xl px-3 py-2.5 shadow-xl"
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-white/80 leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <span className="text-white font-bold">{days} {days === 1 ? 'day' : 'days'}</span> will be counted from the time your order is delivered.
                </p>
                <button onClick={() => setActiveInfoTooltip(null)} className="text-white/30 hover:text-white/60 flex-shrink-0 mt-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        );
      })()}

      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
      <CheckoutBlockedModal open={checkoutBlocked} onClose={() => setCheckoutBlocked(false)} />
      <CitySelectorModal open={citySelectorOpen} onClose={() => setCitySelectorOpen(false)} />
    </MobileShell>
  );
};

export default CartPage;
