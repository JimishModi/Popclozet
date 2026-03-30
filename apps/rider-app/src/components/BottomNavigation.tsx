/**
 * Bottom Navigation Component
 * 
 * Main navigation bar for rider app with 4 tabs
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Wallet, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface NavItem {
    path: string;
    icon: React.ReactNode;
    label: string;
}

const navItems: NavItem[] = [
    { path: '/', icon: <Home size={24} />, label: 'Home' },
    { path: '/orders', icon: <FileText size={24} />, label: 'Orders' },
    { path: '/wallet', icon: <Wallet size={24} />, label: 'Wallet' },
    { path: '/profile', icon: <User size={24} />, label: 'Profile' },
];

interface BottomNavigationProps {
    className?: string;
}

export function BottomNavigation({ className }: BottomNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();

    // Hide on certain pages
    const hiddenPaths = ['/login', '/signup', '/delivery/', '/verify/', '/otp/'];
    const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path));

    if (shouldHide) return null;

    return (
        <nav
            className={clsx(
                "fixed bottom-0 left-0 right-0 z-50",
                "flex justify-center",
                className
            )}
        >
            <div className={clsx(
                "w-full max-w-[430px] sm:max-w-[540px] md:max-w-[768px]",
                "bg-zinc-900/95 backdrop-blur-xl",
                "border-t border-zinc-800/50",
                "px-2 pb-safe"
            )}>
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={clsx(
                                "relative flex flex-col items-center justify-center",
                                "flex-1 h-full",
                                "transition-colors duration-200",
                                isActive ? "text-blue-500" : "text-zinc-500"
                            )}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}

                            {/* Icon with scale animation */}
                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                animate={{ scale: isActive ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                {item.icon}
                            </motion.div>

                            {/* Label */}
                            <span
                                className={clsx(
                                    "text-xs mt-1 font-medium",
                                    isActive ? "text-blue-500" : "text-zinc-500"
                                )}
                            >
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            </div>
        </nav>
    );
}

export default BottomNavigation;
