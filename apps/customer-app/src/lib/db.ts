import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the unified database schema for offline-first architecture
interface PopClozetDB extends DBSchema {
    cart: {
        key: string;
        value: {
            productId: string;
            quantity: number;
            addedAt: number;
            updatedAt: number;
            version: number;
        };
    };
    wishlist: {
        key: string;
        value: {
            productId: string;
            addedAt: number;
            version: number;
        };
    };
    products: {
        key: string;
        value: {
            id: string;
            data: any;
            cachedAt: number;
            version: number;
        };
    };
    reservations: {
        key: string;
        value: {
            id: string;
            data: any;
            cachedAt: number;
            version: number;
        };
    };

    offlineQueue: {
        key: number;
        value: {
            id?: number;
            action: 'add_to_cart' | 'remove_from_cart' | 'add_to_wishlist' | 'remove_from_wishlist' | 'email_signup' | 'create_reservation' | 'cancel_reservation';
            data: any;
            timestamp: number;
            synced: number; // 0 = false, 1 = true
            retryCount: number;
            lastError?: string;
        };
        indexes: { 'by-synced': number; 'by-timestamp': number };
    };
    preferences: {
        key: string;
        value: any;
    };
    sync_metadata: {
        key: string; // entityType:entityId
        value: {
            key: string; // Add key to value as well for keyPath
            entityType: 'cart' | 'wishlist' | 'product' | 'reservation' | 'user';
            entityId: string;
            lastSyncedAt: number;
            version: number;
            syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
            lastError?: string;
        };
        indexes: { 'by-status': string; 'by-entity-type': string };
    };
    conflict_log: {
        key: number;
        value: {
            id?: number;
            entityType: string;
            entityId: string;
            localVersion: any;
            serverVersion: any;
            resolvedVersion?: any;
            resolution: 'local' | 'server' | 'manual' | 'pending';
            timestamp: number;
            resolvedAt?: number;
        };
        indexes: { 'by-resolution': string; 'by-timestamp': number };
    };
}

const DB_NAME = 'PopClozet';
const DB_VERSION = 2; // Incremented for schema changes

let dbInstance: IDBPDatabase<PopClozetDB> | null = null;

// Initialize the database
export async function initDB(): Promise<IDBPDatabase<PopClozetDB>> {
    if (dbInstance) {
        return dbInstance;
    }

    dbInstance = await openDB<PopClozetDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Create cart store
            if (!db.objectStoreNames.contains('cart')) {
                db.createObjectStore('cart', { keyPath: 'productId' });
            }

            // Create wishlist store
            if (!db.objectStoreNames.contains('wishlist')) {
                db.createObjectStore('wishlist', { keyPath: 'productId' });
            }

            // Create products cache store
            if (!db.objectStoreNames.contains('products')) {
                db.createObjectStore('products', { keyPath: 'id' });
            }

            // Create reservations store
            if (!db.objectStoreNames.contains('reservations')) {
                db.createObjectStore('reservations', { keyPath: 'id' });
            }

            // Create offline queue store
            if (!db.objectStoreNames.contains('offlineQueue')) {
                const queueStore = db.createObjectStore('offlineQueue', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                queueStore.createIndex('by-synced', 'synced');
                queueStore.createIndex('by-timestamp', 'timestamp');
            } else if (oldVersion < 2) {
                // Add timestamp index to existing queue store
                const queueStore = transaction.objectStore('offlineQueue');
                if (!queueStore.indexNames.contains('by-timestamp')) {
                    queueStore.createIndex('by-timestamp', 'timestamp');
                }
            }

            // Create preferences store
            if (!db.objectStoreNames.contains('preferences')) {
                db.createObjectStore('preferences');
            }

            // Create sync metadata store (new in v2)
            if (!db.objectStoreNames.contains('sync_metadata')) {
                const syncStore = db.createObjectStore('sync_metadata', { keyPath: 'key' });
                syncStore.createIndex('by-status', 'syncStatus');
                syncStore.createIndex('by-entity-type', 'entityType');
            }

            // Create conflict log store (new in v2)
            if (!db.objectStoreNames.contains('conflict_log')) {
                const conflictStore = db.createObjectStore('conflict_log', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                conflictStore.createIndex('by-resolution', 'resolution');
                conflictStore.createIndex('by-timestamp', 'timestamp');
            }
        },
    });

    return dbInstance;
}

