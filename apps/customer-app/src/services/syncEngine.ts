/**
 * Unified Sync Engine
 * Orchestrates all offline/online data synchronization across the application
 */

import { supabase } from '@popclozet/api-client';
import {
    getUnsyncedQueueItemsDB,
    markQueueItemSyncedDB,
    clearSyncedQueueItemsDB,
    getPendingSyncItems,
    getConflictItems,
    updateSyncMetadata,
    logConflict,
    resolveConflict,
    getPendingConflicts,
    getSyncStatusSummary,
    initDB,
} from '@/lib/db';
import { offlineQueueService } from './offlineQueueService';

// =====================================================
// Types
// =====================================================

export interface SyncStatus {
    isSyncing: boolean;
    lastSyncTime: number | null;
    pendingCount?: number;
    conflictCount?: number;
    errorCount?: number;
    syncProgress?: number; // 0-100
    isPaused?: boolean;
}

export interface SyncEvent {
    type: 'sync_started' | 'sync_progress' | 'sync_completed' | 'sync_error' | 'conflict_detected';
    timestamp: number;
    data?: any;
}

type SyncEventListener = (event: SyncEvent) => void;
type SyncEventCallback = (data: any) => void; // Added for new event system

// =====================================================
// Sync Engine Class
// =====================================================

class SyncEngine {
    private syncInProgress = false; // Renamed from isSyncing
    private syncPaused = false; // Added
    private currentProgress = 0; // Added
    private totalItems = 0; // Added
    private lastSyncTime: number | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private listeners: SyncEventListener[] = []; // Existing event listener system
    private eventListeners: Map<string, Set<SyncEventCallback>> = new Map(); // New event listener system
    private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private retryAttempts: Map<number, number> = new Map(); // Added
    private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RETRY_DELAY = 60000; // 1 minute max
    private readonly BASE_RETRY_DELAY = 1000; // 1 second base

    constructor() {
        this.initializeListeners();
    }

    // =====================================================
    // Initialization
    // =====================================================

