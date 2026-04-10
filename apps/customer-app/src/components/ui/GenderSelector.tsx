import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import genderMenImg from '@/assets/gender-men.png';
import genderWomenImg from '@/assets/gender-women.png';

export type GenderType = 'womens' | 'mens';

interface GenderSelectorProps {
    value: GenderType;
    onChange: (gender: GenderType) => void;
    className?: string;
    variant?: 'fancy' | 'simple';
}

export const GenderSelector: React.FC<GenderSelectorProps> = ({ value, onChange, className, variant = 'fancy' }) => {
    const isWomens = value === 'womens';

    if (variant === 'simple') {
        return (
            <div className={cn("flex items-center bg-[#1C1C1E] p-1 rounded-full border border-white/10 w-full max-w-[280px] mx-auto", className)}>
                <button
                    onClick={() => onChange('womens')}
                    className={cn(
                        "flex-1 py-1.5 md:py-2 text-[10px] md:text-sm font-bold tracking-widest uppercase rounded-full transition-all duration-300",
                        isWomens ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                    )}
                >
                    Women
                </button>
                <button
                    onClick={() => onChange('mens')}
                    className={cn(
                        "flex-1 py-1.5 md:py-2 text-[10px] md:text-sm font-bold tracking-widest uppercase rounded-full transition-all duration-300",
                        !isWomens ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
                    )}
                >
                    Men
                </button>
            </div>
        );
    }

   return (
  <div
    className={cn(
      "relative flex items-center h-[110px] w-full max-w-[280px] mx-auto overflow-visible",
      className
    )}
  >
    {/* MEN */}
    <motion.button
      onClick={() => onChange("mens")}
      type="button"
      aria-pressed={!isWomens}
      className="absolute left-0 top-0 bottom-0 w-[65%] rounded-[28px] overflow-hidden bg-black"
      initial={false}
      animate={{
        zIndex: !isWomens ? 20 : 10,
        scale: !isWomens ? 1 : 0.92,
        x: !isWomens ? 0 : 6,
        opacity: !isWomens ? 1 : 0.75,
        boxShadow: !isWomens
          ? "12px 0 30px rgba(0,0,0,0.7)"
          : "none",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
    >
      <img
        src={genderMenImg}
        alt="Men"
        className="absolute inset-0 w-full h-full object-cover scale-110"
      />
    </motion.button>

    {/* WOMEN */}
    <motion.button
      onClick={() => onChange("womens")}
      type="button"
      aria-pressed={isWomens}
      className="absolute right-0 top-0 bottom-0 w-[65%] rounded-[28px] overflow-hidden bg-black"
      initial={false}
      animate={{
        zIndex: isWomens ? 20 : 10,
        scale: isWomens ? 1 : 0.92,
        x: isWomens ? 0 : -6,
        opacity: isWomens ? 1 : 0.75,
        boxShadow: isWomens
          ? "-12px 0 30px rgba(0,0,0,0.7)"
          : "none",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
    >
      <img
        src={genderWomenImg}
        alt="Women"
        className="absolute inset-0 w-full h-full object-cover scale-110"
      />
    </motion.button>
  </div>
)};