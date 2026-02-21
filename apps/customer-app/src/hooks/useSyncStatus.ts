import { useState, useEffect, useCallback } from 'react';
import { syncEngine, SyncStatus, SyncEvent } from '@/services/syncEngine';

/**
 * Hook for accessing sync status across the app
 * Provides real-time sync state, pending counts, and manual sync trigger
 */
export function useSyncStatus() {
    const [status, setStatus] = useState<SyncStatus>({
        isSyncing: false,
        lastSyncTime: null,
        pendingCount: 0,
        conflictCount: 0,
        errorCount: 0,
        syncProgress: 0,
    });

    const [isInitialized, setIsInitialized] = useState(false);

    // Load initial status
    useEffect(() => {
        const loadStatus = async () => {
            const initialStatus = await syncEngine.getStatus();
            setStatus(initialStatus);
            setIsInitialized(true);
        };

        loadStatus();
    }, []);

    // Listen for sync events
    useEffect(() => {
        const handleSyncEvent = async (event: SyncEvent) => {
            // Update status on any sync event
            const newStatus = await syncEngine.getStatus();
            setStatus(newStatus);

            // Handle specific event types
            switch (event.type) {
                case 'sync_started':
                    console.log('🔄 Sync started');
                    break;
                case 'sync_completed':
                    console.log('✅ Sync completed');
                    break;
                case 'sync_error':
                    console.error('❌ Sync error:', event.data);
                    break;
                case 'conflict_detected':
                    console.warn('⚠️ Conflict detected:', event.data);
                    break;
                case 'sync_progress':
                    console.log('📊 Sync progress:', event.data);
                    break;
            }
        };

        syncEngine.addEventListener(handleSyncEvent);

        return () => {
            syncEngine.removeEventListener(handleSyncEvent);
        };
    }, []);

    // Manual sync trigger
    const triggerSync = useCallback(async () => {
        await syncEngine.triggerSync();
    }, []);

    // Refresh status manually
    const refreshStatus = useCallback(async () => {
        const newStatus = await syncEngine.getStatus();
        setStatus(newStatus);
    }, []);

    return {
        ...status,
        isInitialized,
        triggerSync,
        refreshStatus,
    };
}
