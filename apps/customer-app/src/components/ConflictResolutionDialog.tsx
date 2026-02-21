import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { getPendingConflicts, resolveConflict } from '@/lib/db';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Conflict {
    id?: number;
    entityType: string;
    entityId: string;
    localVersion: any;
    serverVersion: any;
    timestamp: number;
}

interface ConflictResolutionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * UI for resolving sync conflicts manually
 */
export function ConflictResolutionDialog({ open, onOpenChange }: ConflictResolutionDialogProps) {
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        if (open) {
            loadConflicts();
        }
    }, [open]);

    const loadConflicts = async () => {
        const pending = await getPendingConflicts();
        setConflicts(pending);
        if (pending.length > 0) {
            setSelectedConflict(pending[0]);
        }
    };

    const handleResolve = async (resolution: 'local' | 'server') => {
        if (!selectedConflict || !selectedConflict.id) return;

        setResolving(true);
        try {
            const resolvedVersion = resolution === 'local'
                ? selectedConflict.localVersion
                : selectedConflict.serverVersion;

            await resolveConflict(selectedConflict.id, resolution, resolvedVersion);

            toast.success('Conflict resolved', {
                description: `Used ${resolution} version`,
            });

            // Reload conflicts
            await loadConflicts();

            // If no more conflicts, close dialog
            if (conflicts.length <= 1) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            toast.error('Failed to resolve conflict', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setResolving(false);
        }
    };

    const renderValue = (value: any) => {
        if (typeof value === 'object') {
            return (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(value, null, 2)}
                </pre>
            );
        }
        return <span className="text-sm">{String(value)}</span>;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        Resolve Sync Conflicts
                    </DialogTitle>
                    <DialogDescription>
                        {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected.
                        Choose which version to keep.
                    </DialogDescription>
                </DialogHeader>

                {selectedConflict && (
                    <div className="space-y-4">
                        {/* Conflict selector */}
                        {conflicts.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {conflicts.map((conflict, index) => (
                                    <Button
                                        key={conflict.id || index}
                                        variant={selectedConflict === conflict ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedConflict(conflict)}
                                    >
                                        {conflict.entityType}: {conflict.entityId.substring(0, 8)}...
                                    </Button>
                                ))}
                            </div>
                        )}

                        {/* Conflict details */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Local version */}
                            <div className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Your Changes (Local)</h3>
                                    <Badge variant="secondary">Local</Badge>
                                </div>
                                <ScrollArea className="h-60">
                                    {renderValue(selectedConflict.localVersion)}
                                </ScrollArea>
                                <Button
                                    className="w-full"
                                    onClick={() => handleResolve('local')}
                                    disabled={resolving}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Keep Local Version
                                </Button>
                            </div>

                            {/* Server version */}
                            <div className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Server Version</h3>
                                    <Badge variant="default">Server</Badge>
                                </div>
                                <ScrollArea className="h-60">
                                    {renderValue(selectedConflict.serverVersion)}
                                </ScrollArea>
                                <Button
                                    className="w-full"
                                    variant="secondary"
                                    onClick={() => handleResolve('server')}
                                    disabled={resolving}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Keep Server Version
                                </Button>
                            </div>
                        </div>

                        {/* Conflict info */}
                        <div className="text-xs text-muted-foreground">
                            <p>Entity: {selectedConflict.entityType}:{selectedConflict.entityId}</p>
                            <p>Detected: {new Date(selectedConflict.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {conflicts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>No conflicts to resolve</p>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
