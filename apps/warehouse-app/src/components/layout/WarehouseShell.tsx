import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { QrCode, User } from 'lucide-react';
import { useAuth } from '@popclozet/auth';
import { QRScannerOverlay } from '../QRScannerOverlay';
import { subscribeToPush } from '../../services/pushNotificationService';

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

    // Auto-subscribe to push notifications when warehouse staff logs in
    useEffect(() => {
        if (user) {
            subscribeToPush().catch(err => console.warn('[WarehouseShell] Push sub failed:', err));
        }
    }, [user]);

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
