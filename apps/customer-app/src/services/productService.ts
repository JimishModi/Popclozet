import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@popclozet/api-client';

// Gender and Event types
export type GenderCategory = 'mens' | 'womens' | 'unisex';
export type EventCategory = 'casual' | 'party' | 'cocktail' | 'formal' | 'street' | 'vacation' | 'wedding' | 'office';

// Product interface
export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    rentalPrice?: number;
    category: string;
    gender: GenderCategory;
    eventCategory: EventCategory;
    occasions?: string[];
    imageUrl: string;
    videoUrl?: string;
    color: string;
    sizes?: string[];
    brand?: string;
    rental_price?: number;
    deposit_amount?: string;
    images?: string[];
    leadTimeMinutes?: number;
    rating: number;
    stockQuantity?: number;
    isAvailable?: boolean;
    createdAt?: string;
    updatedAt?: string;
    // Discount fields
    discount_type?: 'percentage' | 'fixed_amount';
    discount_value?: number;
    discounted_price?: number;
    mrp?: number;
    earlyAccessUntil?: string | null;
    // Hygiene-related fields
    fabricType?: string;
    fabricHint?: string;
    hygieneSopId?: string;
    rentalCount?: number;
    lastCleanedAt?: string;
    conditionStatus?: 'excellent' | 'good' | 'fair' | 'needs_repair';
}

// IndexedDB Schema for offline storage
interface ProductDB extends DBSchema {
    products: {
        key: string;
        value: Product;
        indexes: {
            'by-gender': GenderCategory;
            'by-event': EventCategory;
            'by-gender-event': [GenderCategory, EventCategory];
        };
    };
    sync_queue: {
        key: number;
        value: {
            id?: number;
            action: 'create' | 'update' | 'delete';
            productId: string;
            data?: Partial<Product>;
            timestamp: number;
        };
    };
    metadata: {
        key: string;
        value: {
            key: string;
            lastSync: number;
            version: number;
        };
    };
    preferences: { // Added for caching unique brands
        key: string;
        value: {
            brands: string[];
            timestamp: number;
        };
    };
}

class ProductService {
    private db: IDBPDatabase<ProductDB> | null = null;
    private readonly DB_NAME = 'popclozet-products';
    private readonly DB_VERSION = 4; // Updated DB_VERSION to create preferences store
    private brandCache: string[] | null = null;
    private brandCacheTimestamp: number = 0;
    private readonly BRAND_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    private activeSearchController: AbortController | null = null;

    constructor() { }

