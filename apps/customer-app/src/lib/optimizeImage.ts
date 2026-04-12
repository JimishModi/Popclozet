/**
 * optimizeImage.ts
 *
 * Supabase Storage supports on-the-fly image resizing via the
 * `/render/image/` endpoint (requires Pro plan with Image Transformations).
 *
 * Key: URLs MUST be deterministic. Same input → same output string every time.
 * This ensures the browser can cache and reuse images across renders/tabs.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

export interface ImageOptions {
    /** Output width in pixels (height auto-scales). Default: 600 */
    width?: number;
    /** Quality 1–100. Default: 75 */
    quality?: number;
    /** Resize behaviour. Default: 'contain' (scales down, no cropping) */
    resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Convert a Supabase `/object/public/` URL to its optimised `/render/image/`
 * equivalent with deterministic width/quality/resize params.
 *
 * Non-Supabase URLs are returned unchanged.
 *
 * IMPORTANT: This function is pure — same (url, options) always produces
 * the exact same output string. Never add Date.now(), random params, etc.
 */
export function optimizeImage(
    url: string | null | undefined,
    options: ImageOptions = {}
): string {
    if (!url) return '';

    // Only transform Supabase Storage URLs
    if (!url.includes('supabase.co/storage')) return url;

    const { width = 600, quality = 75, resize } = options;

    try {
        const parsed = new URL(url);

        // Switch from /object/public/ to /render/image/public/ for server-side transforms
        if (parsed.pathname.includes('/object/public/')) {
            parsed.pathname = parsed.pathname.replace('/object/public/', '/render/image/public/');
        }

        // Clear any existing params to ensure deterministic output
        parsed.search = '';
        parsed.searchParams.set('width', String(width));
        parsed.searchParams.set('quality', String(quality));
        // 'contain' scales down proportionally without cropping.
        // The browser's CSS object-fit handles aspect ratio display.
        parsed.searchParams.set('resize', resize ?? 'contain');
        return parsed.toString();
    } catch {
        return url;
    }
}

/** Preset for product card thumbnails (grid views) — 400px wide */
export const thumbImage = (url: string | null | undefined) =>
    optimizeImage(url, { width: 400, quality: 70 });

/** Preset for product detail / full-screen images — 900px wide */
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
