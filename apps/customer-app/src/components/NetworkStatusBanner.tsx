/**
 * NetworkStatusBanner
 *
 * Shows a slim banner at the top of the app when the user goes offline,
 * and briefly shows a "back online" confirmation when connectivity returns.
 */

import { useState, useEffect } from 'react';

export default function NetworkStatusBanner() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 3000);
        };
        const goOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    if (isOnline && !showReconnected) return null;

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-[9999] text-center text-xs font-medium py-1.5 transition-all duration-300 ${isOnline
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white'
                }`}
        >
            {isOnline ? '✅ Back online' : '📵 You are offline — changes will sync when reconnected'}
        </div>
    );
}
