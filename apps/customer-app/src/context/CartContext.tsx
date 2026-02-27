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
  addToOfflineQueueDB,
} from "@/lib/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/* ----------------------------- */
/* Cart Context Types            */
/* ----------------------------- */

interface CartContextType {
  cartItems: Record<string, number>;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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

  /* Load cart from IndexedDB */
  useEffect(() => {
    loadCartFromDB();
  }, []);

  const loadCartFromDB = async () => {
    try {
      const items = await getCartItemsDB();
      const cartMap: Record<string, number> = {};
      items.forEach((item) => {
        cartMap[item.productId] = item.quantity;
      });
      setCartItems(cartMap);
    } catch (error) {
      console.error("IndexedDB load failed:", error);
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    }
  };

  /* ----------------------------- */
  /* Add to Cart (NO GEOFENCE)     */
  /* ----------------------------- */

  const addToCart = async (productId: string) => {
    try {
      await addToCartDB(productId, 1);

      if (!isOnline) {
        await addToOfflineQueueDB("add_to_cart", {
          productId,
          quantity: 1,
        });
      }

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
        description: isOnline
          ? "Item added to your shopping bag"
          : "Saved offline – will sync when online",
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
      await removeFromCartDB(productId);

      if (!isOnline) {
        await addToOfflineQueueDB("remove_from_cart", {
          productId,
        });
      }

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
      await updateCartQuantityDB(productId, quantity);
      setCartItems((prev) => {
        setAnnouncement(`Quantity updated to ${quantity}`);
        return { ...prev, [productId]: quantity };
      });
    } catch (error) {
      console.error("Update quantity failed:", error);
      toast.error("Failed to update quantity");
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
