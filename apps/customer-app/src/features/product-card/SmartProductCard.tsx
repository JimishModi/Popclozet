import React, { useRef, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHoverVideo } from "./useHoverVideo";
import QuickViewModal, { Product } from "./QuickViewModal";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import InstantAddButton from "@/components/ui/InstantAddButton";

interface SmartProductCardProps {
  product: Product;
  className?: string;
}

const BASE = import.meta.env.BASE_URL ?? "/";
const PLACEHOLDER = "/products/placeholder.jpg"; // ensure this file exists in public/products

const normalizeSrc = (src?: string) => {
  if (!src) return `${BASE}${PLACEHOLDER.replace(/^\//, "")}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${BASE}${src.replace(/^\/+/, "")}`;
};

const SmartProductCard = ({ product, className }: SmartProductCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCart, removeFromCart, updateQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id);

  const { isPlaying, eventHandlers } = useHoverVideo({
    videoRef,
    hoverDelay: 200,
    longPressDelay: 500,
  });

  // normalized product image for robust loading
  const imgSrc = normalizeSrc(product.image);
  const videoSrc = product.videoUrl ? normalizeSrc(product.videoUrl) : undefined;

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl bg-card border border-border transition-all hover:shadow-lg touch-manipulation",
          className
        )}
        {...eventHandlers}
      >
        {/* Image/Video Container */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {/* Static Image */}
          <img
            src={imgSrc}
            alt={product.name}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              isPlaying ? "opacity-0" : "opacity-100"
            )}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.onerror = null;
              img.src = normalizeSrc(PLACEHOLDER);
            }}
          />

          {/* Video Layer */}
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                isPlaying ? "opacity-100" : "opacity-0"
              )}
              muted
              loop
              playsInline
              preload="none"
              onError={(e) => {
                // if video fails, we simply keep the image visible
                console.warn("Hover video failed to load:", videoSrc);
              }}
            />
          ) : null}

          {/* Overlay Actions (Desktop Hover / Focus) */}
          <div className="absolute inset-0 flex flex-col items-center justify-end p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-t from-black/60 via-transparent to-transparent">
            <div className="flex flex-col gap-2 w-full items-center translate-y-4 transition-transform duration-300 group-hover:translate-y-0">
              <Button
                onClick={() => setIsModalOpen(true)}
                className="w-full shadow-button bg-white/90 text-black hover:bg-white"
                size="sm"
              >
                <Eye className="mr-2 h-4 w-4" /> Quick View
              </Button>

              <InstantAddButton
                quantity={quantity}
                onAdd={() => addToCart(product.id)}
                onIncrement={() => updateQuantity(product.id, quantity + 1)}
                onDecrement={() => updateQuantity(product.id, quantity - 1)}
                className="w-full shadow-button"
                productImage={imgSrc}
              />
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-headline truncate">{product.name}</h3>
        </div>
      </div>

      <QuickViewModal product={product} isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
};

export default SmartProductCard;
