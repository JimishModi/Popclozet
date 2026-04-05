/**
 * Settings Page — Mobile Layout
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@popclozet/auth';
import { motion } from 'framer-motion';
import { User, Shield, Info, LogOut, ChevronRight, Bell, BellOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
    isPushSupported,
    getPermissionState,
    subscribeToPush,
    unsubscribeFromPush,
} from '../services/pushNotificationService';

export function SettingsPage() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (isPushSupported()) {
            setPermissionStatus(getPermissionState());
            setPushEnabled(getPermissionState() === 'granted');
        }
    }, []);

    const handleTogglePush = async () => {
        setPushLoading(true);
        if (pushEnabled) {
            const success = await unsubscribeFromPush();
            if (success) setPushEnabled(false);
        } else {
            const result = await subscribeToPush();
            if (result.success) {
                setPushEnabled(true);
                setPermissionStatus('granted');
            } else {
                setPermissionStatus(getPermissionState());
            }
        }
        setPushLoading(false);
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const canToggle = isPushSupported() && permissionStatus !== 'denied';

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

            {/* Notification Toggle */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Notifications</h2>
                <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                        <div className="flex items-center gap-3">
                            <div className={clsx(
                                "w-9 h-9 rounded-lg flex items-center justify-center",
                                pushEnabled ? "bg-warehouse-500/10 text-warehouse-400" : "bg-zinc-800 text-zinc-500"
                            )}>
                                {pushEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Push Notifications</p>
                                <p className="text-[10px] text-zinc-500">
                                    {permissionStatus === 'denied'
                                        ? 'Blocked in browser settings'
                                        : 'Alerts for orders & returns'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleTogglePush}
                            disabled={pushLoading || !canToggle}
                            className={clsx(
                                "relative w-11 h-6 rounded-full transition-all shrink-0",
                                pushEnabled ? "bg-warehouse-500" : "bg-zinc-800",
                                (!canToggle || pushLoading) && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <motion.div
                                animate={{ x: pushEnabled ? 22 : 2 }}
                                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                            />
                        </button>
                    </div>
                </div>
                {permissionStatus === 'denied' && (
                    <p className="mt-2 px-1 text-[10px] text-red-400 leading-relaxed">
                        Notifications are blocked by your browser. Please enable them in your site settings to receive alerts.
                    </p>
                )}
            </motion.section>

            {/* Info Items */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
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
                    <span className="text-xs text-zinc-500">v1.1.0</span>
                </div>
            </motion.div>

            {/* Sign Out */}
            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={handleSignOut}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-red-500/5 border border-red-500/10 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-medium"
            >
                <div className="flex items-center gap-3">
                    <LogOut size={16} />
                    <span className="text-sm">Sign Out</span>
                </div>
                <ChevronRight size={16} />
            </motion.button>
        </div>
    );
}

export default SettingsPage;
