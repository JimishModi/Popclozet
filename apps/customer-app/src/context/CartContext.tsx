import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { toast } from "sonner";
import {
  addToCartDB,
  removeFromCartDB,
  updateCartQuantityDB,
  getCartItemsDB,
  migrateAnonymousCartDB,
} from "@/lib/db";
import { supabase } from "@popclozet/api-client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuth } from "@/context/SupabaseAuthContext";

/* ----------------------------- */
/* Cart Context Types            */
/* ----------------------------- */

export type PricingPlan = '1d' | '2d' | '3d' | 'buy';

interface CartItemData {
  quantity: number;
  size: string;
  plan: PricingPlan;
}

interface CartContextType {
  cartItems: Record<string, CartItemData>;
  cartLockedPlan: PricingPlan | null;
  addToCart: (productId: string, size: string, plan: PricingPlan) => void;
  removeFromCart: (productId: string, size: string, plan: PricingPlan) => void;
  updateQuantity: (productId: string, size: string, plan: PricingPlan, quantity: number) => void;
  updatePlan: (productId: string, size: string, oldPlan: PricingPlan, newPlan: PricingPlan) => void;
  updateSize: (productId: string, oldSize: string, newSize: string, plan: PricingPlan) => void;
  getItemQuantity: (productId: string, size: string, plan: PricingPlan) => number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

/* ----------------------------- */
/* Cart Provider                 */
/* ----------------------------- */

export const CartProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [cartItems, setCartItems] = useState<Record<string, CartItemData>>(
    {}
  );
  const [announcement, setAnnouncement] = useState("");
  const isOnline = useOnlineStatus();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  /* Load cart from IndexedDB — re-runs whenever the logged-in user changes */
  useEffect(() => {
    // Reset immediately so the previous user's data isn't visible
    setCartItems({});

    async function init() {
      if (userId) {
        try {
          await migrateAnonymousCartDB(userId);
        } catch (e) {
          console.error("Cart migration failed:", e);
        }
      }
      await loadCartFromDB();
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const VALID_PLANS: PricingPlan[] = ['1d', '2d', '3d', 'buy'];

  const isValidCartItem = (item: any) => {
    if (!item.size || item.size === 'NaN' || item.size === 'undefined') return false;
    if (!VALID_PLANS.includes(item.plan as PricingPlan)) return false;
    if (!item.productId || item.productId === 'NaN' || item.productId === 'undefined') return false;
    return true;
  };

  const loadCartFromDB = async () => {
    try {
      const items = await getCartItemsDB(userId);
      const cartMap: Record<string, CartItemData> = {};
      const invalidItems: typeof items = [];

      items.forEach((item) => {
        if (!isValidCartItem(item)) {
          invalidItems.push(item);
          return;
        }
        const key = `${item.productId}_${item.size}_${item.plan}`;
        cartMap[key] = {
          quantity: item.quantity,
          size: item.size,
          plan: item.plan as PricingPlan
        };
      });

      // Purge corrupted entries from IDB silently
      invalidItems.forEach((item) => {
        removeFromCartDB(item.productId, item.size, item.plan, userId).catch(() => { });
      });

      // Purge stale product IDs that no longer exist in the products table.
      // This cleans up fake/deleted product IDs that bypass the addToCart guard.
      const uniqueProductIds = Array.from(new Set(items.map(i => i.productId).filter(Boolean)));
      if (uniqueProductIds.length > 0) {
        const { data: validProducts } = await supabase
          .from('products')
          .select('id')
          .in('id', uniqueProductIds);

        const validIds = new Set((validProducts || []).map((p: any) => p.id));
        items.forEach((item) => {
          if (item.productId && !validIds.has(item.productId)) {
            // Stale / non-existent product — remove from IDB silently
            removeFromCartDB(item.productId, item.size, item.plan, userId).catch(() => { });
            delete cartMap[`${item.productId}_${item.size}_${item.plan}`];
          }
        });
      }

      setCartItems(cartMap);
    } catch (error) {
      console.error("IndexedDB load failed:", error);
      // Fallback: avoid leaking another user's localStorage key
      const key = userId ? `cart_${userId}` : "cart";
      try {
        const savedCart = localStorage.getItem(key);
        if (savedCart) {
          setCartItems(JSON.parse(savedCart));
        }
      } catch (err) {
        console.warn('localStorage access failed in fallback:', err);
      }
    }
  };

  /* ----------------------------- */
  /* Add to Cart                   */
  /* ----------------------------- */

  const addingRef = React.useRef(false);

  const addToCart = async (productId: string, size: string, plan: PricingPlan) => {
    // Prevent double-tap / rapid clicks from adding duplicate quantities
    if (addingRef.current) return;
    addingRef.current = true;

    try {
      // Prevent mixing buy and rent items in the same cart
      const existingPlans = Object.values(cartItems).map(item => item.plan);
      if (existingPlans.length > 0) {
        const hasBuy = existingPlans.some(p => p === 'buy');
        const hasRent = existingPlans.some(p => p !== 'buy');
        if ((plan === 'buy' && hasRent) || (plan !== 'buy' && hasBuy)) {
          toast.error("You can't mix buy and rent items in the same cart. Please checkout first or clear your cart.");
          return;
        }
      }

      // Validate that the product actually exists and check stock
      const { data: productCheck, error: checkError } = await supabase
        .from('products')
        .select('id, total_stock')
        .eq('id', productId)
        .maybeSingle();

      if (checkError || !productCheck) {
        toast.error("This item is no longer available.");
        return;
      }

      // Check stock — sum up all cart quantities for this product (any size/plan)
      const currentQtyInCart = Object.entries(cartItems)
        .filter(([k]) => k.startsWith(`${productId}_`))
        .reduce((sum, [, item]) => sum + item.quantity, 0);

      if (productCheck.total_stock != null && currentQtyInCart >= productCheck.total_stock) {
        toast.error("Sorry, no more stock available for this item.");
        return;
      }

      // Prevent adding multiple different plans for the same product+size
      // If found, update the plan of the existing item instead of creating a new entry.
      const existingKey = Object.keys(cartItems).find(
        (k) => k.startsWith(`${productId}_${size}_`) && k !== `${productId}_${size}_${plan}`
      );

      if (existingKey) {
        const oldPlan = cartItems[existingKey].plan;
        await updatePlan(productId, size, oldPlan, plan);
        return;
      }
      await addToCartDB(productId, size, plan, 1, userId);
      const key = `${productId}_${size}_${plan}`;

      setCartItems((prev) => {
        const existing = prev[key];
        const newQty = (existing?.quantity || 0) + 1;
        const next = {
          ...prev,
          [key]: { quantity: newQty, size, plan }
        };

        setAnnouncement(
          `Item added. Total items: ${Object.values(next).reduce((a, b) => a + b.quantity, 0)}`
        );
        return next;
      });

      toast.success("Added to cart", {
        description: `Item added to your shopping bag (${plan} plan)`,
        duration: 2000,
      });
    } catch (error) {
      console.error("Add to cart failed:", error);
      toast.error("Failed to add item");
    } finally {
      addingRef.current = false;
    }
  };

  /* ----------------------------- */

  const removeFromCart = async (productId: string, size: string, plan: PricingPlan) => {
    const key = `${productId}_${size}_${plan}`;

    // Optimistic update — remove from UI immediately regardless of DB result
    setCartItems((prev) => {
      const next = { ...prev };
      delete next[key];
      setAnnouncement("Item removed from cart.");
      return next;
    });

    try {
      await removeFromCartDB(productId, size, plan, userId);
    } catch (error) {
      console.error("Remove failed:", error);
    }
  };

  const updateQuantity = async (
    productId: string,
    size: string,
    plan: PricingPlan,
    quantity: number
  ) => {
    if (quantity <= 0) {
      await removeFromCart(productId, size, plan);
      return;
    }

    try {
      // Check stock before allowing quantity increase
      const key = `${productId}_${size}_${plan}`;
      const currentQty = cartItems[key]?.quantity || 0;

      if (quantity > currentQty) {
        const { data: product } = await supabase
          .from('products')
          .select('total_stock')
          .eq('id', productId)
          .maybeSingle();

        if (product?.total_stock != null) {
          // Total quantity across all sizes/plans for this product
          const otherQty = Object.entries(cartItems)
            .filter(([k]) => k.startsWith(`${productId}_`) && k !== key)
            .reduce((sum, [, item]) => sum + item.quantity, 0);

          if (otherQty + quantity > product.total_stock) {
            toast.error("Sorry, no more stock available for this item.");
            return;
          }
        }
      }

      await updateCartQuantityDB(productId, size, plan, quantity, userId);
      setCartItems((prev) => {
        setAnnouncement(`Quantity updated to ${quantity}`);
        return {
          ...prev,
          [key]: { ...prev[key], quantity }
        };
      });
    } catch (error) {
      console.error("Update quantity failed:", error);
      toast.error("Failed to update quantity");
    }
  };

  const updatePlan = async (productId: string, size: string, oldPlan: PricingPlan, newPlan: PricingPlan) => {
    if (oldPlan === newPlan) return;
    const oldKey = `${productId}_${size}_${oldPlan}`;
    const newKey = `${productId}_${size}_${newPlan}`;

    try {
      const quantity = cartItems[oldKey]?.quantity || 1;
      await removeFromCartDB(productId, size, oldPlan, userId);
      await addToCartDB(productId, size, newPlan, quantity, userId);

      setCartItems((prev) => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = { quantity, size, plan: newPlan };
        return next;
      });
      toast.success(`Plan updated to ${newPlan}`);
    } catch (error) {
      console.error("Update plan failed:", error);
      toast.error("Failed to update plan");
    }
  };

  const updateSize = async (productId: string, oldSize: string, newSize: string, plan: PricingPlan) => {
    if (oldSize === newSize) return;
    const oldKey = `${productId}_${oldSize}_${plan}`;
    const newKey = `${productId}_${newSize}_${plan}`;

    try {
      const quantity = cartItems[oldKey]?.quantity || 1;
      await removeFromCartDB(productId, oldSize, plan, userId);
      await addToCartDB(productId, newSize, plan, quantity, userId);

      setCartItems((prev) => {
        const next = { ...prev };
        delete next[oldKey];
        next[newKey] = { quantity, size: newSize, plan };
        return next;
      });
      toast.success(`Size updated to ${newSize}`);
    } catch (error) {
      console.error("Update size failed:", error);
      toast.error("Failed to update size");
    }
  };

  const getItemQuantity = (productId: string, size: string, plan: PricingPlan) =>
    cartItems[`${productId}_${size}_${plan}`]?.quantity || 0;

  const totalItems = Object.values(cartItems).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // The plan that all cart items are locked to — minimum plan across all items.
  // null when cart is empty, so the product page allows free selection.
  const PLAN_ORDER: PricingPlan[] = ['1d', '2d', '3d', 'buy'];
  const cartLockedPlan = useMemo<PricingPlan | null>(() => {
    const plans = Object.values(cartItems).map(i => i.plan);
    if (plans.length === 0) return null;
    return plans.reduce((min, p) =>
      PLAN_ORDER.indexOf(p) < PLAN_ORDER.indexOf(min) ? p : min
    );
  }, [cartItems]);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartLockedPlan,
        addToCart,
        removeFromCart,
        updateQuantity,
        updatePlan,
        updateSize,
        getItemQuantity,
        totalItems,
      }}
    >
      {children}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </CartContext.Provider>
  );
};

/* ----------------------------- */
/* Hook                          */
/* ----------------------------- */

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
};
