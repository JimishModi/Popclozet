import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Custom icons matching Figma design
const HomeIcon = ({ className, active }: { className?: string; active?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const CollectionsIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="6" r="3" />
        <circle cx="6" cy="14" r="3" />
        <circle cx="18" cy="14" r="3" />
        <circle cx="12" cy="18" r="3" />
    </svg>
);

const ClosetIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L6 6v2h12V6l-6-4z" />
        <path d="M6 8c-1.1 0-2 .9-2 2v10h16V10c0-1.1-.9-2-2-2" />
        <path d="M9 12h6" />
    </svg>
);

const ProfileIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
);

interface NavItem {
    path: string;
    label: string;
    icon: React.FC<{ className?: string; active?: boolean }>;
}

const navItems: NavItem[] = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/products', label: 'Browse', icon: CollectionsIcon },
    { path: '/orders', label: 'Orders', icon: ClosetIcon },
    { path: '/profile', label: 'Profile', icon: ProfileIcon },
];

interface BottomNavigationProps {
    className?: string;
}

/**
 * Bottom navigation bar for mobile app navigation.
 * Premium glassmorphism design with glow effects.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ className }) => {
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className={cn(
            "fixed bottom-0 left-1/2 -translate-x-1/2 z-50",
            "w-full max-w-[500px]",
            "px-3 pb-4 pt-2",
            className
        )}>
            {/* Premium Glass Container */}
            <div className={cn(
                "relative flex items-center justify-around",
                "bg-gradient-to-t from-black/95 via-zinc-900/90 to-zinc-900/80",
                "backdrop-blur-3xl",
                "rounded-[28px] py-3 px-4",
                "border border-white/10",
                "shadow-[0_-10px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)_inset]"
            )}>
                {/* Subtle gradient highlight on top */}
                <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "relative flex flex-col items-center gap-1 px-5 py-2 transition-all duration-300",
                                active
                                    ? "text-[#ff4d6d]"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {/* Glow effect for active item */}
                            {active && (
                                <div className="absolute inset-0 rounded-2xl bg-[#ff4d6d]/10 blur-xl" />
                            )}

                            <div className="relative">
                                <Icon
                                    className={cn(
                                        "w-6 h-6 transition-all duration-300",
                                        active && "scale-110 drop-shadow-[0_0_8px_rgba(255,77,109,0.6)]"
                                    )}
                                    active={active}
                                />
                                {/* Active dot indicator */}
                                {active && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ff4d6d] shadow-[0_0_6px_rgba(255,77,109,0.8)]" />
                                )}
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold tracking-wide transition-all duration-300",
                                active
                                    ? "text-[#ff4d6d]"
                                    : "text-zinc-600"
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

export default BottomNavigation;
