import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
    EMPTY_WAREHOUSE_BADGE_COUNTS,
    getWarehouseBadgeCounts,
    type WarehouseBadgeCounts,
} from '../services/warehouseBadgeService';

interface WarehouseBadgeContextType {
    counts: WarehouseBadgeCounts;
}

const WarehouseBadgeContext = createContext<WarehouseBadgeContextType | undefined>(undefined);
const BADGE_REFRESH_DEBOUNCE_MS = 150;

export const WarehouseBadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [counts, setCounts] = useState<WarehouseBadgeCounts>(EMPTY_WAREHOUSE_BADGE_COUNTS);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let active = true;

        const refreshCounts = async () => {
            const nextCounts = await getWarehouseBadgeCounts();
            if (active) {
                setCounts(nextCounts);
            }
        };

        const scheduleRefresh = () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }

            refreshTimerRef.current = setTimeout(() => {
                void refreshCounts();
            }, BADGE_REFRESH_DEBOUNCE_MS);
        };

        const realtimeChannels: RealtimeChannel[] = [
            supabase
                .channel('warehouse-badge-orders')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefresh)
                .subscribe(),
            supabase
                .channel('warehouse-badge-returns')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'return_requests' }, scheduleRefresh)
                .subscribe(),
            supabase
                .channel('warehouse-badge-wash')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'all_products' }, scheduleRefresh)
                .subscribe(),
        ];

        void refreshCounts();

        const handleFocus = () => scheduleRefresh();
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                scheduleRefresh();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;

            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }

            realtimeChannels.forEach((channel) => {
                supabase.removeChannel(channel);
            });

            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return (
        <WarehouseBadgeContext.Provider value={{ counts }}>
            {children}
        </WarehouseBadgeContext.Provider>
    );
};

export const useWarehouseBadges = () => {
    const context = useContext(WarehouseBadgeContext);
    if (context === undefined) {
        throw new Error('useWarehouseBadges must be used within a WarehouseBadgeProvider');
    }
    return context;
};
