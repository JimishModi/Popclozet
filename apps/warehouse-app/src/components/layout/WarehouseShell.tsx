import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { QrCode, User, Bell, BellOff, X } from 'lucide-react';
import { useAuth } from '@popclozet/auth';
import { QRScannerOverlay } from '../QRScannerOverlay';
import {
    subscribeToPush,
    getPermissionState,
    isPushSupported,
} from '../../services/pushNotificationService';

interface WarehouseShellProps {
    children: React.ReactNode;
    className?: string;
    hideBottomNav?: boolean;
}

export const WarehouseShell: React.FC<WarehouseShellProps> = ({
    children,
    className,
    hideBottomNav = false
}) => {
    const { user, profile } = useAuth();
    const [scannerOpen, setScannerOpen] = useState(false);
    const [pushState, setPushState] = useState<'unknown' | 'granted' | 'denied' | 'default'>('unknown');
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    // Check push permission state and auto-subscribe when already granted
    useEffect(() => {
        if (!user || !isPushSupported()) return;

        const perm = getPermissionState();
        setPushState(perm);

        if (perm === 'granted') {
            // Already granted — silently ensure subscription is saved
            subscribeToPush().catch(err =>
                console.warn('[WarehouseShell] Push sub failed:', err)
            );
        }
    }, [user]);

    const handleEnablePush = async () => {
        setSubscribing(true);
        const result = await subscribeToPush();
        if (result.success) {
            setPushState('granted');
        } else {
            // Re-read actual permission state (user may have denied)
            setPushState(getPermissionState());
            console.warn('[WarehouseShell] Push subscribe failed:', result.error);
        }
        setSubscribing(false);
    };

    const showBanner =
        user &&
        !bannerDismissed &&
        isPushSupported() &&
        (pushState === 'default' || pushState === 'unknown');

    return (
        <div className="min-h-screen bg-black flex justify-center">
            {/* Responsive container — mobile-first, scales up on tablets */}
            <div
                className={clsx(
                    "w-full max-w-[430px] sm:max-w-[540px] md:max-w-[768px] min-h-screen relative",
                    "bg-surface",
                    "shadow-2xl shadow-black/50",
                    className
                )}
            >
                {/* Top Header */}
                {!hideBottomNav && (
                    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-surface-border px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-warehouse-500/10 flex items-center justify-center text-warehouse-400">
                                <User size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Warehouse Admin</span>
                                <span className="text-xs text-white font-medium truncate max-w-[120px] sm:max-w-[200px]">
                                    {profile?.full_name || user?.email?.split('@')[0] || 'Admin'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setScannerOpen(true)}
                            className="w-10 h-10 rounded-xl bg-warehouse-500 text-black flex items-center justify-center shadow-lg shadow-warehouse-500/20 active:scale-95 transition-all"
                        >
                            <QrCode size={20} />
                        </button>
                    </header>
                )}

                {/* Push notification permission banner */}
                {showBanner && (
                    <div className="bg-warehouse-500/10 border-b border-warehouse-500/30 px-4 py-3 flex items-center gap-3">
                        <Bell size={18} className="text-warehouse-400 shrink-0" />
                        <p className="text-xs text-zinc-300 flex-1">
                            Enable push notifications to get instant return alerts outside the app.
                        </p>
                        <button
                            onClick={handleEnablePush}
                            disabled={subscribing}
                            className="text-xs font-semibold text-warehouse-400 border border-warehouse-500/50 rounded-lg px-3 py-1.5 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                        >
                            {subscribing ? 'Enabling…' : 'Enable'}
                        </button>
                        <button
                            onClick={() => setBannerDismissed(true)}
                            className="text-zinc-500 active:scale-95 transition-all shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Push denied warning */}
                {user && pushState === 'denied' && !bannerDismissed && (
                    <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3 flex items-center gap-3">
                        <BellOff size={18} className="text-red-400 shrink-0" />
                        <p className="text-xs text-zinc-400 flex-1">
                            Push notifications are blocked. Enable them in your browser settings to receive return alerts.
                        </p>
                        <button
                            onClick={() => setBannerDismissed(true)}
                            className="text-zinc-500 active:scale-95 transition-all shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Main content area */}
                <div className={clsx(
                    "flex flex-col min-h-screen",
                    !hideBottomNav ? "pb-24" : ""
                )}>
                    {children}
                </div>

                {/* Global Scanner Overlay */}
                {scannerOpen && (
                    <QRScannerOverlay onClose={() => setScannerOpen(false)} />
                )}
            </div>
        </div>
    );
};

export default WarehouseShell;
