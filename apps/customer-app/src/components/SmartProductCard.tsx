// src/components/SmartProductCard.tsx
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Play } from "lucide-react";
import { useHoverVideo } from "@/hooks/useHoverVideo";
import InstantAddButton from "@/components/ui/instant-add-button";
import SignupModal from "@/components/SignupModal";
import { formatPrice } from "@/utils/format";
import { Product } from "@/config/products";

interface SmartProductCardProps {
  product: Product;
}

export const SmartProductCard = ({ product }: SmartProductCardProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const { shouldLoad, shouldShow, bind } = useHoverVideo();

  return (
    <>
      <motion.div
        ref={containerRef}
        className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg transition-all"
        whileHover={{ y: -4 }}
        {...bind}
      >
        <div className="relative aspect-square md:aspect-[3/4] overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          {product.video && shouldLoad && (
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${shouldShow ? "opacity-100" : "opacity-0"}`}
              muted
              loop
              playsInline
              preload="none"
              onCanPlay={() => videoRef.current?.play().catch(() => null)}
              onLoadedData={() => videoRef.current?.play().catch(() => null)}
            >
              <source src={product.video} type="video/mp4" />
            </video>
          )}

          {product.video && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur flex items-center gap-1">
              <Play className="w-3 h-3" />
              Hover/long-press to preview
            </div>
          )}

          <button
            aria-label="Join waitlist for this item"
            onClick={(e) => {
              e.stopPropagation();
              setIsSignupOpen(true);
            }}
            className="absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors bg-primary/80 text-white hover:bg-primary"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
            {product.category}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-lg truncate">{product.name}</h3>
          </div>

          {/* FIXED: used div instead of p to avoid nesting <div> inside <p> */}
          <div className="text-sm text-muted-foreground flex justify-between items-center">
            <div className="flex-1">
              {/* you can show price here or other meta */}
              <div className="flex flex-col">
                {product.discounted_price && product.discounted_price < product.price ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-primary">{formatPrice(product.discounted_price)}</span>
                      <span className="text-[10px] text-muted-foreground line-through opacity-70">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    {product.discount_type === 'percentage' && (
                      <span className="text-[10px] font-bold text-primary italic">Save {product.discount_value}%</span>
                    )}
                  </>
                ) : (
                  <div className="text-sm font-semibold">₹ { (product as any).rental_price_1d ?? product.price }</div>
                )}
              </div>
            </div>

            <div className="ml-4">
              <InstantAddButton productId={product.id} imageSrc={product.image} />
            </div>
          </div>
        </div>
      </motion.div>
      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </>
  );
};

export default SmartProductCard;
