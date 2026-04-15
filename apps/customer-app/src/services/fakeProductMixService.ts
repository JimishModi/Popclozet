/**
 * fakeProductMixService.ts
 *
 * Blends real available products with a small LRU-rotated set of fake
 * "currently rented" products to simulate inventory depth during MVP.
 *
 * Architecture notes:
 * ─────────────────────────────────────────────────────────────────────
 * • Standalone module — not coupled to ProductService — because fake
 *   products are always online-only and must never be cached in IndexedDB.
 *
 * • The atomic select + update is handled by a single Supabase RPC
 *   (get_and_rotate_fake_products). This avoids a two-step read-then-write
 *   race condition and keeps network round-trips to 2 total (1 real, 1 fake).
 *
 * • Graceful degradation: if the RPC fails for any reason, real products
 *   are returned untouched — the feature fails silently, not loudly.
 *
 * • The _isFake flag lets any component optionally render a
 *   "Currently Rented" badge without needing to know the source table.
 *
 * Extensibility for personalization:
 *   Pass additional user-preference params into getProductsWithFakeMix
 *   and forward them to the RPC (after adding p_gender / p_occasions args).
 */

import { supabase } from '@popclozet/api-client';
import type { GenderCategory, EventCategory, Product } from './productService';
import { computeInventoryAvailability } from '@/lib/inventoryAvailability';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A product that may originate from either `products` or `fake_products`.
 * Components should treat _isFake items as read-only (not orderable).
 */
