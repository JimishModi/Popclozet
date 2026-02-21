import { useEffect } from 'react';
import { syncEngine, SyncEvent } from '@/services/syncEngine';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * Component that listens to sync events and shows toast notifications
 * Add this to your App.tsx to enable sync notifications
 */
export function SyncNotifications() {
    useEffect(() => {
        const handleSyncEvent = (event: SyncEvent) => {
            switch (event.type) {
                case 'sync_started':
                    toast.info('Syncing offline changes...', {
                        icon: <RefreshCw className="w-4 h-4 animate-spin" />,
                        id: 'sync-progress',
                    });
                    break;

                case 'sync_completed':
                    toast.success('All changes synced', {
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        id: 'sync-progress',
                        description: event.data?.lastSyncTime
                            ? `Last synced: ${new Date(event.data.lastSyncTime).toLocaleTimeString()}`
                            : undefined,
                    });
                    break;

                case 'sync_error':
                    toast.error('Sync failed', {
                        icon: <AlertCircle className="w-4 h-4" />,
                        id: 'sync-progress',
                        description: event.data?.error || 'Please try again',
                    });
                    break;

                case 'conflict_detected':
                    toast.warning('Sync conflict detected', {
                        icon: <AlertTriangle className="w-4 h-4" />,
                        description: `${event.data?.entityType}: ${event.data?.entityId}`,
                        action: {
                            label: 'Resolve',
                            onClick: () => {
                                // Navigate to conflict resolution UI
                                console.log('Navigate to conflict resolution');
                            },
                        },
                    });
                    break;

                case 'sync_progress':
                    if (event.data?.progress) {
                        toast.loading(`Syncing... ${event.data.progress}%`, {
                            id: 'sync-progress',
                        });
                    }
                    break;
            }
        };

        syncEngine.addEventListener(handleSyncEvent);

        return () => {
            syncEngine.removeEventListener(handleSyncEvent);
        };
    }, []);

    // Listen for service worker messages
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SYNC_QUEUE') {
                    console.log('📨 Service worker requested sync');
                    syncEngine.triggerSync();
                }

                if (event.data?.type === 'PERIODIC_SYNC') {
                    console.log('📨 Service worker periodic sync');
                    syncEngine.triggerSync();
                }
            });
        }
    }, []);

    return null; // This component doesn't render anything
}
