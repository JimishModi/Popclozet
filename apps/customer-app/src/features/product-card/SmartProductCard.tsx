import React, { useRef, useState } from "react";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHoverVideo } from "./useHoverVideo";
import QuickViewModal, { Product } from "./QuickViewModal";
import { cn } from "@/lib/utils";
import { useCart, PricingPlan } from "@/context/CartContext";
import InstantAddButton from "@/components/ui/InstantAddButton";
import { thumbImage, markImageLoaded, isImageLoaded } from "@/lib/optimizeImage";

interface SmartProductCardProps {
  product: Product;
  className?: string;
  /** When true, renders the card as "Currently Rented" — dull image, no cart button. */
  isFake?: boolean;
}

const BASE = import.meta.env.BASE_URL ?? "/";
const PLACEHOLDER = "/products/placeholder.jpg"; // ensure this file exists in public/products

const normalizeSrc = (src?: string) => {
  if (!src) return `${BASE}${PLACEHOLDER.replace(/^\//, "")}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${BASE}${src.replace(/^\/+/, "")}`;
};

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const PLANS: { value: PricingPlan; label: string }[] = [
  { value: "1d", label: "1 Day" },
  { value: "2d", label: "2 Days" },
  { value: "3d", label: "3 Days" },
  { value: "buy", label: "Buy" },
];

const SmartProductCard = ({ product, className, isFake = false }: SmartProductCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedSize, setSelectedSize] = useState("S");
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>("1d");
  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id, selectedSize, selectedPlan);
  const maxQty = product.stockQuantity ?? Infinity;
  const isAtMax = quantity >= maxQty;

  const { isPlaying, eventHandlers } = useHoverVideo({
    videoRef,
    hoverDelay: 200,
    longPressDelay: 500,
  });

  const isRentedOut = (product as any).isRentedOut === true;
  const isSoldOut = (product as any).isSoldOut === true;
  const isUnavailable = isFake || isRentedOut || isSoldOut;

  const rawImg = normalizeSrc(product.image);
  const imgSrc = thumbImage(rawImg);
  const alreadyCached = isImageLoaded(imgSrc);
  const videoSrc = product.videoUrl ? normalizeSrc(product.videoUrl) : undefined;

  const handleConfirmAdd = () => {
    if (isAtMax) return;
    addToCart(product.id, selectedSize, selectedPlan);
    setShowPicker(false);
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl bg-card border border-border transition-all hover:shadow-lg touch-manipulation",
          isUnavailable && "opacity-80",
          className
        )}
        {...eventHandlers}
      >
        {/* Image/Video Container */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {/* Shimmer skeleton — hidden if image already cached */}
          {!alreadyCached && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-y-0 w-1/2 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>
          )}
          {/* Static Image — grayscale + dimmed when unavailable */}
          <img
            src={imgSrc}
            alt={product.name}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              alreadyCached
                ? (isPlaying ? "opacity-0" : "opacity-100")
                : cn(
                    "transition-opacity duration-300 opacity-0",
                    isPlaying
                      ? "data-[loaded]:opacity-0"
                      : "data-[loaded]:opacity-100"
                  )
            )}
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              e.currentTarget.dataset.loaded = "1";
              markImageLoaded(imgSrc);
            }}
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
              onError={() => {
                console.warn("Hover video failed to load:", videoSrc);
              }}
            />
          ) : null}

          {/* Status badge — for fake products, rented out, or sold out */}
          {isUnavailable && (
            <div className="absolute top-2 right-2 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/10 shadow-xl">
                <span className={cn("h-1.5 w-1.5 rounded-full", isFake ? "bg-blue-400" : isSoldOut ? "bg-zinc-400" : "bg-red-400")} />
                {isFake ? "Coming Soon" : isSoldOut ? "Sold" : "Rented Out"}
              </span>
            </div>
          )}

          {/* Size + Duration Picker Overlay — shown when Add is clicked on real products */}
          {showPicker && (
            <div className="absolute inset-0 z-20 flex flex-col bg-black/85 backdrop-blur-sm p-4 gap-3">
              <div className="flex justify-between items-center">
                <span className="text-white text-sm font-semibold">Pick Size & Duration</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowPicker(false); }}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Size Picker */}
              <div>
                <p className="text-white/50 text-xs mb-2">Size</p>
                <div className="flex flex-wrap gap-1.5">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                        selectedSize === s
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-white/80 border-white/30 hover:border-white/70"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Picker */}
              <div>
                <p className="text-white/50 text-xs mb-2">Duration</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLANS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setSelectedPlan(p.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                        selectedPlan === p.value
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-white/80 border-white/30 hover:border-white/70"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                size="sm"
                className="w-full mt-auto"
                disabled={isAtMax}
                onClick={(e) => { e.stopPropagation(); handleConfirmAdd(); }}
              >
                {isAtMax ? "Out of Stock" : "Add to Cart"}
              </Button>
            </div>
          )}

          {/* Overlay Actions (Desktop Hover / Focus) */}
          {!showPicker && (
            <div className="absolute inset-0 flex flex-col items-center justify-end p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <div className="flex flex-col gap-2 w-full items-center translate-y-4 transition-transform duration-300 group-hover:translate-y-0">
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full shadow-button bg-white/90 text-black hover:bg-white"
                  size="sm"
                >
                  <Eye className="mr-2 h-4 w-4" /> Quick View
                </Button>

                {/* Cart button hidden for fake/rented-out/sold-out items */}
                {!isUnavailable && (
                  <InstantAddButton
                    quantity={quantity}
                    onAdd={() => { if (!isAtMax) setShowPicker(true); }}
                    onIncrement={() => { if (!isAtMax) updateQuantity(product.id, selectedSize, selectedPlan, quantity + 1); }}
                    onDecrement={() => updateQuantity(product.id, selectedSize, selectedPlan, quantity - 1)}
                    className="w-full shadow-button"
                    productImage={imgSrc}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className={cn("p-4 flex flex-col gap-1", isUnavailable && "opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-headline truncate">{product.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-headline">
              ₹ { (product as any).rental_price_1d ?? (product as any).rentalPrice ?? product.price }
            </span>
            <span className="text-[10px] text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">1 Day</span>
          </div>
        </div>
      </div>

      <QuickViewModal product={product} isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
};

export default SmartProductCard;
