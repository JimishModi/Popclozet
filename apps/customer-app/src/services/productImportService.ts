import { supabase } from '@popclozet/api-client';
import { PRODUCTS } from '@/config/products';
import { hygieneSopService } from './hygieneSopService';
import { qrCodeService } from './qrCodeService';
import { productService } from './productService';

interface ImportResult {
    success: number;
    failed: number;
    skipped: number;
    results: Array<{
        productId: string;
        name: string;
        success: boolean;
        error?: string;
        hasQR?: boolean;
        hasSOP?: boolean;
    }>;
}

class ProductImportService {
    /**
     * Import all products from config/products.ts into the database
     * and generate QR codes and SOPs for each product
     */
    async importAllProductsFromConfig(): Promise<ImportResult> {
        const results: ImportResult['results'] = [];
        let success = 0;
        let failed = 0;
        let skipped = 0;

        console.log(`🔄 Starting import of ${PRODUCTS.length} products from config...`);

        for (const configProduct of PRODUCTS) {
            try {
                // Check if product exists by name and gender (more reliable than ID)
                const existingByName = await this.findProductByNameAndGender(configProduct.name, configProduct.gender);
                if (existingByName) {
                    console.log(`⏭️  Product ${configProduct.name} already exists with ID ${existingByName.id}, ensuring QR code and SOP exist...`);

                    // Always ensure QR code and SOP exist for existing products
                    let hasQR = false;
                    let hasSOP = false;

                    // Check and generate QR code
                    try {
                        await qrCodeService.getQRCodeByProductId(existingByName.id);
                        hasQR = true;
                        console.log(`✅ QR code already exists for: ${configProduct.name}`);
                    } catch {
                        try {
                            await qrCodeService.generateProductQRCode(existingByName.id);
                            hasQR = true;
                            console.log(`✅ Generated QR code for: ${configProduct.name}`);
                        } catch (qrError) {
                            console.error(`❌ Failed to generate QR for ${configProduct.name}:`, qrError);
                        }
                    }

                    // Check and generate SOP (this also ensures QR code if SOP generation includes it)
                    try {
                        await hygieneSopService.getSOPByProductId(existingByName.id);
                        hasSOP = true;
                        console.log(`✅ SOP already exists for: ${configProduct.name}`);
                    } catch {
                        try {
                            const category = productService.extractCategory({
                                id: existingByName.id,
                                name: existingByName.name,
                                gender: existingByName.gender,
                                eventCategory: existingByName.eventCategory,
                                price: existingByName.price,
                                rating: existingByName.rating,
                                imageUrl: existingByName.imageUrl,
                            } as any);

                            // Generate SOP (this also generates QR code automatically)
                            await hygieneSopService.generateAndStoreSOP({
                                productId: existingByName.id,
                                category: category,
                                gender: existingByName.gender,
                            });
                            hasSOP = true;
                            hasQR = true; // SOP generation also creates QR code
                            console.log(`✅ Generated SOP and QR code for: ${configProduct.name}`);
                        } catch (sopError) {
                            console.error(`❌ Failed to generate SOP for ${configProduct.name}:`, sopError);
                        }
                    }

                    skipped++;
                    results.push({
                        productId: existingByName.id,
                        name: configProduct.name,
                        success: hasQR && hasSOP,
                        hasQR,
                        hasSOP,
                    });
                    continue;
                }

                // Transform config product to database format
                // Don't set ID - let database generate UUID
                const dbProduct = {
                    name: configProduct.name,
                    description: `${configProduct.category} ${configProduct.gender} ${configProduct.eventCategory} outfit`,
                    price: configProduct.price,
                    rental_price: Math.round(configProduct.price * 0.3), // 30% of price as rental
                    gender: configProduct.gender,
                    event_category: configProduct.eventCategory,
                    image_url: configProduct.image,
                    video_url: configProduct.video || null,
                    color: configProduct.color,
                    sizes: configProduct.sizes || null,
                    lead_time_minutes: configProduct.leadTimeMinutes || 60,
                    rating: configProduct.rating,
                    stock_quantity: 1,
                    is_available: true,
                };

                // Insert product into database
                const { data: product, error: insertError } = await supabase
                    .from('products')
                    .insert(dbProduct)
                    .select()
                    .single();

                if (insertError) {
                    throw insertError;
                }

                console.log(`✅ Imported product: ${configProduct.name} (${product.id})`);

                // Generate SOP and QR code (SOP generation also creates QR code)
                let hasQR = false;
                let hasSOP = false;

                try {
                    const category = productService.extractCategory({
                        id: product.id,
                        name: product.name,
                        gender: product.gender,
                        eventCategory: product.event_category,
                        price: product.price,
                        rating: product.rating,
                        imageUrl: product.image_url,
                    } as any);

                    // Generate SOP (this also generates QR code automatically)
                    await hygieneSopService.generateAndStoreSOP({
                        productId: product.id,
                        category: category,
                        gender: product.gender,
                    });
                    hasSOP = true;
                    hasQR = true; // SOP generation also creates QR code
                    console.log(`✅ Generated SOP and QR code for: ${configProduct.name}`);
                } catch (sopError) {
                    console.error(`❌ Failed to generate SOP for ${configProduct.name}, trying QR only:`, sopError);

                    // If SOP generation fails, at least try to generate QR code
                    try {
                        await qrCodeService.generateProductQRCode(product.id);
                        hasQR = true;
                        console.log(`✅ Generated QR code for: ${configProduct.name}`);
                    } catch (qrError) {
                        console.error(`❌ Failed to generate QR code for ${configProduct.name}:`, qrError);
                    }
                }

                results.push({
                    productId: product.id,
                    name: configProduct.name,
                    success: true,
                    hasQR,
                    hasSOP,
                });
                success++;

                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ Failed to import product ${configProduct.name}:`, error);
                results.push({
                    productId: configProduct.id,
                    name: configProduct.name,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                failed++;
            }
        }

        console.log(`✅ Import complete! Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`);

        return {
            success,
            failed,
            skipped,
            results,
        };
    }

    /**
     * Find product by name and gender (to handle cases where IDs don't match)
     */
    private async findProductByNameAndGender(name: string, gender: string): Promise<any | null> {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('name', name)
                .eq('gender', gender)
                .single();

            if (error || !data) return null;

            // Transform to app format
            return {
                id: data.id,
                name: data.name,
                gender: data.gender,
                eventCategory: data.event_category,
                price: parseFloat(data.price),
                rating: parseFloat(data.rating),
                imageUrl: data.image_url,
            };
        } catch {
            return null;
        }
    }

    /**
     * Get import statistics
     */
    async getImportStats(): Promise<{
        totalInConfig: number;
        imported: number;
        byGender: {
            mens: number;
            womens: number;
            unisex: number;
        };
    }> {
        const totalInConfig = PRODUCTS.length;
        const allProducts = await productService.getAllProducts();

        // Check which config products are in database
        const importedIds = new Set(allProducts.map(p => p.id));
        const imported = PRODUCTS.filter(p => importedIds.has(p.id)).length;

        const byGender = {
            mens: PRODUCTS.filter(p => p.gender === 'mens').length,
            womens: PRODUCTS.filter(p => p.gender === 'womens').length,
            unisex: PRODUCTS.filter(p => p.gender === 'unisex').length,
        };

        return {
            totalInConfig,
            imported,
            byGender,
        };
    }
    /**
     * Update existing product names in the database to match the config file
     * This is useful when product names have been corrected in the config
     */
    async updateProductNamesFromConfig(): Promise<{
        updated: number;
        failed: number;
        results: Array<{ oldName: string; newName: string; success: boolean; error?: string }>;
    }> {
        const results: Array<{ oldName: string; newName: string; success: boolean; error?: string }> = [];
        let updated = 0;
        let failed = 0;

        // Define the specific corrections needed (old name -> product from config)
        const nameCorrectionsByImage: Record<string, string> = {
            // Map image URLs to the correct product names from config
            'photo-1503342217505-b0a15ec3261c': 'Black Graphic Tee',        // Was "Leather Jacket"
            'photo-1544441893-675973e31985': 'Grey Trousers Set',           // Was "Casual Denim Jacket"
            'IMG_7905': 'Orange Graphic Hoodie',                            // Was "Vintage Thrift Jacket"
            'IMG_7920': 'White Graphic Shirt',                              // Was "Retro Denim Jacket"
            'IMG_7911': 'Brown Knit Vest',                                  // Was "Classic Thrift Find"
        };

        console.log('🔄 Starting product name corrections...');

        // Fetch all products from database
        const { data: allProducts, error: fetchError } = await supabase
            .from('products')
            .select('id, name, image_url');

        if (fetchError || !allProducts) {
            console.error('❌ Failed to fetch products:', fetchError);
            return { updated: 0, failed: 0, results: [] };
        }

        for (const product of allProducts) {
            // Check if this product's image matches any of our corrections
            const imageUrl = product.image_url || '';

            for (const [imageKey, correctName] of Object.entries(nameCorrectionsByImage)) {
                if (imageUrl.includes(imageKey) && product.name !== correctName) {
                    console.log(`📝 Updating "${product.name}" -> "${correctName}"`);

                    try {
                        const { error: updateError } = await supabase
                            .from('products')
                            .update({ name: correctName })
                            .eq('id', product.id);

                        if (updateError) {
                            throw updateError;
                        }

                        results.push({
                            oldName: product.name,
                            newName: correctName,
                            success: true,
                        });
                        updated++;
                        console.log(`✅ Updated: "${product.name}" -> "${correctName}"`);
                    } catch (err) {
                        results.push({
                            oldName: product.name,
                            newName: correctName,
                            success: false,
                            error: err instanceof Error ? err.message : 'Unknown error',
                        });
                        failed++;
                        console.error(`❌ Failed to update ${product.name}:`, err);
                    }
                    break; // Found match, move to next product
                }
            }
        }

        console.log(`✅ Name corrections complete! Updated: ${updated}, Failed: ${failed}`);
        return { updated, failed, results };
    }
}

export const productImportService = new ProductImportService();