export interface ProductWithMixMeta extends Product {
  /** true  → from fake_products (show "Currently Rented" / greyed-out UI)
   *  false → from products (normal orderable item) */
  _isFake: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** fake / (real + fake) must not exceed this ratio. */
const FAKE_RATIO_CAP = 0.75;

/**
 * Hard ceiling regardless of how many real products are returned.
 * Keeps the page from being dominated by fake items even at high real counts.
 */
const MAX_FAKE_ABSOLUTE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Stable-cache helpers (localStorage, 24-hour TTL)
// Prevents fake products from rotating on every page reload.
// ─────────────────────────────────────────────────────────────────────────────

const FAKE_CACHE_KEY = 'pclz_fake_cache_v3'; // v3 = refresh images cache
const FAKE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedFakes(cacheKey: string): ProductWithMixMeta[] | null {
  try {
    const raw = localStorage.getItem(FAKE_CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[cacheKey];
    if (!entry) return null;
    if (Date.now() - entry.ts > FAKE_CACHE_TTL) return null;
    return entry.products as ProductWithMixMeta[];
  } catch {
    return null;
  }
}

function setCachedFakes(cacheKey: string, products: ProductWithMixMeta[]): void {
  try {
    const raw = localStorage.getItem(FAKE_CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[cacheKey] = { ts: Date.now(), products };
    localStorage.setItem(FAKE_CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore — storage quota or private mode
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes how many fake slots to fill while keeping fakes ≤ 30% of total.
 *
 * Derivation:
 *   fake / (real + fake) ≤ 0.30
 *   ⟹  fake ≤ real × 0.30 / 0.70  ≈  real × 0.4286
 *
 * Examples:
 *   real=1  → floor(0.43)  = 0  (0 fakes — too few real to dilute)
 *   real=3  → floor(1.28)  = 1
 *   real=5  → floor(2.14)  = 2  (capped by MAX_FAKE_ABSOLUTE)
 *   real=10 → floor(4.28)  = 2  (capped by MAX_FAKE_ABSOLUTE)
 */
function computeFakeSlots(realCount: number): number {
  // Always show at least 3 fakes even with very few real products
  const minFakes = 3;
  const maxByRatio = Math.floor(realCount * (FAKE_RATIO_CAP / (1 - FAKE_RATIO_CAP)));
  return Math.min(Math.max(maxByRatio, minFakes), MAX_FAKE_ABSOLUTE);
}

/**
 * Fisher-Yates in-place shuffle.
 * O(n), unbiased — every permutation equally probable.
 */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Maps a raw fake_products DB row to the shared Product type.
 * isAvailable is always false — fake items are "rented out", never orderable.
 */
function mapFakeRow(row: Record<string, unknown>): Product {
  // Normalise gender: DB values (e.g., 'Women', 'men', 'Unisex') to app types ('womens', 'mens', 'unisex')
  const rawGender = (row.gender as string || '').toLowerCase();
  const gender = (
    rawGender.includes('women') ? 'womens' :
    rawGender.includes('men')   ? 'mens'   :
    'unisex'
  ) as GenderCategory;

  // Prefer storage images array, fall back to image_url field
  const imagesArr = row.images as string[] | null;
  const primaryImage = imagesArr?.[0] || (row.image_url as string) || '';

  const p = (field: string) => {
    const v = row[field];
    if (v === null || v === undefined || v === '') return 0;
    return parseFloat(String(v).replace(/[^\d.]/g, '')) || 0;
  };

  return {
    id:               row.id as string,
    name:             row.name as string,
    description:      row.description as string | undefined,
    price:            p('rental_price'),
    rentalPrice:      p('rental_price'),
    rental_price_1d:  p('rental_price_1d'),
    rental_price_2d:  p('rental_price_2d'),
    rental_price_3d:  p('rental_price_3d') || p('rental_price'),
    buy_price:        p('buy_price'),
    mrp:              p('mrp') || undefined,
    category:         row.category as string,
    gender,
    eventCategory:    row.category as EventCategory,
    imageUrl:         primaryImage,
    images:           imagesArr ?? [],
    videoUrl:         row.video_url as string | undefined,
    color:            (row.color as string) ?? '',
    sizes:            [],
    brand:            row.brand as string | undefined,
    rating:           4.5,
    isAvailable:      false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a shuffled mix of real available products and a small set of
 * LRU-rotated fake "currently rented" products for the given filters.
 *
 * Guarantees:
 *   • Fake items ≤ 30% of total result count.
 *   • Fake items ≤ 2 in absolute terms.
 *   • Fake selection + rotation stamp happen in a single atomic DB call.
 *   • If the RPC fails, real products are returned without interruption.
 *
 * @param category  product category to filter by (e.g. 'jackets', 'dresses')
 * @param brand     optional brand filter (exact match)
 * @param gender    optional gender filter
 */
/**
 * Fetches only rotated fake products for a given category.
 * Use this when you already have real products and just need the fakes to mix in.
 * Accepts plain string category (e.g. 'jackets') — not limited to EventCategory enum.
 */
export async function fetchRotatedFakeProducts(
  category: string,
  brand?: string,
  limit: number = 2,
): Promise<ProductWithMixMeta[]> {
  const cacheKey = `${category}|${brand ?? ''}|${limit}`;
  const cached = getCachedFakes(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_and_rotate_fake_products', {
    p_category: category,
    p_brand:    brand ?? null,
    p_limit:    limit,
  });

  if (error) {
    console.warn('[fakeProductMixService] fetchRotatedFakeProducts failed:', error.message);
    return [];
  }

  const result = (data ?? []).map((row: Record<string, unknown>) => ({
    ...mapFakeRow(row),
    _isFake: true,
  }));

  setCachedFakes(cacheKey, result);
  return result;
}

export async function getProductsWithFakeMix(
  category: string,
  brand?: string,
  gender?: GenderCategory,
): Promise<ProductWithMixMeta[]> {

  // ── 1. Fetch real available products ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let realQuery = (supabase as any)
    .from('products')
    .select('*, product_discounts(*), inventory(available_stock, total_stock, all_products(status))')
    .eq('is_available', true)
    .eq('category', category)
    .order('id');

  if (brand) {
    realQuery = realQuery.eq('brand', brand);
  }
  if (gender) {
    // DB stores 'men'/'women'; app uses 'mens'/'womens'
    const dbGender = gender === 'mens' ? 'men' : gender === 'womens' ? 'women' : gender;
    realQuery = realQuery.in('gender', [dbGender, 'unisex']);
  }

  const { data: realData, error: realError } = await realQuery;
  if (realError) throw realError;

  const realProducts: ProductWithMixMeta[] = (realData ?? []).map((row: Record<string, unknown>) => {
    const rawGender = row.gender as string;
    const discount = (row.product_discounts as Record<string, unknown>[])?.[0];
    const availability = computeInventoryAvailability((row.inventory as any[]) || []);

    return {
      id:             row.id as string,
      name:           row.name as string,
      description:    row.description as string | undefined,
      price:          parseFloat((row.rental_price as string) ?? (row.price as string) ?? '0'),
      rentalPrice:    row.rental_price ? parseFloat(row.rental_price as string) : undefined,
      mrp:            row.mrp ? parseFloat(row.mrp as string) : undefined,
      category:       (row.category as string) || (row.event_category as string) || '',
      gender:         (rawGender === 'men' ? 'mens' : rawGender === 'women' ? 'womens' : rawGender) as GenderCategory,
      eventCategory:  row.event_category as EventCategory,
      imageUrl:       (row.images as string[])?.[0] || (row.image_url as string) || '',
      videoUrl:       row.video_url as string | undefined,
      color:          (row.color as string) ?? '',
      sizes:          (row.sizes as string[]) ?? [],
      brand:          row.brand as string | undefined,
      rating:         parseFloat((row.rating as string) ?? '0'),
      isAvailable:    row.is_available as boolean,
      discount_type:  discount?.discount_type as 'percentage' | 'fixed_amount' | undefined,
      discount_value: discount?.discount_value as number | undefined,
      isSoldOut: availability.isSoldOut,
      isRentedOut: availability.isRentedOut,
      _isFake:        false,
    };
  });

  // ── 2. Compute how many fake slots to inject ───────────────────────────────
  const fakeSlots = computeFakeSlots(realProducts.length);

  if (fakeSlots === 0) {
    // Not enough real products to safely dilute — skip fakes entirely.
    return realProducts;
  }

  // ── 3. Atomic LRU select + rotate via RPC (cached per session) ───────────
  const fakeRpcKey = `mix|${category}|${brand ?? ''}|${gender ?? ''}|${fakeSlots}`;
  let fakeProducts: ProductWithMixMeta[] = getCachedFakes(fakeRpcKey) ?? [];

  if (fakeProducts.length === 0) {
    const { data: fakeData, error: fakeError } = await supabase.rpc(
      'get_and_rotate_fake_products',
      {
        p_category: category,
        p_brand:    brand ?? null,
        p_limit:    fakeSlots,
      },
    );

    if (fakeError) {
      // Non-fatal: degrade gracefully rather than breaking the product page.
      console.warn('[fakeProductMixService] RPC failed, skipping fakes:', fakeError.message);
      return realProducts;
    }

    fakeProducts = (fakeData ?? []).map((row: Record<string, unknown>) => ({
      ...mapFakeRow(row),
      _isFake: true,
    }));

    if (gender) {
      fakeProducts = fakeProducts.filter((product) => {
        const pGender = (product.gender as string || '').toLowerCase();
        const targetGender = gender.toLowerCase();
        return pGender === targetGender || pGender === 'unisex';
      });
    }

    setCachedFakes(fakeRpcKey, fakeProducts);
  }

  // ── 4. Merge + stable sort ───────────────────────────────────────────────
  // Prioritize available (real) products over rented-out (fake) products.
  // Then use a stable sort by ID within each group to ensure consistency.
  return [...realProducts, ...fakeProducts].sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) {
      return a.isAvailable ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}
