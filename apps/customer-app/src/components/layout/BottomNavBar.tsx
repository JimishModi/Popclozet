import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { Home, LayoutGrid, User } from 'lucide-react';
import { ClosetIcon } from '@/components/icons/ClosetIcon';
import { useClosetCount } from '@/hooks/useClosetCount';

interface NavItem {
    path: string;
    label: string;
    icon: any;
}

const navItems: NavItem[] = [
    { path: '/home', label: 'Home', icon: Home },
    { path: '/collections', label: 'Collections', icon: LayoutGrid },
    { path: '/closet', label: 'Closet', icon: ClosetIcon },
    { path: '/profile', label: 'Profile', icon: User },
];

interface BottomNavBarProps {
    className?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ className }) => {
    const location = useLocation();
    const { totalItems: cartCount } = useCart();
    const { closetCount } = useClosetCount();

    const isActive = (path: string) => {
        if (path === '/home') {
            return location.pathname === '/home';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className={cn(
            "fixed z-50 pointer-events-none",
            // Mobile styling (Bottom Nav)
            "bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-0 pb-0 pt-0",
            // Tablet styling (Top Nav)
            "md:translate-x-0 md:top-0 md:bottom-auto md:left-0 md:w-full md:max-w-full md:px-6 md:py-4 md:flex md:justify-center",
            // Desktop styling (Left Sidebar) - Now sticky inside MobileShell container
            "lg:sticky lg:top-0 lg:left-auto lg:bottom-auto lg:h-screen lg:w-64 lg:px-6 lg:py-8 lg:block lg:flex-shrink-0 lg:z-10",
            className
        )}>
            <div
                className={cn(
                    "pointer-events-auto relative flex items-center shadow-[0_-10px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)_inset]",
                    "backdrop-blur-3xl border border-white/10",
                    // Mobile interior container
                    "justify-around bg-gradient-to-t from-black/95 via-zinc-900/90 to-zinc-900/80 rounded-none pt-2 px-2",
                    // Tablet interior container
                    "md:justify-around md:bg-zinc-950/80 md:rounded-2xl md:py-2 md:px-6 md:shadow-lg md:w-fit md:mx-auto md:gap-8",
                    // Desktop interior container
                    "lg:flex-col lg:items-start lg:justify-start lg:bg-transparent lg:shadow-none lg:border-none lg:h-full lg:gap-6 lg:pt-8"
                )}
                style={{
                    // iOS safe area: push content above the home indicator bar
                    paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
                }}
            >
                {/* Horizontal top highlight, only visible on mobile/tablet */}
                <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:hidden" />

                {/* Optional brand logo for Desktop Sidebar */}
                <div className="hidden lg:block mb-8 px-4">
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-[#ff8ba7] bg-clip-text text-transparent">
                        Popclozet
                    </span>
                </div>

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    const handleClick = (e: React.MouseEvent) => {
                        // All navigation is now open, no redirects here.
                    };

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={handleClick}
                            className={cn(
                                "relative flex items-center transition-all duration-200",
                                // Mobile link styling - icon on top, text below
                                "flex-col gap-1 px-4 py-1.5",
                                // Tablet link styling
                                "md:flex-row md:py-2 md:px-4 md:rounded-lg md:hover:bg-white/5",
                                // Desktop link styling
                                "lg:w-full lg:px-4 lg:py-3 lg:rounded-xl lg:hover:bg-white/5",
                                active
                                    ? "text-[#ff4d6d]"
                                    : "text-zinc-500 hover:text-zinc-300",
                                active && "md:bg-[#ff4d6d]/10 lg:bg-[#ff4d6d]/10"
                            )}
                        >
                            <div className="relative">
                                <Icon
                                    className={cn(
                                        "w-6 h-6 md:w-6 md:h-6 lg:w-7 lg:h-7 transition-transform",
                                        active ? "scale-110" : ""
                                    )}
                                />
                                {/* Cart badge */}
                                {item.path === '/cart' && cartCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#ff4d6d] rounded-full px-1 shadow-lg shadow-[#ff4d6d]/30">
                                        {cartCount > 9 ? '9+' : cartCount}
                                    </span>
                                )}
                                {/* Closet badge */}
                                {item.path === '/closet' && closetCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-[#ff4d6d] rounded-full px-1 shadow-lg shadow-[#ff4d6d]/30">
                                        {closetCount > 9 ? '9+' : closetCount}
                                    </span>
                                )}
                            </div>
                            <span className={cn(
                                "font-medium tracking-wide",
                                // Mobile: show text label below icon
                                "text-[11px]",
                                // Tablet: show alongside icon
                                "md:text-[13px] md:ml-2",
                                // Desktop: show alongside icon
                                "lg:text-sm lg:ml-3",
                                active ? "text-[#ff4d6d]" : "text-zinc-500 md:text-zinc-400"
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
