import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the unified database schema for offline-first architecture
interface popclozetDB extends DBSchema {
    cart: {
        key: string;
        value: {
            productId: string;  // stored as "{userId}:{rawProductId}:{size}:{plan}"
            quantity: number;
            pricingPlan: string;
            addedAt: number;
            updatedAt: number;
            version: number;
        };
    };
    wishlist: {
        key: string;
        value: {
            productId: string;  // stored as "{userId}:{rawProductId}"
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

    receipts: {
        key: string;
        value: ReceiptData;
    };

    preferences: {
        key: string;
        value: any;
    };
}

export interface ReceiptItem {
    name: string;
    brand?: string;
    size: string;
    quantity: number;
    days: number;
    rentalPrice: number;
}

export interface ReceiptData {
    orderId: string;
    placedAt: string;
    subtotal: number;
    discount?: number;
    deliveryFee: number;
    total: number;
    paymentMethod?: string;
    deliveryAddress: string;
    rentalStartDate: string;
    rentalEndDate: string;
    items: ReceiptItem[];
}

const DB_NAME = 'popclozet';
const DB_VERSION = 4; // Incremented for receipts store

let dbPromise: Promise<IDBPDatabase<popclozetDB>> | null = null;

// Initialize the database
export function initDB(): Promise<IDBPDatabase<popclozetDB>> {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = openDB<popclozetDB>(DB_NAME, DB_VERSION, {
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

            // Create receipts store
            if (!db.objectStoreNames.contains('receipts')) {
                db.createObjectStore('receipts', { keyPath: 'orderId' });
            }
        },
    });

    return dbPromise;
}

/* -----------------------------------------------------------------------
   KEY HELPERS — scope cart/wishlist records by user
   Key format:  "{userId}:{rawProductId}"
   For anonymous / no user, fall back to "anon:{rawProductId}"
----------------------------------------------------------------------- */

const ANON_PREFIX = 'anon';

function cartKey(userId: string | null | undefined, productId: string): string {
    return `${userId || ANON_PREFIX}:${productId}`;
}

function fullCartKey(userId: string | null | undefined, productId: string, size: string, plan: string): string {
    return `${userId || ANON_PREFIX}:${productId}:${size}:${plan}`;
}

/** Strip the userId prefix and return just the raw product id */
function stripPrefix(key: string): string {
    const idx = key.indexOf(':');
    return idx === -1 ? key : key.slice(idx + 1);
}

// Cart operations

export async function addToCartDB(productId: string, size: string, plan: string, quantity: number = 1, userId?: string | null) {
    const db = await initDB();
    const key = fullCartKey(userId, productId, size, plan);
    const existing = await db.get('cart', key);
    const now = Date.now();

    await db.put('cart', {
        productId: key,
        quantity: existing ? existing.quantity + quantity : quantity,
        pricingPlan: plan,
        addedAt: existing?.addedAt || now,
        updatedAt: now,
        version: (existing?.version || 0) + 1,
    });
}

export async function removeFromCartDB(productId: string, size: string, plan: string, userId?: string | null) {
    const db = await initDB();
    await db.delete('cart', fullCartKey(userId, productId, size, plan));
}

export async function updateCartQuantityDB(productId: string, size: string, plan: string, quantity: number, userId?: string | null) {
    const db = await initDB();
    const key = fullCartKey(userId, productId, size, plan);
    if (quantity <= 0) {
        await db.delete('cart', key);
    } else {
        const existing = await db.get('cart', key);
        const now = Date.now();
        await db.put('cart', {
            productId: key,
            quantity,
            pricingPlan: plan,
            addedAt: existing?.addedAt || now,
            updatedAt: now,
            version: (existing?.version || 0) + 1,
        });
    }
}

export async function getCartItemsDB(userId?: string | null) {
    const db = await initDB();
    const prefix = `${userId || ANON_PREFIX}:`;
    const allItems = await db.getAll('cart');
    // Return only items that belong to this user
    return allItems
        .filter(item => item.productId.startsWith(prefix))
        .map(item => {
            const parts = item.productId.split(':');
            return {
                ...item,
                productId: parts[1],
                size: parts[2],
                plan: parts[3]
            };
        });
}

export async function clearCartDB() {
    const db = await initDB();
    await db.clear('cart');
}

/** Clear only this user's cart items */
export async function clearUserCartDB(userId: string) {
    const db = await initDB();
    const prefix = `${userId}:`;
    const tx = db.transaction('cart', 'readwrite');
    const allKeys = await tx.store.getAllKeys();
    await Promise.all(
        allKeys
            .filter((k) => (k as string).startsWith(prefix))
            .map((k) => tx.store.delete(k))
    );
    await tx.done;
}

// Wishlist operations

export async function addToWishlistDB(productId: string, userId?: string | null) {
    const db = await initDB();
    const key = cartKey(userId, productId);
    const existing = await db.get('wishlist', key);
    await db.put('wishlist', {
        productId: key,
        addedAt: existing?.addedAt || Date.now(),
        version: (existing?.version || 0) + 1,
    });
}

export async function removeFromWishlistDB(productId: string, userId?: string | null) {
    const db = await initDB();
    await db.delete('wishlist', cartKey(userId, productId));
}

export async function getWishlistItemsDB(userId?: string | null) {
    const db = await initDB();
    const prefix = `${userId || ANON_PREFIX}:`;
    const allItems = await db.getAll('wishlist');
    return allItems
        .filter(item => item.productId.startsWith(prefix))
        .map(item => ({ ...item, productId: stripPrefix(item.productId) }));
}

export async function isInWishlistDB(productId: string, userId?: string | null): Promise<boolean> {
    const db = await initDB();
    const item = await db.get('wishlist', cartKey(userId, productId));
    return !!item;
}

/** Clear only this user's wishlist items */
export async function clearUserWishlistDB(userId: string) {
    const db = await initDB();
    const prefix = `${userId}:`;
    const tx = db.transaction('wishlist', 'readwrite');
    const allKeys = await tx.store.getAllKeys();
    await Promise.all(
        allKeys
            .filter((k) => (k as string).startsWith(prefix))
            .map((k) => tx.store.delete(k))
    );
    await tx.done;
}

/** Clear all local data (cart + wishlist) for a specific user */
export async function clearUserDataDB(userId: string) {
    await Promise.all([
        clearUserCartDB(userId),
        clearUserWishlistDB(userId),
    ]);
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

// Receipt operations
export async function saveReceiptDB(data: ReceiptData) {
    const db = await initDB();
    await db.put('receipts', data);
}

export async function getReceiptDB(orderId: string): Promise<ReceiptData | undefined> {
    const db = await initDB();
    return await db.get('receipts', orderId);
}

// Migration from localStorage
export async function migrateFromLocalStorage() {
    try {
        // Migrate cart
        const cartData = localStorage.getItem('cart');
        if (cartData) {
            const cart = JSON.parse(cartData);
            for (const [productId, quantity] of Object.entries(cart)) {
                // For migration, we assume 3d plan and a default size if not present
                const [pid, size] = productId.includes('_') ? productId.split('_') : [productId, 'S'];
                await addToCartDB(pid, size, '3d', quantity as number);
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
