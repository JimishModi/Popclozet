import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import logo from '@/logo/logo.png';

// Icons as SVG components
const BellIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const ShoppingBagIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

interface MobileHeaderProps {
    className?: string;
}

/**
 * Mobile header with popclozet branding, location, and action icons.
 * Dark theme only - premium glassmorphism design.
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({ className }) => {
    const { getCartCount } = useCart();
    const cartCount = typeof getCartCount === 'function' ? getCartCount() : 0;

    return (
        <header className={cn(
            "sticky top-0 z-50 px-4 py-3",
            "bg-black/80 backdrop-blur-xl",
            "border-b border-white/5",
            className
        )}>
            <div className="flex items-center justify-between">
                {/* Logo and Location */}
                <div className="flex flex-col">
                    <Link to="/" className="flex items-center">
                        <img
                            src={logo}
                            alt="popclozet"
                            className="h-7 w-auto object-contain"
                        />
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                        <MapPinIcon className="w-3 h-3 text-[#ff4d6d]" />
                        <span className="font-medium">Powai, Mumbai</span>
                    </div>
                </div>

                {/* Action Icons - Glass Style */}
                <div className="flex items-center gap-2">
                    <button
                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                        aria-label="Notifications"
                    >
                        <BellIcon className="w-5 h-5 text-zinc-400" />
                    </button>

                    <Link
                        to="/favorites"
                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                        aria-label="Wishlist"
                    >
                        <HeartIcon className="w-5 h-5 text-zinc-400" />
                    </Link>

                    <Link
                        to="/cart"
                        className="relative p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                        aria-label="Cart"
                    >
                        <ShoppingBagIcon className="w-5 h-5 text-zinc-400" />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-[#ff4d6d] rounded-full shadow-lg shadow-[#ff4d6d]/30">
                                {cartCount > 9 ? '9+' : cartCount}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </header>
    );
};

export default MobileHeader;
