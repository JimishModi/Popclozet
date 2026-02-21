import { useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useSyncStatus } from './useSyncStatus';

export const useOfflineSync = () => {
    const isOnline = useOnlineStatus();
    const { isSyncing, pendingCount, conflictCount, errorCount, triggerSync } = useSyncStatus();

    useEffect(() => {
        // When online status changes to true, trigger a sync
        if (isOnline) {
            console.log('🌐 App is online. Triggering sync...');
            triggerSync().catch(console.error);
        }
    }, [isOnline, triggerSync]);

    return {
        isOnline,
        isSyncing,
        pendingCount,
        conflictCount,
        errorCount,
        triggerSync
    };
};
