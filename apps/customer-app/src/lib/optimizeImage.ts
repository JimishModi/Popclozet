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
 * Append Supabase image transform parameters to a storage URL.
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
    if (!url.includes('supabase.co/storage')) return url;

    const { width = 600, quality = 75, resize = 'cover' } = options;

    try {
        const parsed = new URL(url);
        parsed.searchParams.set('width', String(width));
        parsed.searchParams.set('quality', String(quality));
        parsed.searchParams.set('resize', resize);
        return parsed.toString();
    } catch {
        return url; // Fallback to original if URL parsing fails
    }
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
