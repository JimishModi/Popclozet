import { useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { syncEngine } from '@/services/syncEngine';

export const useOfflineSync = () => {
    const isOnline = useOnlineStatus();

    useEffect(() => {
        // When online status changes to true, trigger a sync
        if (isOnline) {
            console.log('🌐 App is online. Triggering sync...');
            syncEngine.triggerSync();
        }
    }, [isOnline]);

    return {
        isOnline,
        triggerSync: () => syncEngine.triggerSync()
    };
};
