/**
 * optimizeImage.ts
 * 
 * Supabase Storage supports on-the-fly image resizing and compression via
 * URL query parameters — no extra service needed.
 * 
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 * 
 * A 4 MB JPEG at width=600, quality=75 typically comes back as 80–150 KB WebP.
 */

export interface ImageOptions {
    /** Output width in pixels (height auto-scales). Default: 600 */
    width?: number;
    /** Quality 1–100. Default: 75 */
    quality?: number;
    /** Resize behaviour. Default: 'cover' */
    resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Supabase Storage URL pattern:
 * https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * We rewrite these to /img/<bucket>/<path>?width=...&quality=...&resize=...
 * which is proxied via Vercel edge → Supabase render endpoint with CDN caching.
 */
const SUPABASE_STORAGE_RE = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/(?:object|render\/image)\/public\/(.+)/;

/**
 * Append Supabase image transform parameters to a storage URL and route
 * through the Vercel edge proxy (/img/*) for CDN caching.
 * Safe to call with any URL — non-Supabase URLs are returned unchanged.
 *
 * Usage:
 *   <img src={optimizeImage(product.images[0])} />
 *   <img src={optimizeImage(product.images[0], { width: 400, quality: 80 })} />
 */
export function optimizeImage(
    url: string | null | undefined,
    options: ImageOptions = {}
): string {
    if (!url) return '';

    // Only transform Supabase Storage URLs
    const match = url.match(SUPABASE_STORAGE_RE);
    if (!match) return url;

    const storagePath = match[1]; // e.g. "product-images/jacket.jpg"
    const { width = 600, quality = 75, resize = 'cover' } = options;

    // Route through Vercel edge proxy with transform params
    return `/img/${storagePath}?width=${width}&quality=${quality}&resize=${resize}`;
}

/** Preset for product card thumbnails (grid views) */
export const thumbImage = (url: string | null | undefined) =>
    optimizeImage(url, { width: 400, quality: 70 });

/** Preset for product detail / full-screen images */
export const fullImage = (url: string | null | undefined) =>
    optimizeImage(url, { width: 900, quality: 78 });

/**
 * Global set of image URLs that have already been loaded in this session.
 * Used to skip shimmer/fade-in for images the browser has cached.
 */
const _loadedUrls = new Set<string>();

/** Mark a URL as loaded (call from onLoad) */
export function markImageLoaded(url: string) {
    if (url) _loadedUrls.add(url);
}

/** Check if a URL was already loaded this session */
export function isImageLoaded(url: string): boolean {
    return _loadedUrls.has(url);
}

/**
 * Prefetch a list of image URLs in the background using invisible Image objects.
 * Browser caches them so subsequent <img src=...> renders are instant.
 */
export function prefetchImages(urls: (string | null | undefined)[], preset: 'thumb' | 'full' = 'thumb') {
    const optimize = preset === 'thumb' ? thumbImage : fullImage;
    for (const url of urls) {
        const optimized = optimize(url);
        if (optimized && !_loadedUrls.has(optimized)) {
            const img = new Image();
            img.src = optimized;
            img.onload = () => _loadedUrls.add(optimized);
        }
    }
}