    // Initialize IndexedDB
    async initDB(): Promise<IDBPDatabase<ProductDB>> {
        if (this.db) return this.db;

        this.db = await openDB<ProductDB>(this.DB_NAME, this.DB_VERSION, {
            upgrade(db) {
                // Products store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id' });
                    productStore.createIndex('by-gender', 'gender');
                    productStore.createIndex('by-event', 'eventCategory');
                    productStore.createIndex('by-gender-event', ['gender', 'eventCategory']);
                }

                // Sync queue store
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                }

                // Metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }

                // Preferences store (for brand caching)
                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences');
                }
            },
        });

        return this.db;
    }

    // Check if online
    private isOnline(): boolean {
        return navigator.onLine;
    }

    // Sync products from Supabase to IndexedDB
    async syncProducts(): Promise<void> {
        try {
            const db = await this.initDB();

            // Fetch all products from Supabase with discounts
            const { data: products, error } = await (supabase as any)
                .from('products')
                .select('*, product_discounts(*)')
                .eq('is_available', true);

            if (error) throw error;

            if (products && products.length > 0) {
                const tx = db.transaction('products', 'readwrite');
                const store = tx.objectStore('products');

                // Clear existing products and add new ones
                await store.clear();

                for (const product of products) {
                    await store.put(this.transformFromDB(product));
                }

                await tx.done;

                // Update last sync timestamp
                await db.put('metadata', {
                    key: 'lastSync',
                    lastSync: Date.now(),
                    version: this.DB_VERSION,
                });

                console.log(`✅ Synced ${products.length} products to IndexedDB`);
            }
        } catch (error) {
            console.error('❌ Error syncing products:', error);
            throw error;
        }
    }

    private transformFromDB(dbProduct: any): Product {
        return {
            id: dbProduct.id,
            name: dbProduct.name,
            description: dbProduct.description,
            price: parseFloat(dbProduct.rental_price ?? dbProduct.price ?? '0'),
            rentalPrice: dbProduct.rental_price ? parseFloat(dbProduct.rental_price) : undefined,
            mrp: dbProduct.mrp ? parseFloat(dbProduct.mrp) : undefined,
            deposit_amount: dbProduct.deposit_amount ? String(dbProduct.deposit_amount) : undefined,
            category: dbProduct.category || '',
            gender: (dbProduct.gender === 'men' ? 'mens' : (dbProduct.gender === 'women' ? 'womens' : dbProduct.gender)) as GenderCategory,
            eventCategory: (dbProduct.occasion?.[0] || dbProduct.category) as EventCategory, 
            occasions: dbProduct.occasion || [],
            imageUrl: dbProduct.images?.[0] || dbProduct.image_url || '',
            videoUrl: dbProduct.video_url,
            color: dbProduct.color || '',
            sizes: dbProduct.sizes_available
                ? (Array.isArray(dbProduct.sizes_available)
                    ? (typeof dbProduct.sizes_available[0] === 'object' ? dbProduct.sizes_available.map((s: any) => s.size) : dbProduct.sizes_available)
                    : (typeof dbProduct.sizes_available === 'object' ? Object.keys(dbProduct.sizes_available) : []))
                : (dbProduct.sizes || []),
            brand: dbProduct.brand,
            leadTimeMinutes: dbProduct.lead_time_minutes,
            rating: parseFloat(dbProduct.rating || '0'),
            stockQuantity: dbProduct.stock_quantity,
            isAvailable: dbProduct.is_available,
            createdAt: dbProduct.created_at,
            updatedAt: dbProduct.updated_at,
            // Hygiene fields
            fabricType: dbProduct.fabric_type,
            fabricHint: dbProduct.fabric_hint,
            hygieneSopId: dbProduct.hygiene_sop_id,
            rentalCount: dbProduct.rental_count,
            lastCleanedAt: dbProduct.last_cleaned_at,
            conditionStatus: dbProduct.condition_status,
            // Discount logic
            discount_type: dbProduct.product_discounts?.[0]?.discount_type || dbProduct.discount_type,
            discount_value: dbProduct.product_discounts?.[0]?.discount_value || dbProduct.discount_value,
            discounted_price: this.calculateDiscountedPrice(
                parseFloat(dbProduct.rental_price ?? dbProduct.price ?? '0'),
                dbProduct.product_discounts?.[0] || { discount_type: dbProduct.discount_type, discount_value: dbProduct.discount_value }
            ),
            earlyAccessUntil: dbProduct.early_access_until ?? null,
        };
    }

    private calculateDiscountedPrice(originalPrice: number, discount: any): number {
        if (!discount || !discount.discount_value) return originalPrice;

        let finalPrice = originalPrice;
        if (discount.discount_type === 'percentage') {
            finalPrice = originalPrice - (originalPrice * (discount.discount_value / 100));
        } else if (discount.discount_type === 'fixed_amount') {
            finalPrice = Math.max(0, originalPrice - discount.discount_value);
        }
        return Math.round(finalPrice);
    }

    private isOfflineVisible(product: Product): boolean {
        if (!product.earlyAccessUntil) return true;

        const unlockTime = Date.parse(product.earlyAccessUntil);
        return Number.isNaN(unlockTime) || unlockTime <= Date.now();
    }

    // Transform app product to database format
    private transformToDB(product: Partial<Product>): any {
        return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            rental_price: product.rentalPrice,
            gender: product.gender === 'mens' ? 'men' : (product.gender === 'womens' ? 'women' : product.gender),
            event_category: product.eventCategory,
            image_url: product.imageUrl,
            video_url: product.videoUrl,
            color: product.color,
            sizes: product.sizes,
            lead_time_minutes: product.leadTimeMinutes,
            rating: product.rating,
            stock_quantity: product.stockQuantity,
            is_available: product.isAvailable,
        };
    }

    // Get all products (online or offline)
    async getAllProducts(): Promise<Product[]> {
        if (this.isOnline()) {
            try {
                const { data, error } = await (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('is_available', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Cache in IndexedDB
                const db = await this.initDB();
                const tx = db.transaction('products', 'readwrite');
                for (const product of data || []) {
                    await tx.objectStore('products').put(this.transformFromDB(product));
                }
                await tx.done;

                return (data || []).map(this.transformFromDB);
            } catch (error) {
                console.warn('⚠️ Online fetch failed, falling back to offline cache:', error);
                return this.getProductsOffline();
            }
        } else {
            return this.getProductsOffline();
        }
    }

    // Get unique brands available in the database
    async getUniqueBrands(gender?: GenderCategory): Promise<string[]> {
        // Return memory cache if valid (only if no gender is specified, or handle gender caching)
        const now = Date.now();
        if (!gender && this.brandCache && this.brandCache.length > 0 && (now - this.brandCacheTimestamp < this.BRAND_CACHE_TTL)) {
            return this.brandCache;
        }

        if (this.isOnline()) {
            try {
                // Check IndexedDB cache first
                const db = await this.initDB();
                const cacheKey = gender ? `unique_brands_${gender}` : 'unique_brands';
                const cached = await db.get('preferences', cacheKey);
                if (cached && cached.brands && cached.brands.length > 0 && (now - cached.timestamp < this.BRAND_CACHE_TTL)) {
                    if (!gender) {
                        this.brandCache = cached.brands;
                        this.brandCacheTimestamp = cached.timestamp;
                    }
                    return cached.brands;
                }

                let query = (supabase as any)
                    .from('products')
                    .select('brand')
                    .eq('is_available', true);

                if (gender) {
                    const dbGender = gender === 'mens' ? 'men' : 'women';
                    query = query.eq('gender', dbGender);
                }

                const { data, error } = await query;

                if (error) throw error;

                const brands = Array.from(new Set(data?.map((p: any) => p.brand).filter(Boolean))) as string[];
                const sortedBrands = brands.sort();

                // Only update cache if we actually found brands
                if (sortedBrands.length > 0) {
                    if (!gender) {
                        this.brandCache = sortedBrands;
                        this.brandCacheTimestamp = now;
                    }
                    await db.put('preferences', { brands: sortedBrands, timestamp: now }, cacheKey);
                } else {
                    // If no brands found online, don't update cache, let it fall back
                    console.warn(`⚠️ No brands found in database query. Data count: ${data?.length || 0}`);
                }

                return sortedBrands;
            } catch (error) {
                console.warn('⚠️ Online brand fetch failed, falling back to local:', error);
                return this.getUniqueBrandsOffline(gender);
            }
        } else {
            return this.getUniqueBrandsOffline(gender);
        }
    }

    // Get unique brands from IndexedDB
    private async getUniqueBrandsOffline(gender?: GenderCategory): Promise<string[]> {
        const products = gender ? await this.getProductsByGender(gender) : await this.getProductsOffline();
        const brands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))) as string[];
        return brands.sort();
    }

    // Get products from IndexedDB (offline)
    private async getProductsOffline(): Promise<Product[]> {
        const db = await this.initDB();
        const products = await db.getAll('products');
        return products.filter(product => this.isOfflineVisible(product));
    }

    // Get products by gender
    async getProductsByGender(gender: GenderCategory): Promise<Product[]> {
        // Map app gender ('womens'/'mens') → DB gender ('women'/'men')
        const dbGender = gender === 'womens' ? 'women' : gender === 'mens' ? 'men' : gender;

        if (this.isOnline()) {
            try {
                const { data, error } = await (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('gender', dbGender)
                    .eq('is_available', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return (data || []).map((p: any) => this.transformFromDB(p));
            } catch (error) {
                console.warn('⚠️ Falling back to offline:', error);
                const db = await this.initDB();
                const products = await db.getAllFromIndex('products', 'by-gender', gender);
                return products.filter(product => this.isOfflineVisible(product));
            }
        } else {
            const db = await this.initDB();
            const products = await db.getAllFromIndex('products', 'by-gender', gender);
            return products.filter(product => this.isOfflineVisible(product));
        }
    }

    // Get products by event
    async getProductsByEvent(event: EventCategory): Promise<Product[]> {
        if (this.isOnline()) {
            try {
                const { data, error } = await (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('event_category', event)
                    .eq('is_available', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return (data || []).map(this.transformFromDB);
            } catch (error) {
                console.warn('⚠️ Falling back to offline:', error);
                const db = await this.initDB();
                const products = await db.getAllFromIndex('products', 'by-event', event);
                return products.filter(product => this.isOfflineVisible(product));
            }
        } else {
            const db = await this.initDB();
            const products = await db.getAllFromIndex('products', 'by-event', event);
            return products.filter(product => this.isOfflineVisible(product));
        }
    }

    // Get products by gender AND event
    async getProductsByGenderAndEvent(gender: GenderCategory, event: EventCategory): Promise<Product[]> {
        if (this.isOnline()) {
            try {
                const { data, error } = await (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('gender', gender)
                    .eq('event_category', event)
                    .eq('is_available', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return (data || []).map(this.transformFromDB);
            } catch (error) {
                console.warn('⚠️ Falling back to offline:', error);
                const db = await this.initDB();
                const products = await db.getAllFromIndex('products', 'by-gender-event', [gender, event]);
                return products.filter(product => this.isOfflineVisible(product));
            }
        } else {
            const db = await this.initDB();
            const products = await db.getAllFromIndex('products', 'by-gender-event', [gender, event]);
            return products.filter(product => this.isOfflineVisible(product));
        }
    }

    // Get product by ID
    async getProductById(id: string): Promise<Product | undefined> {
        if (this.isOnline()) {
            try {
                const { data, error } = await (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                return this.transformFromDB(data);
            } catch (error) {
                console.warn('⚠️ Falling back to offline:', error);
                const db = await this.initDB();
                const product = await db.get('products', id);
                return product && this.isOfflineVisible(product) ? product : undefined;
            }
        } else {
            const db = await this.initDB();
            const product = await db.get('products', id);
            return product && this.isOfflineVisible(product) ? product : undefined;
        }
    }

    // Search products (server-side with fallback)
    async searchProducts(query: string, filters?: {
        gender?: GenderCategory;
        event?: EventCategory;
        brand?: string;
    }): Promise<Product[]> {
        if (!query.trim() && !filters?.brand) return [];

        if (this.isOnline()) {
            // Cancel previous search
            if (this.activeSearchController) {
                this.activeSearchController.abort();
            }
            this.activeSearchController = new AbortController();

            try {
                let supabaseQuery = (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('is_available', true);

                if (query.trim()) {
                    // Search in multiple fields using 'or' with case-insensitive 'ilike'
                    supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,brand.ilike.%${query}%,description.ilike.%${query}%,color.ilike.%${query}%`);
                }

                if (filters?.gender) {
                    const dbGender = filters.gender === 'mens' ? 'men' : 'women';
                    supabaseQuery = supabaseQuery.eq('gender', dbGender);
                }

                if (filters?.event) {
                    supabaseQuery = supabaseQuery.eq('event_category', filters.event);
                }

                if (filters?.brand) {
                    supabaseQuery = supabaseQuery.eq('brand', filters.brand);
                }

                const { data, error } = await supabaseQuery.order('created_at', { ascending: false });

                if (error) throw error;
                return (data || []).map(this.transformFromDB);
            } catch (error) {
                console.warn('⚠️ Online search failed, falling back to local:', error);
                return this.searchProductsOffline(query, filters);
            }
        } else {
            return this.searchProductsOffline(query, filters);
        }
    }

    // Offline search fallback
    private async searchProductsOffline(query: string, filters?: {
        gender?: GenderCategory;
        event?: EventCategory;
        brand?: string;
    }): Promise<Product[]> {
        const allProducts = await this.getAllProducts();
        const lowerQuery = query.toLowerCase();

        return allProducts.filter(product => {
            const matchesQuery = !query ||
                product.name.toLowerCase().includes(lowerQuery) ||
                product.brand?.toLowerCase().includes(lowerQuery) ||
                product.description?.toLowerCase().includes(lowerQuery);

            const matchesGender = !filters?.gender || product.gender === filters.gender;
            const matchesEvent = !filters?.event || product.eventCategory === filters.event;
            const matchesBrand = !filters?.brand || product.brand === filters.brand;

            return matchesQuery && matchesGender && matchesEvent && matchesBrand;
        });
    }

    // Get search suggestions for autocomplete
    async getSearchSuggestions(query: string): Promise<{ type: 'brand' | 'product' | 'category'; text: string; subtext?: string }[]> {
        if (!query.trim()) return [];
        const q = query.toLowerCase();

        try {
            // In a real app, we might have specific tables for brands/categories or an RPC
            // For now, we'll fetch unique categories and brands and filter locally for speed,
            // or use simple ilike queries.

            const suggestions: { type: 'brand' | 'product' | 'category'; text: string; subtext?: string }[] = [];
            const seen = new Set<string>();

            // 1. Check brands
            const brands = await this.getUniqueBrands();
            for (const brand of brands) {
                if (brand.toLowerCase().includes(q)) {
                    suggestions.push({ type: 'brand', text: brand, subtext: 'Brand' });
                    seen.add(`brand:${brand}`);
                }
                if (suggestions.length >= 3) break;
            }

            // 2. Check categories (hardcoded list from schema)
            const categories = ['Casual', 'Party', 'Formal', 'Wedding', 'Streetwear', 'Sports'];
            for (const cat of categories) {
                if (cat.toLowerCase().includes(q)) {
                    suggestions.push({ type: 'category', text: cat, subtext: 'Category' });
                }
                if (suggestions.length >= 5) break;
            }

            // 3. Check product names (limited results)
            if (this.isOnline()) {
                const { data } = await (supabase as any)
                    .from('products')
                    .select('name, rental_price')
                    .ilike('name', `%${query}%`)
                    .limit(5);

                for (const p of data || []) {
                    if (!seen.has(`product:${p.name}`)) {
                        suggestions.push({ type: 'product', text: p.name, subtext: `₹${p.rental_price}` });
                        seen.add(`product:${p.name}`);
                    }
                }
            }

            return suggestions.slice(0, 8);
        } catch (error) {
            console.error('Error fetching search suggestions:', error);
            return [];
        }
    }

    // Get featured products
    async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
        const products = await this.getAllProducts();
        return products
            .sort((a, b) => b.rating - a.rating)
            .slice(0, limit);
    }

    // Get last sync time
    async getLastSyncTime(): Promise<number | null> {
        try {
            const db = await this.initDB();
            const metadata = await db.get('metadata', 'lastSync');
            return metadata?.lastSync || null;
        } catch {
            return null;
        }
    }

    // Get products without hygiene SOPs
    async getProductsWithoutSOPs(): Promise<Product[]> {
        try {
            const { data, error } = await (supabase as any)
                .from('products')
                .select('*')
                .is('hygiene_sop_id', null)
                .eq('is_available', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(this.transformFromDB);
        } catch (error) {
            console.error('❌ Failed to get products without SOPs:', error);
            // Fallback: filter from all products
            const allProducts = await this.getAllProducts();
            return allProducts.filter(p => !p.hygieneSopId);
        }
    }

    // Get products without QR codes
    async getProductsWithoutQRCodes(): Promise<Product[]> {
        try {
            // Get all products
            const allProducts = await this.getAllProducts();

            // Get all product IDs that have QR codes
            const { data: qrCodes, error } = await (supabase as any)
                .from('product_qr_codes')
                .select('product_id');

            if (error) throw error;

            const productsWithQR = new Set((qrCodes || []).map((qr: any) => qr.product_id));

            // Return products that don't have QR codes
            return allProducts.filter(p => !productsWithQR.has(p.id));
        } catch (error) {
            console.error('❌ Failed to get products without QR codes:', error);
            return [];
        }
    }

    // Extract category from product name or use event category as fallback
    extractCategory(product: Product): string {
        // Try to extract category from name (common clothing items)
        const name = product.name.toLowerCase();
        const categoryKeywords: Record<string, string> = {
            'dress': 'dress',
            'blazer': 'blazer',
            'suit': 'suit',
            'shirt': 'shirt',
            'kurta': 'kurta',
            'saree': 'saree',
            'lehenga': 'lehenga',
            'gown': 'gown',
            'skirt': 'skirt',
            'pants': 'pants',
            'trousers': 'pants',
            'jeans': 'jeans',
            'jacket': 'jacket',
            'coat': 'coat',
            'top': 'top',
            'blouse': 'blouse',
            't-shirt': 't-shirt',
            'tshirt': 't-shirt',
            'sweater': 'sweater',
            'hoodie': 'hoodie',
        };

        // Check for category keywords in name
        for (const [keyword, category] of Object.entries(categoryKeywords)) {
            if (name.includes(keyword)) {
                return category;
            }
        }

        // Fallback: use event category as category hint
        return product.eventCategory || 'clothing';
    }

    // Get recommended products based on category
    async getRecommendedProducts(category: string, excludeId: string, limit: number = 4): Promise<Product[]> {
        try {
            if (this.isOnline()) {
                const { data, error } = await (supabase as any)
                    .from('products')
                    .select('*, product_discounts(*)')
                    .eq('category', category)
                    .eq('is_available', true)
                    .neq('id', excludeId)
                    .limit(limit);

                if (error) throw error;
                return (data || []).map((p: any) => this.transformFromDB(p));
            } else {
                const allProducts = await this.getAllProducts();
                return allProducts
                    .filter(p => p.eventCategory === category && p.id !== excludeId)
                    .slice(0, limit);
            }
        } catch (error) {
            console.error('Error fetching recommended products:', error);
            return [];
        }
    }
}

// Export singleton instance
export const productService = new ProductService();
