// src/components/QuickViewModal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import InstantAddButton from "@/components/ui/InstantAddButton";
import DeliveryStatusTile from "@/components/ui/DeliveryStatusTile";

export interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  videoUrl?: string;
  description?: string;
}

interface QuickViewModalProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER = "/products/placeholder.jpg"; // ensure this file exists in public/products
const BASE = import.meta.env.BASE_URL ?? "/";

const normalizeSrc = (src: string) => {
  // Ensure we return an absolute path that respects BASE and strips accidental leading slashes
  if (!src) return `${BASE}${PLACEHOLDER.replace(/^\//, "")}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  // remove any leading slashes then prefix with BASE
  return `${BASE}${src.replace(/^\/+/, "")}`;
};

const QuickViewModal = ({ product, isOpen, onOpenChange }: QuickViewModalProps) => {
  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id);

  // Debug log so you can see the exact image path the component is trying to load
  // (Remove or comment out this line in production if desired)
  console.debug("[QuickViewModal] product.image:", product.id, product.image, "->", normalizeSrc(product.image));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden gap-0">
        <div className="grid md:grid-cols-2 h-full">
          {/* Product Image/Video Side */}
          <div className="relative h-[300px] md:h-[500px] bg-muted">
            <img
              src={normalizeSrc(product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
              // keep layout stable by providing width/height attributes if you can
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                // prevent loop in case placeholder missing
                img.onerror = null;
                img.src = normalizeSrc(PLACEHOLDER);
              }}
            />

            <div className="absolute top-2 right-2 md:hidden">
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="bg-white/50 hover:bg-white/80 rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>

          {/* Product Details Side */}
          <div className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div>
              <DialogHeader className="mb-4 text-left">
                <DialogTitle className="text-2xl md:text-3xl font-bold mb-2">{product.name}</DialogTitle>
                <DialogDescription className="text-lg font-medium text-primary">{product.price}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-muted-foreground text-sm md:text-base">
                  {product.description ||
                    "Experience the perfect blend of style and comfort. This piece is curated for those who appreciate contemporary fashion with a sustainable twist."}
                </p>

                {/* Mock Size Selector */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Select Size</h4>
                  <div className="flex gap-2">
                    {["XS", "S", "M", "L", "XL"].map((size) => (
                      <Button
                        key={size}
                        variant="outline"
                        size="sm"
                        className="w-10 h-10 rounded-full hover:bg-primary hover:text-primary-foreground"
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <InstantAddButton
                quantity={quantity}
                onAdd={() => addToCart(product.id)}
                onIncrement={() => updateQuantity(product.id, quantity + 1)}
                onDecrement={() => updateQuantity(product.id, quantity - 1)}
                className="w-full text-lg h-12"
                productImage={normalizeSrc(product.image)}
              />
              <DeliveryStatusTile />
              <p className="text-xs text-center text-muted-foreground">Free delivery within 60 mins</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickViewModal;
