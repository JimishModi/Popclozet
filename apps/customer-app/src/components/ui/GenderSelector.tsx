import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type GenderType = 'womens' | 'mens';

interface GenderSelectorProps {
    value: GenderType;
    onChange: (gender: GenderType) => void;
    className?: string;
}

export const GenderSelector: React.FC<GenderSelectorProps> = ({ value, onChange, className }) => {
    const isWomens = value === 'womens';

    const womenImg = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80";
    const menImg = "https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=500&q=80";

    return (
        <div className={cn("relative flex items-center h-[130px] w-full max-w-[320px] mx-auto overflow-visible", className)}>
            
            {/* Women Card */}
            <motion.button
                onClick={() => onChange('womens')}
                className="absolute left-0 top-0 bottom-0 w-[56%] rounded-[24px] overflow-hidden outline-none"
                initial={false}
                animate={{
                    zIndex: isWomens ? 20 : 10,
                    scale: isWomens ? 1 : 0.94,
                    x: isWomens ? 0 : 3,
                    filter: isWomens ? 'blur(0px)' : 'blur(1.5px) grayscale(10%)',
                    opacity: isWomens ? 1 : 0.7,
                    boxShadow: isWomens ? '10px 0 25px rgba(0,0,0,0.7)' : 'none',
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {/* Image Background */}
                <img 
                    src={womenImg} 
                    alt="Women" 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                
                <span className={cn(
                    "absolute bottom-4 right-6 font-black text-[10px] tracking-[0.2em] transition-all duration-300",
                    isWomens ? "text-white opacity-100 scale-100" : "text-zinc-400 opacity-60 scale-90"
                )}>
                    WOMEN
                </span>
            </motion.button>

            {/* Men Card */}
            <motion.button
                onClick={() => onChange('mens')}
                className="absolute right-0 top-0 bottom-0 w-[56%] rounded-[24px] overflow-hidden outline-none"
                initial={false}
                animate={{
                    zIndex: !isWomens ? 20 : 10,
                    scale: !isWomens ? 1 : 0.94,
                    x: !isWomens ? 0 : -3,
                    filter: !isWomens ? 'blur(0px)' : 'blur(1.5px) grayscale(10%)',
                    opacity: !isWomens ? 1 : 0.7,
                    boxShadow: !isWomens ? '-10px 0 25px rgba(0,0,0,0.7)' : 'none',
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {/* Image Background */}
                <img 
                    src={menImg} 
                    alt="Men" 
                    className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                
                <span className={cn(
                    "absolute bottom-4 left-8 font-black text-[10px] tracking-[0.2em] transition-all duration-300",
                    !isWomens ? "text-white opacity-100 scale-100" : "text-zinc-400 opacity-60 scale-90"
                )}>
                    MEN
                </span>
            </motion.button>

        </div>
    );
};
