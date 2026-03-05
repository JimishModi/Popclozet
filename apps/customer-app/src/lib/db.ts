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
            category: string; // Added for indexing
            data: any;
            cachedAt: number;
            version: number;
        };
        indexes: { 'by-category': string };
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

    preferences: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'PopClozet';
const DB_VERSION = 3; // Incremented for category index in products

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
                const productStore = db.createObjectStore('products', { keyPath: 'id' });
                productStore.createIndex('by-category', 'category');
            } else if (oldVersion < 3) {
                // Add category index to existing products store
                const productStore = transaction.objectStore('products');
                if (!productStore.indexNames.contains('by-category')) {
                    productStore.createIndex('by-category', 'category');
                }
            }

            // Create reservations store
            if (!db.objectStoreNames.contains('reservations')) {
                db.createObjectStore('reservations', { keyPath: 'id' });
            }

            // Create preferences store
            if (!db.objectStoreNames.contains('preferences')) {
                db.createObjectStore('preferences');
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
        category: data.category || 'uncategorized',
        data,
        cachedAt: Date.now(),
        version: (existing?.version || 0) + 1,
    });
}

export async function getCachedProductDB(id: string) {
    const db = await initDB();
    const cached = await db.get('products', id);

    // Cache expires after 24 hours (increased from 1h for better persistence)
    if (cached && Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000) {
        return cached.data;
    }

    return null;
}

export async function getProductsByCategoryDB(category: string) {
    const db = await initDB();
    const cached = await db.getAllFromIndex('products', 'by-category', category);

    // Filter out expired items (older than 24h)
    const now = Date.now();
    return cached
        .filter(item => now - item.cachedAt < 24 * 60 * 60 * 1000)
        .map(item => item.data);
}

export async function cacheProductsBatchDB(products: any[]) {
    const db = await initDB();
    const tx = db.transaction('products', 'readwrite');
    const productStore = tx.objectStore('products');
    const now = Date.now();

    for (const p of products) {
        const id = p.id;
        const existing = await productStore.get(id);
        await productStore.put({
            id,
            category: p.category || 'uncategorized',
            data: p,
            cachedAt: now,
            version: (existing?.version || 0) + 1,
        });
    }
    await tx.done;
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
