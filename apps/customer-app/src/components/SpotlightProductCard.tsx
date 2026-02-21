// src/components/SpotlightProductCard.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Star } from "lucide-react";
import InstantAddButton from "@/components/ui/instant-add-button";
import { Product } from "@/config/products";
import { formatPrice } from "@/utils/format";
import SignupModal from "@/components/SignupModal";

interface SpotlightProductCardProps {
  product: Product;
  index: number;
}

const gradients = [
  "linear-gradient(145deg, #a855f7, #0f172a)",
  "linear-gradient(165deg, #06b6d4, #0b1221)",
  "linear-gradient(195deg, #f59e0b, #0f172a)",
  "linear-gradient(210deg, #ef4444, #0b1221)",
  "linear-gradient(135deg, #10b981, #0c1325)",
  "linear-gradient(225deg, #8b5cf6, #0b1221)"
];

const borderColors = ["#a855f7", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

export const SpotlightProductCard: React.FC<SpotlightProductCardProps> = ({ product, index }) => {
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const originalPrice = (product as any).mrp ?? Math.ceil(product.price * 1.5);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="group relative overflow-hidden rounded-2xl"
        style={{
          background: gradients[index % gradients.length],
          boxShadow: `0 0 20px ${borderColors[index % borderColors.length]}40`
        }}
      >
        <div className="aspect-[3/4] overflow-hidden relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          <motion.button
            aria-label="Join waitlist for this item"
            onClick={() => setIsSignupOpen(true)}
            className="absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors z-10 bg-primary/80 text-white hover:bg-primary"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-4 h-4" />
          </motion.button>

          <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
            {product.category}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 text-white bg-gradient-to-t from-black via-black/90 to-transparent">
          <h3 className="font-bold text-lg mb-1 truncate drop-shadow-lg" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>{product.name}</h3>

          {/* Show only struck MRP   removed green current price */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(originalPrice)}
            </span>
            <span className="text-xs text-muted-foreground">/day</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="font-medium">{product.rating}</span>
            </div>
            <InstantAddButton productId={product.id} imageSrc={product.image} />
          </div>
        </div>
      </motion.div>
      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </>
  );
};

export default SpotlightProductCard;
