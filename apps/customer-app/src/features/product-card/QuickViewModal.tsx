// src/components/QuickViewModal.tsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag, X, Star } from "lucide-react";
import { useCart, PricingPlan } from "@/context/CartContext";
import InstantAddButton from "@/components/ui/InstantAddButton";
import DeliveryStatusTile from "@/components/ui/DeliveryStatusTile";
import { supabase } from "@popclozet/api-client";
import { cn } from "@/lib/utils";

export interface Product {
  id: string;
  name: string;
  price: string | number;
  image: string;
  videoUrl?: string;
  description?: string;
  stockQuantity?: number;
  rental_price_1d?: string | number;
  rentalPrice?: number | string;
  buy_price?: number | string;
  isRentedOut?: boolean;
  isSoldOut?: boolean;
}

interface InventoryRow {
  size: string;
  available_stock: number;
  total_stock: number;
}

interface QuickViewModalProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER = "/products/placeholder.jpg";
const BASE = import.meta.env.BASE_URL ?? "/";

const normalizeSrc = (src: string) => {
  if (!src) return `${BASE}${PLACEHOLDER.replace(/^\//, "")}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${BASE}${src.replace(/^\/+/, "")}`;
};

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const QuickViewModal = ({ product, isOpen, onOpenChange }: QuickViewModalProps) => {
  const { addToCart, updateQuantity, getItemQuantity, cartItems } = useCart();
  const [selectedSize, setSelectedSize] = useState<string>("S");
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>("1d");
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [hasInventoryLoaded, setHasInventoryLoaded] = useState(false);

  const cartKey = `${product.id}_${selectedSize}_${selectedPlan}`;
  const quantity = getItemQuantity(product.id, selectedSize, selectedPlan);
  const isAdded = !!cartItems[cartKey];

  useEffect(() => {
    if (isOpen && product.id) {
      fetchInventory();
    }
  }, [isOpen, product.id]);

  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    setHasInventoryLoaded(false);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('size, available_stock, total_stock')
        .eq('product_id', product.id)
        .order('size');
      
      if (!error && data) {
        setInventory(data);
        const rowS = data.find(r => r.size === 'S');
        if (!rowS || rowS.available_stock <= 0) {
          const firstAvailable = data.find(r => r.available_stock > 0);
          if (firstAvailable) setSelectedSize(firstAvailable.size);
        }
      }
    } catch (err) {
      console.error("Failed to fetch inventory for modal:", err);
    } finally {
      setHasInventoryLoaded(true);
      setIsLoadingInventory(false);
    }
  };

  const totalStock = inventory.reduce((acc, r) => acc + (r.total_stock || 0), 0);
  const totalAvailable = inventory.reduce((acc, r) => acc + (r.available_stock || 0), 0);
  
  const isActuallySoldOut = hasInventoryLoaded && totalStock === 0;
  const isProductRentedOut = hasInventoryLoaded && totalStock > 0 && totalAvailable === 0;
  const isUnavailable = isActuallySoldOut || isProductRentedOut;

  const currentSizeRow = inventory.find(r => r.size === selectedSize);
  const isSelectedSizeOut = !currentSizeRow || currentSizeRow.available_stock <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden gap-0 bg-[#0A0A0A] border-white/5 text-white">
        <div className="grid md:grid-cols-2 h-full">
          <div className="relative h-[350px] md:h-[550px] bg-[#111]">
            <img
              src={normalizeSrc(product.image)}
              alt={product.name}
              className={cn(
                "w-full h-full object-cover transition-all duration-500",
                isUnavailable && "grayscale opacity-25"
              )}
              loading="lazy"
            />
            
            {isUnavailable && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="px-5 py-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isActuallySoldOut ? "bg-zinc-500" : "bg-red-500")} />
                    {isActuallySoldOut ? "Sold Out" : "Currently Rented Out"}
                  </span>
                </div>
              </div>
            )}

            <div className="absolute top-4 right-4 md:hidden">
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="bg-black/40 hover:bg-black/60 rounded-full text-white border border-white/10">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>

          <div className="p-6 md:p-10 flex flex-col h-full bg-gradient-to-b from-[#0A0A0A] to-black">
            <div className="flex-1">
              <DialogHeader className="mb-6 text-left">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <DialogTitle className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic overflow-hidden text-ellipsis line-clamp-1">
                    {product.name}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-[#f2546d]">₹ {product.rental_price_1d || product.price}</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className="w-3 h-3 fill-[#f2546d] text-[#f2546d]" />
                    ))}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-8">
                <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-medium">
                  {product.description ||
                    "Experience the perfect blend of style and comfort. This piece is curated for those who appreciate contemporary fashion with a sustainable twist."}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Select Size</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {SIZES.map((size) => {
                      const row = inventory.find(r => r.size === size);
                      const isOut = !row || row.available_stock <= 0;
                      const isSel = selectedSize === size;

                      return (
                        <div key={size} className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => setSelectedSize(size)}
                            className={cn(
                              "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 font-black",
                              isSel
                                ? "bg-[#f2546d] text-white shadow-lg shadow-[#f2546d]/20 scale-105"
                                : isOut
                                  ? "bg-white/5 text-zinc-700 border border-white/5 opacity-50"
                                  : "bg-white/5 text-zinc-400 border border-white/5 hover:border-[#f2546d]/30"
                            )}
                          >
                            <span className={isOut ? "line-through" : ""}>{size}</span>
                          </button>
                          {isOut && <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter -mt-1">Out</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <InstantAddButton
                quantity={quantity}
                onAdd={() => !isSelectedSizeOut && addToCart(product.id, selectedSize, selectedPlan)}
                onIncrement={() => !isSelectedSizeOut && updateQuantity(product.id, selectedSize, selectedPlan, quantity + 1)}
                onDecrement={() => !isSelectedSizeOut && updateQuantity(product.id, selectedSize, selectedPlan, quantity - 1)}
                className={cn(
                  "w-full text-lg h-14 rounded-2xl font-black italic tracking-tighter uppercase transition-all shadow-2xl",
                  isSelectedSizeOut && !isAdded ? "bg-zinc-900 border border-white/5 text-zinc-600 grayscale cursor-not-allowed opacity-50" : ""
                )}
                productImage={normalizeSrc(product.image)}
                disabled={isSelectedSizeOut && !isAdded}
                label={isAdded ? "Added to Cart" : isSelectedSizeOut ? "Out of Stock" : "Add to Cart"}
              />
              <DeliveryStatusTile className="bg-white/5 border-white/5 rounded-2xl p-4" />
              <p className="text-[10px] text-center font-bold uppercase tracking-[0.2em] text-zinc-500">
                ⚡ FAST DELIVERY WITHIN 60 MINS
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickViewModal;