// Cart operations
export async function addToCartDB(productId: string, quantity: number = 1) {
    const db = await initDB();
    const existing = await db.get('cart', productId);
    const now = Date.now();

    await db.put('cart', {
        productId,
        quantity: existing ? existing.quantity + quantity : quantity,
        addedAt: existing?.addedAt || now,
        updatedAt: now,
        version: (existing?.version || 0) + 1,
    });

    // Update sync metadata
    await updateSyncMetadata('cart', productId, 'pending');
}

export async function removeFromCartDB(productId: string) {
    const db = await initDB();
    await db.delete('cart', productId);
}

export async function updateCartQuantityDB(productId: string, quantity: number) {
    const db = await initDB();
    if (quantity <= 0) {
        await removeFromCartDB(productId);
    } else {
        const existing = await db.get('cart', productId);
        const now = Date.now();
        await db.put('cart', {
            productId,
            quantity,
            addedAt: existing?.addedAt || now,
            updatedAt: now,
            version: (existing?.version || 0) + 1,
        });
        await updateSyncMetadata('cart', productId, 'pending');
    }
}

export async function getCartItemsDB() {
    const db = await initDB();
    return await db.getAll('cart');
}

export async function clearCartDB() {
    const db = await initDB();
    await db.clear('cart');
}

// Wishlist operations
export async function addToWishlistDB(productId: string) {
    const db = await initDB();
    const existing = await db.get('wishlist', productId);
    await db.put('wishlist', {
        productId,
        addedAt: existing?.addedAt || Date.now(),
        version: (existing?.version || 0) + 1,
    });
    await updateSyncMetadata('wishlist', productId, 'pending');
}

export async function removeFromWishlistDB(productId: string) {
    const db = await initDB();
    await db.delete('wishlist', productId);
}

export async function getWishlistItemsDB() {
    const db = await initDB();
    return await db.getAll('wishlist');
}

export async function isInWishlistDB(productId: string): Promise<boolean> {
    const db = await initDB();
    const item = await db.get('wishlist', productId);
    return !!item;
}

// Product cache operations
export async function cacheProductDB(id: string, data: any) {
    const db = await initDB();
    const existing = await db.get('products', id);
    await db.put('products', {
        id,
        data,
        cachedAt: Date.now(),
        version: (existing?.version || 0) + 1,
    });
    await updateSyncMetadata('product', id, 'synced');
}

export async function getCachedProductDB(id: string) {
    const db = await initDB();
    const cached = await db.get('products', id);

    // Cache expires after 1 hour
    if (cached && Date.now() - cached.cachedAt < 60 * 60 * 1000) {
        return cached.data;
    }

    return null;
}

// Offline queue operations
export async function addToOfflineQueueDB(
    action: 'add_to_cart' | 'remove_from_cart' | 'add_to_wishlist' | 'remove_from_wishlist' | 'email_signup' | 'create_reservation' | 'cancel_reservation',
    data: any
) {
    const db = await initDB();
    const id = await db.add('offlineQueue', {
        action,
        data,
        timestamp: Date.now(),
        synced: 0,
        retryCount: 0,
    });
    console.log(`📥 Added to offline queue: ${action}`, { id, data });
    return id;
}

export async function getUnsyncedQueueItemsDB() {
    const db = await initDB();
    const allItems = await db.getAll('offlineQueue');
    return allItems.filter(item => item.synced === 0);
}

export async function markQueueItemSyncedDB(id: number) {
    const db = await initDB();
    const item = await db.get('offlineQueue', id);
    if (item) {
        item.synced = 1;
        await db.put('offlineQueue', item);
    }
}

export async function clearSyncedQueueItemsDB() {
    const db = await initDB();
    const allItems = await db.getAll('offlineQueue');
    const syncedItems = allItems.filter(item => item.synced === 1);

    for (const item of syncedItems) {
        if (item.id !== undefined) {
            await db.delete('offlineQueue', item.id);
        }
    }
}

// Preferences operations
export async function setPreferenceDB(key: string, value: any) {
    const db = await initDB();
    await db.put('preferences', value, key);
}

export async function getPreferenceDB(key: string) {
    const db = await initDB();
    return await db.get('preferences', key);
}

