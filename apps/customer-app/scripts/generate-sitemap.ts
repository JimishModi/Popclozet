// apps/customer-app/scripts/generate-sitemap.ts
// Generates public/sitemap.xml at build time. Routes here MUST match the
// router table in apps/customer-app/src/App.tsx — drift here means crawlers
// will hit dead ends and 404s.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://www.popclozet.in';

// Public, indexable routes only. Private routes (cart, checkout, profile,
// orders, auth/*, admin/*, qr-*) are intentionally excluded.
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
    { path: '', changefreq: 'daily', priority: '1.0' },
    { path: '/home', changefreq: 'daily', priority: '1.0' },
    { path: '/collections', changefreq: 'daily', priority: '0.9' },
    { path: '/brands', changefreq: 'weekly', priority: '0.8' },
    { path: '/closet', changefreq: 'weekly', priority: '0.7' },
    { path: '/live-closet', changefreq: 'weekly', priority: '0.7' },
    { path: '/how-it-works', changefreq: 'monthly', priority: '0.7' },
    { path: '/about-us', changefreq: 'monthly', priority: '0.6' },
    { path: '/shop/men', changefreq: 'daily', priority: '0.8' },
    { path: '/shop/women', changefreq: 'daily', priority: '0.8' },
    { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
    { path: '/terms', changefreq: 'yearly', priority: '0.3' },
    { path: '/cookies', changefreq: 'yearly', priority: '0.3' },
];

function urlEntry(path: string, changefreq: string, priority: string): string {
    return `  <url><loc>${BASE_URL}${path}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

async function generateSitemap() {
    console.log('[sitemap] Generating sitemap...');

    const urls: string[] = STATIC_PAGES.map(p => urlEntry(p.path, p.changefreq, p.priority));

    // Pull live product IDs if Supabase service role is available — gracefully
    // degrade to static-only if not (e.g. local builds without the secret).
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
        try {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            const { data: products, error: productsErr } = await supabase
                .from('products')
                .select('id')
                .eq('is_active', true);

            if (productsErr) {
                console.warn('[sitemap] product fetch failed:', productsErr.message);
            } else if (products) {
                for (const p of products) {
                    urls.push(urlEntry(`/product/${p.id}`, 'weekly', '0.6'));
                }
            }
        } catch (e: any) {
            console.warn('[sitemap] supabase fetch threw, continuing with static pages only:', e?.message);
        }
    } else {
        console.warn('[sitemap] SUPABASE_SERVICE_ROLE_KEY not set — emitting static pages only.');
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

    const outputPath = join(import.meta.dirname, '..', 'public', 'sitemap.xml');
    writeFileSync(outputPath, sitemap, 'utf-8');
    console.log(`[sitemap] Written ${urls.length} URLs to ${outputPath}`);
}

generateSitemap().catch((err) => {
    console.error('[sitemap] generation failed:', err);
    process.exit(1);
});
