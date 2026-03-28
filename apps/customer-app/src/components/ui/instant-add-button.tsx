// src/components/ui/instant-add-button.tsx
import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Plus, Minus } from "lucide-react";
import { useCart, PricingPlan } from "@/context/CartContext";
import { useFlyToCart } from "@/context/FlyToCartContext";

interface InstantAddButtonProps {
  productId: string;
  imageSrc?: string;
  onAdd?: (productId: string) => void;
  onChange?: (productId: string, quantity: number) => void;
  quantity?: number;
  onIncrement?: (productId: string) => void;
  onDecrement?: (productId: string) => void;
  className?: string;
  disabled?: boolean;
  showLabel?: boolean;
  size?: string;
  plan?: PricingPlan;
  productImage?: string; // added for fly animation compatibility with card
}

const InstantAddButton: React.FC<InstantAddButtonProps> = ({
  productId,
  imageSrc,
  onAdd,
  onChange,
  quantity: quantityProp,
  onIncrement,
  onDecrement,
  className = "",
  disabled = false,
  showLabel = false,
  size = "S",
  plan = "1d",
  productImage,
}) => {
  const { getItemQuantity, addToCart, updateQuantity } = useCart();
  const { triggerFlyAnimation } = useFlyToCart();
  const btnRef = useRef<HTMLSpanElement | null>(null);

  const contextQuantity = getItemQuantity ? getItemQuantity(productId, size, plan) : 0;
  const quantity = typeof quantityProp === "number" ? quantityProp : contextQuantity;
  const currentImage = productImage || imageSrc;

  const handleAdd = () => {
    if (disabled) return;
    if (onAdd) {
      onAdd(productId);
    } else if (addToCart) {
      addToCart(productId, size, plan);
    }

    const nextQty = (quantity || 0) + 1;
    onChange?.(productId, nextQty);

    if (btnRef.current && currentImage && triggerFlyAnimation) {
      const rect = (btnRef.current as Element).getBoundingClientRect();
      triggerFlyAnimation(currentImage, rect);
    }

    onIncrement?.(productId);
  };

  const handleChange = (nextQty: number) => {
    if (disabled) return;

    if (nextQty > quantity) {
      onIncrement?.(productId);
    } else if (nextQty < quantity) {
      onDecrement?.(productId);
    }

    onChange?.(productId, nextQty);

    if (updateQuantity) {
      updateQuantity(productId, size, plan, nextQty);
    }
  };

  // Use <span> as the root so this component is safe inside <p> or inline contexts
  return (
    <span
      ref={btnRef}
      className={`relative inline-block h-9 ${className}`}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {quantity === 0 ? (
          <motion.button
            key="add"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd();
            }}
            disabled={disabled}
            className={`inline-flex items-center gap-2 px-3 py-1.5 font-semibold rounded-full shadow-md active:scale-95 transition ${
              showLabel
                ? "bg-primary text-primary-foreground text-xs"
                : "bg-white/90 text-foreground text-sm p-2"
            }`}
            aria-label="Add to cart"
            title="Add"
          >
            <ShoppingBag className={`w-4 h-4 ${showLabel ? "" : "text-primary"}`} />
            {showLabel ? <span className="text-xs">Rent Now</span> : null}
          </motion.button>
        ) : (
          <motion.div
            key="controls"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            className={`inline-flex items-center justify-between rounded-full px-1 shadow-lg ${showLabel ? "bg-primary text-primary-foreground" : "bg-white/90 text-foreground"}`}
            role="group"
            aria-label="Quantity controls"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = Math.max(0, (quantity || 0) - 1);
                handleChange(next);
              }}
              className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>

            <motion.span
              key={quantity}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="font-bold text-sm w-6 text-center"
              aria-live="polite"
            >
              {quantity}
            </motion.span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = (quantity || 0) + 1;
                handleChange(next);
              }}
              className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

export default InstantAddButton;
