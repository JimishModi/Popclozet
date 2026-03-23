import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

/* ── Navbar icons matching Figma ── */

const HomeIcon = ({ className, active }: { className?: string; active?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10.5z" fill={active ? "currentColor" : "none"} />
        <path d="M9 22V14h6v8" stroke={active ? "#0A0A0A" : "currentColor"} />
    </svg>
);

const CollectionsIcon = ({ className, active }: { className?: string; active?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="8" cy="8" r={active ? "3.5" : "3"} />
        <circle cx="16" cy="8" r={active ? "3.5" : "3"} />
        <circle cx="8" cy="16" r={active ? "3.5" : "3"} />
        <circle cx="16" cy="16" r={active ? "3.5" : "3"} />
    </svg>
);

const ClosetIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Hanger hook */}
        <path d="M12 2c-1.1 0-2 .9-2 2 0 .7.4 1.4 1 1.7" />
        {/* Hanger body */}
        <path d="M12 6l-8 6h16l-8-6z" />
        {/* Bar */}
        <line x1="4" y1="12" x2="4" y2="22" />
        <line x1="20" y1="12" x2="20" y2="22" />
        <line x1="4" y1="22" x2="20" y2="22" />
    </svg>
);

const ProfileIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
);

interface NavItem {
    path: string;
    label: string;
    icon: React.FC<{ className?: string; active?: boolean }>;
}

const navItems: NavItem[] = [
    { path: '/home', label: 'Home', icon: HomeIcon },
    { path: '/collections', label: 'Collections', icon: CollectionsIcon },
    { path: '/closet', label: 'Closet', icon: ClosetIcon },
    { path: '/profile', label: 'Profile', icon: ProfileIcon },
];

interface BottomNavBarProps {
    className?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ className }) => {
    const location = useLocation();
    const { totalItems: cartCount } = useCart();
    const { wishlistItems } = useWishlist();
    const wishlistCount = wishlistItems.length;

    const isActive = (path: string) => {
        if (path === '/home') {
            return location.pathname === '/home';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className={cn(
            "fixed bottom-0 left-1/2 -translate-x-1/2 z-50",
            "w-full max-w-[430px]",
            "px-3 pb-4 pt-2",
            "pointer-events-none",
            className
        )}>
            <div className={cn(
                "pointer-events-auto",
                "relative flex items-center justify-around",
                "bg-gradient-to-t from-black/95 via-zinc-900/90 to-zinc-900/80",
                "backdrop-blur-3xl",
                "rounded-[28px] py-3 px-2",
                "border border-white/10",
                "shadow-[0_-10px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)_inset]"
            )}>
                <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "relative flex flex-col items-center gap-1 px-4 py-1.5 transition-all duration-200",
                                active
                                    ? "text-[#f2546d]"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <div className="relative">
                                <Icon
                                    className="w-6 h-6"
                                    active={active}
                                />
                                {/* Cart badge */}
                                {item.path === '/cart' && cartCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                        {cartCount > 9 ? '9+' : cartCount}
                                    </span>
                                )}
                                {/* Closet/Wishlist badge */}
                                {item.path === '/closet' && wishlistCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#f2546d] rounded-full px-1 shadow-lg shadow-[#f2546d]/30">
                                        {wishlistCount > 9 ? '9+' : wishlistCount}
                                    </span>
                                )}
                            </div>
                            <span className={cn(
                                "text-[10px] font-semibold tracking-wide",
                                active ? "text-[#f2546d]" : "text-zinc-600"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavBar;
