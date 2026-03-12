/**
 * Settings Page — Mobile Layout
 */

import { useAuth } from '@popclozet/auth';
import { motion } from 'framer-motion';
import { User, Shield, Info, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="px-4 py-5 space-y-5">
            <h1 className="text-lg font-bold text-white">Settings</h1>

            {/* Profile Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-card border border-surface-border rounded-xl p-4"
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-warehouse-500 to-warehouse-700 flex items-center justify-center">
                        <User size={22} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">{profile?.full_name || 'Warehouse Staff'}</p>
                        <p className="text-xs text-zinc-500">{user?.email}</p>
                    </div>
                </div>
            </motion.div>

            {/* Info Items */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-surface-card border border-surface-border rounded-xl divide-y divide-surface-border"
            >
                <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                        <Shield size={16} className="text-warehouse-400" />
                        <span className="text-sm text-zinc-300">Role</span>
                    </div>
                    <span className="text-xs text-warehouse-300 font-semibold capitalize">{profile?.role || 'warehouse'}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                        <Info size={16} className="text-zinc-500" />
                        <span className="text-sm text-zinc-300">Version</span>
                    </div>
                    <span className="text-xs text-zinc-500">v1.0.0</span>
                </div>
            </motion.div>

            {/* Sign Out */}
            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={handleSignOut}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-red-500/5 border border-red-500/10 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
            >
                <div className="flex items-center gap-3">
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Sign Out</span>
                </div>
                <ChevronRight size={16} />
            </motion.button>
        </div>
    );
}
