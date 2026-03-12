import QRCode from 'qrcode';
import { supabase } from '@popclozet/api-client';

export interface QRCodeData {
    id: string;
    productId: string;
    qrCodeData: string;
    qrCodeUrl?: string;
    createdAt: string;
}

class QRCodeService {
    // Generate QR code data URL
    async generateQRCodeImage(data: string): Promise<string> {
        try {
            const qrCodeUrl = await QRCode.toDataURL(data, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
                errorCorrectionLevel: 'H',
            });
            return qrCodeUrl;
        } catch (error) {
            console.error('❌ QR code generation failed:', error);
            throw error;
        }
    }

    // Generate unique QR code for product
    async generateProductQRCode(productId: string): Promise<QRCodeData> {
        try {
            // Get the current domain (works for both dev and production)
            const baseUrl = window.location.origin;

            // Create a URL that points to the mobile product detail page
            const productUrl = `${baseUrl}/product/${productId}`;

            // Use the URL as QR code data so scanning redirects to the product page
            const qrCodeData = productUrl;

            // Generate QR code image
            const qrCodeUrl = await this.generateQRCodeImage(qrCodeData);

            // Store in database
            const { data, error } = await supabase
                .from('product_qr_codes')
                .insert({
                    product_id: productId,
                    qr_code_data: qrCodeData,
                    qr_code_url: qrCodeUrl,
                })
                .select()
                .single();

            if (error) {
                // If QR code already exists, return existing one
                if (error.code === '23505') {
                    return await this.getQRCodeByProductId(productId);
                }
                throw error;
            }

            console.log('✅ QR code generated for product:', productId);

            return {
                id: data.id,
                productId: data.product_id,
                qrCodeData: data.qr_code_data,
                qrCodeUrl: data.qr_code_url,
                createdAt: data.created_at,
            };
        } catch (error) {
            console.error('❌ Failed to generate QR code:', error);
            throw error;
        }
    }

    // Get QR code by product ID
    async getQRCodeByProductId(productId: string): Promise<QRCodeData> {
        try {
            const { data, error } = await supabase
                .from('product_qr_codes')
                .select('*')
                .eq('product_id', productId)
                .single();

            if (error) throw error;

            return {
                id: data.id,
                productId: data.product_id,
                qrCodeData: data.qr_code_data,
                qrCodeUrl: data.qr_code_url,
                createdAt: data.created_at,
            };
        } catch (error) {
            console.error('❌ Failed to get QR code:', error);
            throw error;
        }
    }

    // Validate and decode QR code
    async validateQRCode(qrCodeData: string): Promise<{ valid: boolean; productId?: string }> {
        try {
            // First, check if it's a URL (new format)
            if (qrCodeData.includes('/product/')) {
                // Extract product ID from URL
                const urlParts = qrCodeData.split('/product/');
                if (urlParts.length === 2) {
                    const productId = urlParts[1].split('?')[0]; // Remove query params if any
                    return {
                        valid: true,
                        productId: productId,
                    };
                }
            }

            // Check if QR code exists in database (for both old and new formats)
            const { data, error } = await supabase
                .from('product_qr_codes')
                .select('product_id')
                .eq('qr_code_data', qrCodeData)
                .single();

            if (error || !data) {
                return { valid: false };
            }

            return {
                valid: true,
                productId: data.product_id,
            };
        } catch (error) {
            console.error('❌ QR code validation failed:', error);
            return { valid: false };
        }
    }

    // Regenerate QR code for product
    async regenerateQRCode(productId: string): Promise<QRCodeData> {
        try {
            // Delete existing QR code
            await supabase
                .from('product_qr_codes')
                .delete()
                .eq('product_id', productId);

            // Generate new QR code
            return await this.generateProductQRCode(productId);
        } catch (error) {
            console.error('❌ Failed to regenerate QR code:', error);
            throw error;
        }
    }

    // Bulk generate QR codes for multiple products
    async bulkGenerateQRCodes(productIds: string[]): Promise<{
        success: number;
        failed: number;
        results: Array<{ productId: string; success: boolean; error?: string }>;
    }> {
        const results: Array<{ productId: string; success: boolean; error?: string }> = [];
        let success = 0;
        let failed = 0;

        console.log(`🤖 Starting bulk QR code generation for ${productIds.length} products...`);

        for (let i = 0; i < productIds.length; i++) {
            const productId = productIds[i];
            try {
                // Check if QR code already exists
                try {
                    await this.getQRCodeByProductId(productId);
                    // QR code exists, skip
                    results.push({ productId, success: true });
                    success++;
                    continue;
                } catch {
                    // QR code doesn't exist, generate it
                }

                await this.generateProductQRCode(productId);
                results.push({ productId, success: true });
                success++;
            } catch (error) {
                // If error is that QR code already exists, count as success
                if (error instanceof Error && error.message.includes('already exists')) {
                    results.push({ productId, success: true });
                    success++;
                } else {
                    console.error(`❌ Failed to generate QR code for product ${productId}:`, error);
                    results.push({
                        productId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    failed++;
                }
            }
        }

        console.log(`✅ Bulk QR generation complete: ${success} success, ${failed} failed`);

        return { success, failed, results };
    }

    // Automatically process all existing products that need QR codes
    // Note: productService parameter is injected to avoid circular dependencies
    async processAllExistingProducts(productService: any): Promise<{
        success: number;
        failed: number;
        results: Array<{ productId: string; success: boolean; error?: string }>;
    }> {
        const productsWithoutQR = await productService.getProductsWithoutQRCodes();

        if (productsWithoutQR.length === 0) {
            console.log('✅ All products already have QR codes');
            return { success: 0, failed: 0, results: [] };
        }

        console.log(`🔍 Found ${productsWithoutQR.length} products without QR codes`);

        const productIds = productsWithoutQR.map((p: any) => p.id);
        return await this.bulkGenerateQRCodes(productIds);
    }

    // Download QR code as PNG
    async downloadQRCode(qrCodeUrl: string, filename: string): Promise<void> {
        try {
            const link = document.createElement('a');
            link.href = qrCodeUrl;
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('❌ Failed to download QR code:', error);
            throw error;
        }
    }

    // Print QR code
    async printQRCode(qrCodeUrl: string): Promise<void> {
        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) throw new Error('Failed to open print window');

            printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code</title>
            <style>
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
              }
              img {
                max-width: 100%;
                height: auto;
              }
            </style>
          </head>
          <body>
            <img src="${qrCodeUrl}" alt="QR Code" />
          </body>
        </html>
      `);

            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        } catch (error) {
            console.error('❌ Failed to print QR code:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const qrCodeService = new QRCodeService();
