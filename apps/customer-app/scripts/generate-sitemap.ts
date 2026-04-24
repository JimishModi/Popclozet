import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[sitemap] SUPABASE_SERVICE_ROLE_KEY not set, skipping sitemap generation');
    process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateSitemap() {
    console.log('[sitemap] Generating sitemap...');

    const baseUrl = 'https://www.popclozet.in';

    const staticPages = ['', '/catalog', '/about', '/faq', '/terms', '/privacy'];

    const { data: products } = await supabase
        .from('products')
        .select('slug')
        .eq('is_active', true);

    const { data: categories } = await supabase
        .from('categories')
        .select('slug')
        .eq('is_active', true);

    const urls = [
        ...staticPages.map(path => `<url><loc>${baseUrl}${path}</loc><changefreq>weekly</changefreq><priority>${path === '' ? '1.0' : '0.8'}</priority></url>`),
        ...(categories || []).map(cat => `<url><loc>${baseUrl}/catalog/${cat.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`),
        ...(products || []).map(prod => `<url><loc>${baseUrl}/product/${prod.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`),
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    const outputPath = join(import.meta.dirname, '..', 'public', 'sitemap.xml');
    writeFileSync(outputPath, sitemap, 'utf-8');
    console.log(`[sitemap] Written ${urls.length} URLs to ${outputPath}`);
}

generateSitemap().catch(console.error);