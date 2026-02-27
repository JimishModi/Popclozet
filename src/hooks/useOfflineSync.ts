import { useState, useEffect, useCallback } from 'react';

interface OfflineState {
    isOnline: boolean;
    wasOffline: boolean;
}

export const useOfflineSync = () => {
    const [state, setState] = useState<OfflineState>({
        isOnline: navigator.onLine,
        wasOffline: false,
    });

    const [pendingActions, setPendingActions] = useState<any[]>([]);

    useEffect(() => {
        const handleOnline = () => {
            setState((prev) => ({
                isOnline: true,
                wasOffline: prev.wasOffline || !prev.isOnline,
            }));
        };

        const handleOffline = () => {
            setState({
                isOnline: false,
                wasOffline: true,
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sync pending actions when coming back online
    useEffect(() => {
        if (state.isOnline && state.wasOffline && pendingActions.length > 0) {
            syncPendingActions();
        }
    }, [state.isOnline, state.wasOffline, pendingActions]);

    const queueAction = useCallback((action: any) => {
        if (!state.isOnline) {
            setPendingActions((prev) => [...prev, action]);
            // Store in IndexedDB for persistence
            storeInIndexedDB(action);
        }
    }, [state.isOnline]);

    const syncPendingActions = async () => {
        // Sync all pending actions
        for (const action of pendingActions) {
            try {
                // Execute the action
                await action.execute();
                // Remove from queue
                setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
            } catch (error) {
                console.error('Failed to sync action:', error);
            }
        }
    };

    const storeInIndexedDB = (action: any) => {
        // Store action in IndexedDB for offline persistence
        const request = indexedDB.open('popclozet-offline', 1);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending-actions')) {
                db.createObjectStore('pending-actions', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event: any) => {
            const db = event.target.result;
            const transaction = db.transaction(['pending-actions'], 'readwrite');
            const store = transaction.objectStore('pending-actions');
            store.add(action);
        };
    };

    return {
        isOnline: state.isOnline,
        wasOffline: state.wasOffline,
        queueAction,
        pendingActions,
    };
};
