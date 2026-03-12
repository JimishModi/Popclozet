import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CategoryCardProps {
    label: string;
    icon: React.ElementType;
    onClick?: () => void;
    className?: string;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
    label,
    icon: Icon,
    onClick,
    className
}) => {
    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                "relative w-full aspect-square rounded-3xl overflow-hidden",
                "bg-[#1C1C1E] border border-white/5",
                "flex flex-col items-center justify-center gap-4",
                "group hover:bg-[#2C2C2E] transition-colors duration-300",
                className
            )}
        >
            {/* Icon Container */}
            <div className="p-4 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                <Icon strokeWidth={1.5} className="w-12 h-12 text-white" />
            </div>

            {/* Label */}
            <span className="text-lg font-bold text-white tracking-wide uppercase">
                {label}
            </span>

            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.button>
    );
};