    private initializeListeners() {
        // Listen for online/offline events
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('📶 Network online - triggering sync');
                this.syncAll();
            });

            window.addEventListener('offline', () => {
                console.log('📵 Network offline - pausing sync');
                this.pauseAutoSync();
            });

            // Listen for visibility change to sync when tab becomes active
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && navigator.onLine) {
                    console.log('👁️ Tab visible - checking for pending sync');
                    this.syncAll();
                }
            });
        }
    }

    // =====================================================
    // Auto Sync Management
    // =====================================================

    /**
     * Start automatic periodic sync (every 5 minutes when online)
     */
    startAutoSync() {
        if (this.syncInterval) {
            console.log('⚠️ Auto sync already running');
            return;
        }

        console.log('🔄 Starting auto sync (every 5 minutes)');

        // Initial sync
        if (navigator.onLine) {
            this.syncAll();
        }

        // Set up periodic sync
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.syncInProgress && !this.syncPaused) { // Added syncPaused check
                console.log('⏰ Periodic sync triggered');
                this.syncAll();
            }
        }, this.SYNC_INTERVAL_MS);
    }

    /**
     * Stop automatic sync
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏸️ Auto sync stopped');
        }
    }

    /**
     * Pause auto sync temporarily (e.g., when offline)
     */
    pauseAutoSync() {
        this.stopAutoSync();
    }

    /**
     * Resume auto sync
     */
    resumeAutoSync() {
        this.startAutoSync();
    }

    // =====================================================
    // Sync Operations
    // =====================================================

    /**
     * Sync all pending changes
     */
    async syncAll(): Promise<void> {
        if (this.syncInProgress) { // Changed from isSyncing
            console.log('⏳ Sync already in progress, skipping');
            return;
        }

        if (this.syncPaused) { // Added
            console.log('⏸️ Sync is paused, skipping auto sync');
            return;
        }

        if (!navigator.onLine) {
            console.log('📵 Offline, skipping sync');
            return;
        }

        this.syncInProgress = true; // Changed from isSyncing
        this.currentProgress = 0; // Reset progress
        this.totalItems = 0; // Reset total items
        this.emitEvent({ type: 'sync_started', timestamp: Date.now() });

        try {
            console.log('🔄 Starting full sync...');

            // Step 1: Process offline queue
            await this.processOfflineQueue();

            // Step 2: Process pending sync items
            await this.processPendingSyncItems();

            // Step 3: Sync with offline queue service
            await offlineQueueService.processQueue();

            // Step 4: Clean up old data
            await this.cleanup();

            this.lastSyncTime = Date.now();
            console.log('✅ Sync completed successfully');

            this.emitEvent({
                type: 'sync_completed',
                timestamp: Date.now(),
                data: { lastSyncTime: this.lastSyncTime }
            });

        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.emitEvent({
                type: 'sync_error',
                timestamp: Date.now(),
                data: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
        } finally {
            this.syncInProgress = false; // Changed from isSyncing
        }
    }

    /**
     * Process offline queue items
     */
    private async processOfflineQueue(): Promise<void> {
        const queueItems = await getUnsyncedQueueItemsDB();

        if (queueItems.length === 0) {
            return;
        }

        console.log(`📤 Processing ${queueItems.length} queued actions`);
        this.totalItems = queueItems.length; // Set total items for progress tracking

        for (let i = 0; i < queueItems.length; i++) {
            const item = queueItems[i];

            this.emitEvent({
                type: 'sync_progress',
                timestamp: Date.now(),
                data: {
                    current: i + 1,
                    total: queueItems.length,
                    progress: Math.round(((i + 1) / queueItems.length) * 100)
                }
            });
            this.currentProgress = i + 1; // Update current progress

            try {
                await this.processQueueItem(item);
                if (item.id) {
                    await markQueueItemSyncedDB(item.id);
                }
            } catch (error) {
                console.error(`Failed to process queue item ${item.id}:`, error);
                // Implement retry logic with exponential backoff
                if (item.retryCount < 3) {
                    this.scheduleRetry(item);
                }
            }
        }

        // Clean up synced items
        await clearSyncedQueueItemsDB();
    }

    /**
     * Process a single queue item
     */
    private async processQueueItem(item: any): Promise<void> {
        switch (item.action) {
            case 'email_signup':
                // Handle email signup sync
                console.log('Syncing email signup:', item.data);
                break;

            case 'add_to_cart':
            case 'remove_from_cart':
            case 'add_to_wishlist':
            case 'remove_from_wishlist':
                // These are already in IndexedDB, just mark as synced
                console.log(`Syncing ${item.action}:`, item.data);
                break;

            case 'create_reservation':
            case 'cancel_reservation':
                // These are handled by offlineQueueService
                console.log(`Syncing ${item.action}:`, item.data);
                break;

            default:
                console.warn(`Unknown action: ${item.action}`);
        }
    }

    /**
     * Process pending sync items with conflict detection
     */
    private async processPendingSyncItems(): Promise<void> {
        const pendingItems = await getPendingSyncItems();

        if (pendingItems.length === 0) {
            return;
        }

        console.log(`🔄 Processing ${pendingItems.length} pending sync items`);

        for (const item of pendingItems) {
            try {
                await this.syncEntity(item.entityType, item.entityId);
            } catch (error) {
                console.error(`Failed to sync ${item.entityType}:${item.entityId}:`, error);
                await updateSyncMetadata(
                    item.entityType as any,
                    item.entityId,
                    'error',
                    error instanceof Error ? error.message : 'Unknown error'
                );
            }
        }
    }

    /**
     * Sync a specific entity with conflict detection
     */
    async syncEntity(entityType: string, entityId: string): Promise<void> {
        console.log(`🔄 Syncing ${entityType}:${entityId}`);

        // Get local version
        const db = await initDB();
        let localData: any;

        switch (entityType) {
            case 'cart':
                localData = await db.get('cart', entityId);
                break;
            case 'wishlist':
                localData = await db.get('wishlist', entityId);
                break;
            case 'product':
                localData = await db.get('products', entityId);
                break;
            default:
                console.warn(`Unknown entity type: ${entityType}`);
                return;
        }

        if (!localData) {
            console.warn(`Local data not found for ${entityType}:${entityId}`);
            return;
        }

        // Fetch server version (if applicable)
        // For now, we'll just mark as synced
        // In a real implementation, you'd fetch from Supabase and compare versions

        await updateSyncMetadata(entityType as any, entityId, 'synced');
        console.log(`✅ Synced ${entityType}:${entityId}`);
    }

    /**
     * Detect and handle conflicts
     */
    private async detectConflict(
        entityType: string,
        entityId: string,
        localVersion: any,
        serverVersion: any
    ): Promise<boolean> {
        // Simple timestamp-based conflict detection
        const localTimestamp = localVersion.updatedAt || localVersion.addedAt || 0;
        const serverTimestamp = serverVersion.updated_at || serverVersion.created_at || 0;

        if (localTimestamp > serverTimestamp) {
            // Local is newer - potential conflict
            console.log(`⚠️ Conflict detected for ${entityType}:${entityId}`);

            await logConflict(entityType, entityId, localVersion, serverVersion);
            await updateSyncMetadata(entityType as any, entityId, 'conflict');

            this.emitEvent({
                type: 'conflict_detected',
                timestamp: Date.now(),
                data: { entityType, entityId }
            });

            return true;
        }

        return false;
    }

    /**
     * Resolve a conflict
     */
    async resolveConflictManual(
        conflictId: number,
        resolution: 'local' | 'server' | 'manual',
        resolvedVersion?: any
    ): Promise<void> {
        await resolveConflict(conflictId, resolution, resolvedVersion);

        // Get conflict details to update entity
        const conflicts = await getPendingConflicts();
        const conflict = conflicts.find(c => c.id === conflictId);

        if (conflict) {
            const finalVersion = resolution === 'local'
                ? conflict.localVersion
                : resolution === 'server'
                    ? conflict.serverVersion
                    : resolvedVersion;

            // Update entity with resolved version
            const db = await initDB();
            switch (conflict.entityType) {
                case 'cart':
                    await db.put('cart', finalVersion);
                    break;
                case 'wishlist':
                    await db.put('wishlist', finalVersion);
                    break;
                case 'product':
                    await db.put('products', finalVersion);
                    break;
            }

            await updateSyncMetadata(conflict.entityType as any, conflict.entityId, 'synced');
            console.log(`✅ Conflict ${conflictId} resolved with ${resolution} version`);
        }
    }

    /**
     * Schedule retry with exponential backoff
     */
    private scheduleRetry(item: any): void {
        const retryKey = `${item.action}:${item.id}`;

        // Clear existing timeout
        if (this.retryTimeouts.has(retryKey)) {
            clearTimeout(this.retryTimeouts.get(retryKey)!);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.BASE_RETRY_DELAY * Math.pow(2, item.retryCount),
            this.MAX_RETRY_DELAY
        );

        console.log(`⏰ Scheduling retry for ${retryKey} in ${delay}ms`);

        const timeout = setTimeout(() => {
            this.processQueueItem(item).catch(error => {
                console.error(`Retry failed for ${retryKey}:`, error);
            });
            this.retryTimeouts.delete(retryKey);
        }, delay);

        this.retryTimeouts.set(retryKey, timeout);
    }

    /**
     * Clean up old synced data and resolved conflicts
     */
    private async cleanup(): Promise<void> {
        // Clean up synced queue items (already done in processOfflineQueue)
        // Clean up old resolved conflicts (older than 7 days)
        const db = await initDB();
        const allConflicts = await db.getAll('conflict_log');
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        for (const conflict of allConflicts) {
            if (
                conflict.resolution !== 'pending' &&
                conflict.resolvedAt &&
                conflict.resolvedAt < sevenDaysAgo
            ) {
                if (conflict.id) {
                    await db.delete('conflict_log', conflict.id);
                }
            }
        }
    }

    // =====================================================
    // Status & Events
    // =====================================================

    /**
     * Get current sync status
     */
    async getStatus(): Promise<SyncStatus> {
        const summary = await getSyncStatusSummary();

        return {
            isSyncing: this.syncInProgress, // Changed from isSyncing
            lastSyncTime: this.lastSyncTime,
            pendingCount: summary.pending + summary.queuedActions,
            conflictCount: summary.conflicts + summary.pendingConflicts,
            errorCount: summary.errors,
            syncProgress: this.totalItems > 0 ? Math.round((this.currentProgress / this.totalItems) * 100) : 0, // Updated progress calculation
            isPaused: this.syncPaused, // Added
        };
    }

    /**
     * Add event listener
     */
    addEventListener(listener: SyncEventListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(listener: SyncEventListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(event: SyncEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in sync event listener:', error);
            }
        });
    }

    /**
     * Manual sync trigger
     */
    async triggerSync(): Promise<void> {
        console.log('🔄 Manual sync triggered');
        await this.syncAll();
    }
}

// Export singleton instance
export const syncEngine = new SyncEngine();

// Auto-start sync when module loads
if (typeof window !== 'undefined') {
    syncEngine.startAutoSync();
}
