import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { WifiOff, Wifi, CloudOff, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';
import { formatDistanceToNow } from 'date-fns';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();
    const { isSyncing, pendingCount, conflictCount, lastSyncTime, triggerSync, syncProgress } = useSyncStatus();
    const [show, setShow] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [showConflictDialog, setShowConflictDialog] = useState(false);

    useEffect(() => {
        console.log('🔌 Network status changed:', isOnline ? 'ONLINE' : 'OFFLINE');

        if (!isOnline) {
            // Show indicator immediately when offline
            setShow(true);
            setWasOffline(true);
        } else if (wasOffline) {
            // Show "Back online" message briefly
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                setWasOffline(false);
            }, 3000);
            return () => clearTimeout(timer);
        } else if (pendingCount > 0 || conflictCount > 0) {
            // Show if there are pending changes or conflicts
            setShow(true);
        } else {
            setShow(false);
        }
    }, [isOnline, wasOffline, pendingCount, conflictCount]);

    if (!show && isOnline && pendingCount === 0 && conflictCount === 0) return null;

    const getStatusColor = () => {
        if (!isOnline) return 'bg-orange-500';
        if (conflictCount > 0) return 'bg-yellow-500';
        if (isSyncing) return 'bg-blue-500';
        if (pendingCount > 0) return 'bg-amber-500';
        return 'bg-green-500';
    };

    const getStatusText = () => {
        if (!isOnline) return "You're offline";
        if (conflictCount > 0) return `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`;
        if (isSyncing) return `Syncing... ${syncProgress || 0}%`;
        if (pendingCount > 0) return `${pendingCount} pending`;
        return 'Back online';
    };

    const getStatusIcon = () => {
        if (!isOnline) return <WifiOff className="w-5 h-5" />;
        if (conflictCount > 0) return <AlertTriangle className="w-5 h-5" />;
        if (isSyncing) return <RefreshCw className="w-5 h-5 animate-spin" />;
        if (pendingCount > 0) return <CloudOff className="w-5 h-5" />;
        return <Wifi className="w-5 h-5" />;
    };

    return (
        <>
            <div
                className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] rounded-full shadow-2xl transition-all duration-300 animate-in slide-in-from-top-5 ${getStatusColor()} text-white overflow-hidden`}
                role="status"
                aria-live="polite"
            >
                {/* Progress bar background */}
                {isSyncing && syncProgress !== undefined && (
                    <div
                        className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all duration-300"
                        style={{ width: `${syncProgress}%` }}
                    />
                )}

                <div className="flex items-center gap-2 px-6 py-3">
                    {getStatusIcon()}
                    <span className="text-sm font-semibold">{getStatusText()}</span>

                    {/* Show sync button if online and has pending changes */}
                    {isOnline && pendingCount > 0 && !isSyncing && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-white hover:bg-white/20"
                            onClick={triggerSync}
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Sync
                        </Button>
                    )}

                    {/* Show resolve button if conflicts exist */}
                    {conflictCount > 0 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-white hover:bg-white/20"
                            onClick={() => setShowConflictDialog(true)}
                        >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Resolve
                        </Button>
                    )}

                    {/* Show last sync time if available */}
                    {lastSyncTime && isOnline && !isSyncing && pendingCount === 0 && (
                        <div className="flex items-center gap-1 text-xs opacity-80">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
                        </div>
                    )}

                    {/* Details toggle */}
                    {(pendingCount > 0 || conflictCount > 0) && (
                        <button
                            className="text-xs underline ml-2"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? 'Hide' : 'Details'}
                        </button>
                    )}
                </div>

                {/* Details panel */}
                {showDetails && (
                    <div className="px-6 py-3 border-t border-white/20 text-xs space-y-1">
                        {pendingCount > 0 && (
                            <div>📤 {pendingCount} action{pendingCount > 1 ? 's' : ''} pending sync</div>
                        )}
                        {conflictCount > 0 && (
                            <div>⚠️ {conflictCount} conflict{conflictCount > 1 ? 's' : ''} need resolution</div>
                        )}
                        {!isOnline && (
                            <div>📵 Changes will sync when you're back online</div>
                        )}
                    </div>
                )}
            </div>

            {/* Conflict Resolution Dialog */}
            <ConflictResolutionDialog
                open={showConflictDialog}
                onOpenChange={setShowConflictDialog}
            />
        </>
    );
}
