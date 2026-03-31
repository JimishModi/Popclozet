import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
    LayoutDashboard, Package, Droplets, ClipboardList, RotateCcw,
    Truck, PlusCircle, Settings, LogOut, Warehouse
} from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/wash', icon: Droplets, label: 'Wash Cycle' },
    { to: '/orders', icon: ClipboardList, label: 'Order Fulfillment' },
    { to: '/returns', icon: RotateCcw, label: 'Returns' },
    { to: '/dispatch', icon: Truck, label: 'Rider Dispatch' },
    { to: '/intake', icon: PlusCircle, label: 'Product Intake' },
];

export function Sidebar() {
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <aside className="w-64 h-screen bg-surface-card border-r border-surface-border flex flex-col fixed left-0 top-0 z-40">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-6 border-b border-surface-border">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warehouse-500 to-warehouse-700 flex items-center justify-center shadow-lg shadow-warehouse-500/20">
                    <Warehouse className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-base font-bold text-white leading-tight">Popclozet</h1>
                    <p className="text-xs text-zinc-500">Warehouse Hub</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => clsx(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                            isActive
                                ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/20'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover'
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                <Icon size={18} className={clsx(isActive ? 'text-warehouse-400' : 'text-zinc-500 group-hover:text-zinc-400')} />
                                <span>{label}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-indicator"
                                        className="ml-auto w-1.5 h-1.5 rounded-full bg-warehouse-400"
                                    />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom */}
            <div className="px-3 py-4 border-t border-surface-border space-y-1">
                <NavLink
                    to="/settings"
                    className={({ isActive }) => clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        isActive
                            ? 'bg-warehouse-500/15 text-warehouse-300'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover'
                    )}
                >
                    <Settings size={18} />
                    <span>Settings</span>
                </NavLink>
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
                >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
