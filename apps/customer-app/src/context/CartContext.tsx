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
} from "@/lib/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuth } from "@/context/SupabaseAuthContext";

/* ----------------------------- */
/* Cart Context Types            */
/* ----------------------------- */

interface CartContextType {
  cartItems: Record<string, number>;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateSize: (oldId: string, newSize: string) => void;
  getItemQuantity: (productId: string) => number;
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
  const [cartItems, setCartItems] = useState<Record<string, number>>(
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
    loadCartFromDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadCartFromDB = async () => {
    try {
      const items = await getCartItemsDB(userId);
      const cartMap: Record<string, number> = {};
      items.forEach((item) => {
        cartMap[item.productId] = item.quantity;
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

  const addToCart = async (productId: string) => {
    try {
      await addToCartDB(productId, 1, userId);

      setCartItems((prev) => {
        const newQty = (prev[productId] || 0) + 1;
        setAnnouncement(
          `Item added. Total items: ${Object.values({
            ...prev,
            [productId]: newQty,
          }).reduce((a, b) => a + b, 0)}`
        );
        return { ...prev, [productId]: newQty };
      });

      toast.success("Added to cart", {
        description: "Item added to your shopping bag",
        duration: 2000,
      });
    } catch (error) {
      console.error("Add to cart failed:", error);
      toast.error("Failed to add item");
    }
  };

  /* ----------------------------- */

  const removeFromCart = async (productId: string) => {
    try {
      await removeFromCartDB(productId, userId);

      setCartItems((prev) => {
        const next = { ...prev };
        delete next[productId];
        setAnnouncement("Item removed from cart.");
        return next;
      });
    } catch (error) {
      console.error("Remove failed:", error);
      toast.error("Failed to remove item");
    }
  };

  const updateQuantity = async (
    productId: string,
    quantity: number
  ) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    try {
      await updateCartQuantityDB(productId, quantity, userId);
      setCartItems((prev) => {
        setAnnouncement(`Quantity updated to ${quantity}`);
        return { ...prev, [productId]: quantity };
      });
    } catch (error) {
      console.error("Update quantity failed:", error);
      toast.error("Failed to update quantity");
    }
  };

  const updateSize = async (oldId: string, newSize: string) => {
    const [baseId] = oldId.split('_');
    const newId = `${baseId}_${newSize}`;

    if (oldId === newId) return;

    try {
      const quantity = cartItems[oldId] || 1;

      // Remove old item from DB
      await removeFromCartDB(oldId, userId);

      // Add or update new item in DB
      const existingQty = cartItems[newId] || 0;
      await updateCartQuantityDB(newId, existingQty + quantity, userId);

      setCartItems((prev) => {
        const next = { ...prev };
        delete next[oldId];
        next[newId] = (next[newId] || 0) + quantity;
        setAnnouncement(`Size updated to ${newSize}`);
        return next;
      });

      toast.success(`Size updated to ${newSize}`);
    } catch (error) {
      console.error("Update size failed:", error);
      toast.error("Failed to update size");
    }
  };

  const getItemQuantity = (productId: string) =>
    cartItems[productId] || 0;

  const totalItems = Object.values(cartItems).reduce(
    (sum, qty) => sum + qty,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
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
