import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ShoppingBag, MapPin } from 'lucide-react';
import { ClosetIcon } from '@/components/icons/ClosetIcon';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useNotifications } from '@/hooks/useNotifications';

import logo from '@/logo/popclozet-logo.svg';

interface MobileHeaderProps {
    className?: string;
}

/**
 * Mobile header with popclozet branding, location, and action icons.
 * Dark theme only - premium glassmorphism design.
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({ className }) => {
    const { totalItems } = useCart();
    const cartCount = typeof totalItems === 'number' ? totalItems : 0;
    const { unreadCount } = useNotifications({ limit: 5, autoSubscribe: true });

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
                    <Link to="/home" className="flex items-center">
                        <img
                            src={logo}
                            alt="Popclozet"
                            className="h-10 w-auto object-contain"
                            style={{ filter: "brightness(0) saturate(100%) invert(52%) sepia(79%) saturate(2166%) hue-rotate(316deg) brightness(100%) contrast(95%)" }}
                        />
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                        <MapPin className="w-3 h-3 text-[#f2546d]" />
                        <span className="font-medium">Powai, Mumbai</span>
                    </div>
                </div>

                {/* Action Icons - Glass Style */}
                <div className="flex items-center gap-2">
                    <Link
                        to="/notifications"
                        className="relative p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5 text-zinc-400" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-[#f2546d] rounded-full shadow-lg shadow-[#f2546d]/30">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </Link>

                    <Link
                        to="/wishlist"
                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                        aria-label="Wishlist"
                    >
                        <ClosetIcon className="w-5 h-5 text-zinc-400" />
                    </Link>

                    <Link
                        to="/cart"
                        className="relative p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                        aria-label="Cart"
                    >
                        <ShoppingBag className="w-5 h-5 text-zinc-400" />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-[#f2546d] rounded-full shadow-lg shadow-[#f2546d]/30">
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
