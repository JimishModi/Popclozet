import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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
        removeFromCartDB(item.productId, item.size, item.plan, userId).catch(() => {});
      });

      setCartItems(cartMap);
    } catch (error) {
      console.error("IndexedDB load failed:", error);
      // Fallback: avoid leaking another user's localStorage key
      const key = userId ? `cart_${userId}` : "cart";
      const savedCart = localStorage.getItem(key);
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    }
  };

  /* ----------------------------- */
  /* Add to Cart                   */
  /* ----------------------------- */

  const addToCart = async (productId: string, size: string, plan: PricingPlan) => {
    try {
      // Prevent adding multiple different plans for the same product+size
      // If found, update the plan of the existing item instead of creating a new entry.
      const existingKey = Object.keys(cartItems).find(
        (k) => k.startsWith(`${productId}_${size}_`) && k !== `${productId}_${size}_${plan}`
      );

      if (existingKey) {
         const oldPlan = cartItems[existingKey].plan;
         await updatePlan(productId, size, oldPlan, plan);
         
         toast.success(`Updated to ${plan} rental plan`, {
           duration: 2000,
         });
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
      await updateCartQuantityDB(productId, size, plan, quantity, userId);
      const key = `${productId}_${size}_${plan}`;
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

  return (
    <CartContext.Provider
      value={{
        cartItems,
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