// Sync metadata operations
export async function updateSyncMetadata(
    entityType: 'cart' | 'wishlist' | 'product' | 'reservation' | 'user',
    entityId: string,
    status: 'synced' | 'pending' | 'conflict' | 'error',
    error?: string
) {
    try {
        const db = await initDB();
        const key = `${entityType}:${entityId}`;
        const existing = await db.get('sync_metadata', key);

        await db.put('sync_metadata', {
            key, // Add the key field
            entityType,
            entityId,
            lastSyncedAt: status === 'synced' ? Date.now() : (existing?.lastSyncedAt || 0),
            version: (existing?.version || 0) + 1,
            syncStatus: status,
            lastError: error,
        });
    } catch (error) {
        console.warn('Sync metadata update skipped:', error);
        // Don't throw - this is not critical for cart functionality
    }
}

export async function getSyncMetadata(entityType: string, entityId: string) {
    const db = await initDB();
    const key = `${entityType}:${entityId}`;
    return await db.get('sync_metadata', key);
}

export async function getPendingSyncItems() {
    const db = await initDB();
    return await db.getAllFromIndex('sync_metadata', 'by-status', 'pending');
}

export async function getConflictItems() {
    const db = await initDB();
    return await db.getAllFromIndex('sync_metadata', 'by-status', 'conflict');
}

// Conflict log operations
export async function logConflict(
    entityType: string,
    entityId: string,
    localVersion: any,
    serverVersion: any
) {
    const db = await initDB();
    const id = await db.add('conflict_log', {
        entityType,
        entityId,
        localVersion,
        serverVersion,
        resolution: 'pending',
        timestamp: Date.now(),
    });
    console.log(`⚠️ Conflict logged for ${entityType}:${entityId}`, { id });
    return id;
}

export async function resolveConflict(
    conflictId: number,
    resolution: 'local' | 'server' | 'manual',
    resolvedVersion?: any
) {
    const db = await initDB();
    const conflict = await db.get('conflict_log', conflictId);
    if (conflict) {
        conflict.resolution = resolution;
        conflict.resolvedVersion = resolvedVersion;
        conflict.resolvedAt = Date.now();
        await db.put('conflict_log', conflict);
        console.log(`✅ Conflict resolved: ${conflictId} (${resolution})`);
    }
}

export async function getPendingConflicts() {
    const db = await initDB();
    return await db.getAllFromIndex('conflict_log', 'by-resolution', 'pending');
}

export async function getResolvedConflicts() {
    const db = await initDB();
    const all = await db.getAll('conflict_log');
    return all.filter(c => c.resolution !== 'pending');
}

// Get sync status summary
export async function getSyncStatusSummary() {
    const db = await initDB();
    const allMetadata = await db.getAll('sync_metadata');
    const pendingConflicts = await getPendingConflicts();
    const unsyncedQueue = await getUnsyncedQueueItemsDB();

    return {
        pending: allMetadata.filter(m => m.syncStatus === 'pending').length,
        synced: allMetadata.filter(m => m.syncStatus === 'synced').length,
        conflicts: allMetadata.filter(m => m.syncStatus === 'conflict').length,
        errors: allMetadata.filter(m => m.syncStatus === 'error').length,
        queuedActions: unsyncedQueue.length,
        pendingConflicts: pendingConflicts.length,
    };
}

// Migration from localStorage
export async function migrateFromLocalStorage() {
    try {
        // Migrate cart
        const cartData = localStorage.getItem('cart');
        if (cartData) {
            const cart = JSON.parse(cartData);
            for (const [productId, quantity] of Object.entries(cart)) {
                await addToCartDB(productId, quantity as number);
            }
            console.log('✅ Cart migrated from localStorage to IndexedDB');
        }

        // Migrate wishlist
        const wishlistData = localStorage.getItem('wishlist');
        if (wishlistData) {
            const wishlist = JSON.parse(wishlistData);
            for (const productId of wishlist) {
                await addToWishlistDB(productId);
            }
            console.log('✅ Wishlist migrated from localStorage to IndexedDB');
        }

        // Migrate theme preference
        const theme = localStorage.getItem('theme');
        if (theme) {
            await setPreferenceDB('theme', theme);
            console.log('✅ Theme preference migrated to IndexedDB');
        }
    } catch (error) {
        console.error('Error migrating from localStorage:', error);
    }
}

// Initialize DB and migrate on first load
if (typeof window !== 'undefined') {
    initDB().then(() => {
        console.log('✅ IndexedDB initialized');
        // Check if migration is needed
        const migrated = localStorage.getItem('indexeddb_migrated');
        if (!migrated) {
            migrateFromLocalStorage().then(() => {
                localStorage.setItem('indexeddb_migrated', 'true');
            });
        }
    }).catch((error) => {
        console.error('Failed to initialize IndexedDB:', error);
    });
}
