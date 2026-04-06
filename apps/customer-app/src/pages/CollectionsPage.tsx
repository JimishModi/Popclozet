import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ShoppingBag, Tag } from "lucide-react";
import { ClosetIcon } from "@/components/icons/ClosetIcon";
import { useNavigate } from "react-router-dom";
import { usePersistentGender } from "@/hooks/usePersistentGender";
import { useCart } from "@/context/CartContext";
import { productService } from "@/services/productService";
import type { GenderType } from "@/components/ui/GenderSelector";
import { GenderSelector } from "@/components/ui/GenderSelector";

/* ── Line-art SVG icons matching Figma ── */

const ShoesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Sneaker body */}
    <path d="M18 58h44c4 0 6-2 6-5v-4c0-3-2-5-5-5h-8l-4-8-6-12c-1-2-3-3-5-3h-4c-2 0-4 1-5 3L27 36l-4 8h-5c-3 0-5 2-5 5v4c0 3 2 5 6 5z" />
    {/* Tongue */}
    <path d="M36 24v-6c0-2 1-3 3-3h2c2 0 3 1 3 3v6" />
    {/* Lace holes */}
    <circle cx="35" cy="30" r="1.5" fill="currentColor" />
    <circle cx="45" cy="30" r="1.5" fill="currentColor" />
    <circle cx="34" cy="36" r="1.5" fill="currentColor" />
    <circle cx="46" cy="36" r="1.5" fill="currentColor" />
    {/* Laces */}
    <line x1="36.5" y1="30" x2="43.5" y2="30" />
    <line x1="35.5" y1="36" x2="44.5" y2="36" />
    {/* Sole line */}
    <path d="M14 53h52" />
    {/* Sole tread */}
    <line x1="22" y1="56" x2="22" y2="58" />
    <line x1="30" y1="56" x2="30" y2="58" />
    <line x1="38" y1="56" x2="38" y2="58" />
    <line x1="46" y1="56" x2="46" y2="58" />
    <line x1="54" y1="56" x2="54" y2="58" />
  </svg>
);

const JacketIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Collar */}
    <path d="M32 14c0-2 2-4 4-4h8c2 0 4 2 4 4" />
    {/* Lapels */}
    <path d="M32 14l-4 8 8 6" />
    <path d="M48 14l4 8-8 6" />
    {/* Body left */}
    <path d="M28 22l-6 4v36c0 2 2 4 4 4h14V22" />
    {/* Body right */}
    <path d="M52 22l6 4v36c0 2-2 4-4 4H40V22" />
    {/* Sleeves left */}
    <path d="M22 26l-8 4v24c0 2 1 3 3 3h5" />
    {/* Sleeves right */}
    <path d="M58 26l8 4v24c0 2-1 3-3 3h-5" />
    {/* Center zipper */}
    <line x1="40" y1="28" x2="40" y2="66" strokeDasharray="3 3" />
    {/* Pockets */}
    <rect x="30" y="44" width="8" height="6" rx="1" />
    <rect x="42" y="44" width="8" height="6" rx="1" />
    {/* Hanger hook */}
    <path d="M40 10v-4" />
    <path d="M37 6c0-2 1.5-3 3-3s3 1 3 3" />
  </svg>
);

const AccessoriesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Watch face */}
    <circle cx="40" cy="40" r="18" />
    {/* Watch band left */}
    <line x1="25" y1="30" x2="22" y2="20" />
    <line x1="25" y1="50" x2="22" y2="60" />
    {/* Watch band right */}
    <line x1="55" y1="30" x2="58" y2="20" />
    <line x1="55" y1="50" x2="58" y2="60" />
    {/* Watch hands */}
    <line x1="40" y1="40" x2="40" y2="28" strokeWidth="1.5" />
    <line x1="40" y1="40" x2="48" y2="40" strokeWidth="1.5" />
    <circle cx="40" cy="40" r="2" fill="currentColor" />
  </svg>
);

const WristStacksIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Top bracelet */}
    <ellipse cx="40" cy="26" rx="22" ry="8" />
    <ellipse cx="40" cy="26" rx="16" ry="5" strokeDasharray="3 2" />
    {/* Middle bracelet */}
    <ellipse cx="40" cy="40" rx="24" ry="9" />
    <ellipse cx="40" cy="40" rx="18" ry="6" strokeDasharray="3 2" />
    {/* Bottom bracelet */}
    <ellipse cx="40" cy="54" rx="22" ry="8" />
    <ellipse cx="40" cy="54" rx="16" ry="5" strokeDasharray="3 2" />
  </svg>
);

const BeltsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Belt strap */}
    <path d="M8 36h64v8H8z" rx="2" />
    {/* Buckle frame */}
    <rect x="16" y="30" width="16" height="20" rx="3" />
    {/* Buckle prong */}
    <line x1="24" y1="30" x2="30" y2="44" />
    {/* Belt holes */}
    <circle cx="44" cy="40" r="2" fill="currentColor" />
    <circle cx="52" cy="40" r="2" fill="currentColor" />
    <circle cx="60" cy="40" r="2" fill="currentColor" />
    {/* Stitching lines */}
    <line x1="34" y1="38" x2="68" y2="38" strokeDasharray="2 3" strokeWidth="0.8" />
    <line x1="34" y1="42" x2="68" y2="42" strokeDasharray="2 3" strokeWidth="0.8" />
  </svg>
);

/* ── Icon map for known categories ── */
type IconComponent = ({ className }: { className?: string }) => React.JSX.Element;

const ICON_MAP: Record<string, IconComponent> = {
  footwear: ShoesIcon,
  shoes: ShoesIcon,
  jackets: JacketIcon,
  jacket: JacketIcon,
  accessories: AccessoriesIcon,
  accessory: AccessoriesIcon,
  "wrist stacks": WristStacksIcon,
  wriststacks: WristStacksIcon,
  bracelets: WristStacksIcon,
  belts: BeltsIcon,
  belt: BeltsIcon,
};

const FallbackIcon = ({ className }: { className?: string }) => (
  <Tag className={className} strokeWidth={1.5} />
);

const CollectionsPage = () => {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const [activeGender, setActiveGender] = usePersistentGender("womens");
  const [categories, setCategories] = useState<{ id: string; title: string; image: string }[]>([]);

  useEffect(() => {
    productService.getCategories().then(setCategories);
  }, []);

  return (
    <div className="bg-[#0A0A0A] text-white min-h-screen">
      {/* ── Header ── */}
      <div className="px-4 py-3 sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 rounded-full hover:bg-white/5 transition-all active:scale-95"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white">Collections</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/closet?tab=wishlist')}
              className="w-9 h-9 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center"
            >
              <ClosetIcon className="w-5 h-5 text-zinc-400" />
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="w-9 h-9 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center relative"
            >
              <ShoppingBag className="w-5 h-5 text-zinc-400" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Gender Toggle ── */}
        <div className="w-full max-w-[280px] mt-3">
          <GenderSelector 
            value={activeGender as GenderType} 
            onChange={(g) => setActiveGender(g)} 
            variant="simple"
          />
        </div>
      </div>

      {/* ── Category Cards ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGender}
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {categories.map((cat, index) => {
              const catId = cat.id.toLowerCase();
              const isImageCategory = catId === 'jackets' || catId === 'footwear' || catId === 'accessories' || catId === 'accessory';
              let imageName = '';
              if (catId === 'jackets') imageName = 'Jackets';
              else if (catId === 'footwear') imageName = 'Footwear';
              else if (catId === 'accessories' || catId === 'accessory') imageName = 'Accessories';

              const imageUrl = isImageCategory 
                ? `https://hfcdvcpgpkdgmcakgiuy.supabase.co/storage/v1/object/public/assets/collection-page/${imageName}.jpeg`
                : null;
              const Icon = ICON_MAP[catId] ?? FallbackIcon;
              
              return (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/shop/${activeGender}?category=${cat.id}&title=${cat.title}`)}
                  className={cn(
                    "w-full rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col items-center justify-center overflow-hidden relative",
                    isImageCategory ? "h-64" : "py-10 gap-3"
                  )}
                >
                  {isImageCategory ? (
                    <>
                      <img 
                        src={imageUrl!} 
                        alt={cat.title} 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-xl font-black text-white tracking-[0.25em] relative z-10 drop-shadow-lg">
                          {cat.title.toUpperCase()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Icon className="w-20 h-20 text-white/80" />
                      <span className="text-lg font-bold text-white tracking-[0.2em] relative z-10">
                        {cat.title.toUpperCase()}
                      </span>
                    </>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

export default CollectionsPage;
