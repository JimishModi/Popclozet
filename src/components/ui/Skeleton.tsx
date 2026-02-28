import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonBoxProps {
    className?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

/**
 * Base skeleton box with shimmer animation.
 * Pass height/width via className.
 */
export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
    className,
    rounded = '2xl',
}) => (
    <div
        className={cn(
            'relative overflow-hidden bg-white/5',
            `rounded-${rounded}`,
            className
        )}
    >
        <div className="absolute inset-0 skeleton-shimmer" />
    </div>
);

/**
 * Skeleton text line with natural width variance.
 */
export const SkeletonText: React.FC<{ width?: string; className?: string }> = ({
    width = '100%',
    className,
}) => (
    <SkeletonBox
        className={cn('h-3.5', className)}
        rounded="lg"
    />
);

/**
 * Product card skeleton for loading grids.
 */
export const SkeletonProductCard: React.FC = () => (
    <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
        <SkeletonBox className="aspect-[3/4] rounded-none" rounded="sm" />
        <div className="p-3 space-y-2">
            <SkeletonText className="w-3/4" />
            <div className="flex items-center justify-between">
                <SkeletonText className="w-1/3" />
                <SkeletonText className="w-1/5" />
            </div>
        </div>
    </div>
);

/**
 * Order card skeleton for loading lists.
 */
export const SkeletonOrderCard: React.FC = () => (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex items-start justify-between">
            <div className="space-y-1.5">
                <SkeletonText className="w-28" />
                <SkeletonText className="w-20" />
            </div>
            <SkeletonBox className="w-20 h-6" rounded="full" />
        </div>
        <div className="flex gap-3">
            <SkeletonBox className="w-14 h-18" rounded="lg" />
            <SkeletonBox className="w-14 h-18" rounded="lg" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <SkeletonText className="w-24" />
            <SkeletonText className="w-20" />
        </div>
    </div>
);

/**
 * Cart item skeleton for loading cart.
 */
export const SkeletonCartItem: React.FC = () => (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex gap-4">
            <SkeletonBox className="w-20 h-28 flex-shrink-0" rounded="xl" />
            <div className="flex-1 space-y-2 py-1">
                <SkeletonText className="w-3/4" />
                <SkeletonText className="w-1/2" />
                <SkeletonText className="w-1/3" />
            </div>
        </div>
    </div>
);

/**
 * Product detail page skeleton.
 */
export const SkeletonProductDetail: React.FC = () => (
    <div className="min-h-screen bg-[#0a0a0a] py-6 px-4 space-y-5">
        <SkeletonBox className="aspect-[3/4]" />
        <div className="space-y-3">
            <SkeletonText className="w-1/4" />
            <SkeletonText className="w-3/4 h-6" />
            <SkeletonText className="w-full" />
            <SkeletonText className="w-2/3" />
        </div>
        <SkeletonBox className="h-32" />
        <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
                <SkeletonBox key={i} className="h-12" rounded="xl" />
            ))}
        </div>
        <SkeletonBox className="h-24" />
        <SkeletonBox className="h-14" rounded="xl" />
    </div>
);

/**
 * Checkout skeleton.
 */
export const SkeletonCheckout: React.FC = () => (
    <div className="min-h-screen bg-[#0a0a0a] py-6 px-4 space-y-5">
        <SkeletonText className="w-1/3 h-7" />
        <SkeletonBox className="h-40" />
        <SkeletonBox className="h-24" />
        <SkeletonBox className="h-52" />
    </div>
);
