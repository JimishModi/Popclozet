/**
 * Bottom Navigation for Warehouse App
 * 5 tabs: Dashboard, Inventory, Wash, Orders, More
 * "More" toggles a slide-up sheet for secondary pages.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Droplets, ClipboardList, MoreHorizontal, RotateCcw, Truck, PlusCircle, Settings, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';

interface NavItem {
    path: string;
    icon: React.ReactNode;
    label: string;
}

const mainTabs: NavItem[] = [
    { path: '/', icon: <LayoutDashboard size={22} />, label: 'Home' },
    { path: '/inventory', icon: <Package size={22} />, label: 'Inventory' },
    { path: '/wash', icon: <Droplets size={22} />, label: 'Wash' },
    { path: '/orders', icon: <ClipboardList size={22} />, label: 'Orders' },
];

const moreTabs: NavItem[] = [
    { path: '/returns', icon: <RotateCcw size={20} />, label: 'Returns' },
    { path: '/dispatch', icon: <Truck size={20} />, label: 'Dispatch' },
    { path: '/intake', icon: <PlusCircle size={20} />, label: 'Product Intake' },
    { path: '/settings', icon: <Settings size={20} />, label: 'Settings' },
];

export function BottomNavigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut } = useAuth();
    const [showMore, setShowMore] = useState(false);

    // Hide on login
    if (location.pathname === '/login') return null;

    const isMoreActive = moreTabs.some(t => location.pathname === t.path);

    return (
        <>
            {/* More Sheet Overlay */}
            <AnimatePresence>
                {showMore && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMore(false)}
                            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
                        >
                            <div className="w-full max-w-[430px] bg-surface-card border-t border-surface-border rounded-t-2xl px-4 pt-3 pb-6">
                                {/* Handle */}
                                <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-semibold text-white">More</h3>
                                    <button
                                        onClick={() => setShowMore(false)}
                                        className="p-1.5 rounded-full hover:bg-surface-hover text-zinc-400"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {moreTabs.map(item => {
                                        const isActive = location.pathname === item.path;
                                        return (
                                            <button
                                                key={item.path}
                                                onClick={() => {
                                                    navigate(item.path);
                                                    setShowMore(false);
                                                }}
                                                className={clsx(
                                                    'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200',
                                                    isActive
                                                        ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30'
                                                        : 'bg-surface-hover text-zinc-400 hover:text-zinc-200 border border-transparent'
                                                )}
                                            >
                                                {item.icon}
                                                <span>{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Sign Out */}
                                <button
                                    onClick={async () => {
                                        setShowMore(false);
                                        await signOut();
                                        navigate('/login');
                                    }}
                                    className="mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-all"
                                >
                                    <LogOut size={18} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Nav Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center">
                <div className={clsx(
                    "w-full max-w-[430px]",
                    "bg-surface-card/95 backdrop-blur-xl",
                    "border-t border-surface-border",
                    "px-2 pb-safe"
                )}>
                    <div className="flex items-center justify-around h-16">
                        {mainTabs.map((item) => {
                            const isActive = location.pathname === item.path ||
                                (item.path !== '/' && location.pathname.startsWith(item.path));

                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={clsx(
                                        "relative flex flex-col items-center justify-center",
                                        "w-16 h-full",
                                        "transition-colors duration-200",
                                        isActive ? "text-warehouse-400" : "text-zinc-500"
                                    )}
                                >
                                    {/* Active indicator */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="warehouseActiveTab"
                                            className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-warehouse-500 rounded-full"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}

                                    <motion.div
                                        whileTap={{ scale: 0.9 }}
                                        animate={{ scale: isActive ? 1.1 : 1 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                    >
                                        {item.icon}
                                    </motion.div>

                                    <span className={clsx(
                                        "text-[10px] mt-1 font-medium",
                                        isActive ? "text-warehouse-400" : "text-zinc-500"
                                    )}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}

                        {/* More Tab */}
                        <button
                            onClick={() => setShowMore(true)}
                            className={clsx(
                                "relative flex flex-col items-center justify-center",
                                "w-16 h-full",
                                "transition-colors duration-200",
                                isMoreActive || showMore ? "text-warehouse-400" : "text-zinc-500"
                            )}
                        >
                            {(isMoreActive || showMore) && (
                                <motion.div
                                    layoutId="warehouseActiveTab"
                                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-warehouse-500 rounded-full"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}

                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                animate={{ scale: isMoreActive || showMore ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <MoreHorizontal size={22} />
                            </motion.div>

                            <span className={clsx(
                                "text-[10px] mt-1 font-medium",
                                isMoreActive || showMore ? "text-warehouse-400" : "text-zinc-500"
                            )}>
                                More
                            </span>
                        </button>
                    </div>
                </div>
            </nav>
        </>
    );
}

export default BottomNavigation;
