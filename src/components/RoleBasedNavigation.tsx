/**
 * Role-Based Navigation
 * 
 * Phase 4 Finalization: Shows navigation based on user role
 * 
 * - Customer: Home, Orders, Profile
 * - Rider: Dashboard, Active Delivery
 * - Admin: Admin Dashboard, Admin Orders
 * - Warehouse: (Future)
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { motion } from 'framer-motion';

interface NavItem {
    path: string;
    label: string;
    icon: string;
}

export const RoleBasedNavigation: React.FC = () => {
    const { isAdmin, isRider, isWarehouse } = useRolePermissions();
    const location = useLocation();

    // Build nav items based on role
    const getNavItems = (): NavItem[] => {
        if (isAdmin) {
            return [
                { path: '/admin', label: 'Dashboard', icon: '📊' },
                { path: '/admin/orders', label: 'Orders', icon: '📦' },
                { path: '/profile', label: 'Profile', icon: '👤' },
            ];
        }

        if (isRider) {
            return [
                { path: '/rider', label: 'Dashboard', icon: '🚴' },
                { path: '/profile', label: 'Profile', icon: '👤' },
            ];
        }

        if (isWarehouse) {
            return [
                { path: '/', label: 'Orders', icon: '📦' },
                { path: '/profile', label: 'Profile', icon: '👤' },
            ];
        }

        // Default: Customer
        return [
            { path: '/', label: 'Home', icon: '🏠' },
            { path: '/products', label: 'Browse', icon: '👗' },
            { path: '/orders', label: 'Orders', icon: '📦' },
            { path: '/profile', label: 'Profile', icon: '👤' },
        ];
    };

    const navItems = getNavItems();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f]/95 backdrop-blur-xl border-t border-white/10 safe-area-pb z-40">
            <div className="flex justify-around items-center py-2 px-4 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className="flex flex-col items-center py-2 px-4 relative"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ff4d6d]"
                                />
                            )}
                            <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                                {item.icon}
                            </span>
                            <span className={`text-xs mt-1 transition-colors ${isActive ? 'text-white' : 'text-zinc-500'
                                }`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
