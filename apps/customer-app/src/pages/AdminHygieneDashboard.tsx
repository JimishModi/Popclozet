import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2,
    QrCode,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Package,
    TrendingUp,
} from 'lucide-react';
import { authService } from '@/services/authService';
import { productService } from '@/services/productService';
import { hygieneSopService } from '@/services/hygieneSopService';
import { qrCodeService } from '@/services/qrCodeService';
import { productImportService } from '@/services/productImportService';

const AdminHygieneDashboard: React.FC = () => {
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalProducts: 0,
        withSOPs: 0,
        withQRCodes: 0,
        pendingSOPs: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    const [bulkResult, setBulkResult] = useState<any>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

    useEffect(() => {
        checkAuthAndLoadData();
    }, []);

    const checkAuthAndLoadData = async () => {
        try {
            const isAdmin = await authService.isAdmin();
            setIsAuthorized(isAdmin);

            if (isAdmin) {
                await loadDashboardData();
            }
        } catch (error) {
            console.error('❌ Authorization check failed:', error);
            setIsAuthorized(false);
        } finally {
            setIsLoading(false);
        }
    };

    const loadDashboardData = async () => {
        try {
            const allProducts = await productService.getAllProducts();
            setProducts(allProducts);

            // Get actual counts for QR codes
            const productsWithoutQR = await productService.getProductsWithoutQRCodes();
            const withQRCodes = allProducts.length - productsWithoutQR.length;

            // Calculate stats
            const withSOPs = allProducts.filter(p => p.hygieneSopId).length;
            const stats = {
                totalProducts: allProducts.length,
                withSOPs,
                withQRCodes,
                pendingSOPs: allProducts.length - withSOPs,
            };
            setStats(stats);
        } catch (error) {
            console.error('❌ Failed to load dashboard data:', error);
        }
    };

    const handleBulkGenerateSOPs = async () => {
        try {
            setIsBulkGenerating(true);
            setBulkResult(null);

            // Get products without SOPs
            const productsWithoutSOPs = products.filter(p => !p.hygieneSopId);

            if (productsWithoutSOPs.length === 0) {
                alert('All products already have hygiene SOPs!');
                return;
            }

            console.log(`🤖 Generating SOPs for ${productsWithoutSOPs.length} products...`);

            const result = await hygieneSopService.bulkGenerateSOPs(
                productsWithoutSOPs.map(p => ({
                    id: p.id,
                    category: productService.extractCategory(p), // Improved category extraction
                    gender: p.gender,
                    fabricHint: p.fabricHint,
                }))
            );

            setBulkResult(result);
            await loadDashboardData(); // Reload data
        } catch (error) {
            console.error('❌ Bulk generation failed:', error);
            alert('Failed to generate SOPs. Check console for details.');
        } finally {
            setIsBulkGenerating(false);
        }
    };

    const handleBulkGenerateQRCodes = async () => {
        try {
            setIsBulkGenerating(true);
            setBulkResult(null);

            // Get products without QR codes
            const productsWithoutQR = await productService.getProductsWithoutQRCodes();

            if (productsWithoutQR.length === 0) {
                alert('All products already have QR codes!');
                return;
            }

            console.log(`🤖 Generating QR codes for ${productsWithoutQR.length} products...`);

            const productIds = productsWithoutQR.map(p => p.id);
            const result = await qrCodeService.bulkGenerateQRCodes(productIds);

            setBulkResult(result);
            await loadDashboardData();
        } catch (error) {
            console.error('❌ Bulk QR generation failed:', error);
            alert('Failed to generate QR codes. Check console for details.');
        } finally {
            setIsBulkGenerating(false);
        }
    };

    const handleProcessAllExistingProducts = async () => {
        try {
            setIsBulkGenerating(true);
            setBulkResult(null);

            const confirmed = window.confirm(
                'This will generate SOPs and QR codes for ALL existing products that don\'t have them. This may take a while. Continue?'
            );

            if (!confirmed) return;

            console.log('🤖 Processing all existing products...');

            // Process SOPs first (pass productService to avoid circular dependency)
            const sopResult = await hygieneSopService.processAllExistingProducts(productService);
            console.log('✅ SOP processing complete:', sopResult);

            // Then process QR codes (pass productService to avoid circular dependency)
            const qrResult = await qrCodeService.processAllExistingProducts(productService);
            console.log('✅ QR code processing complete:', qrResult);

            setBulkResult({
                sopResult,
                qrResult,
                success: sopResult.success + qrResult.success,
                failed: sopResult.failed + qrResult.failed,
            });

            await loadDashboardData();
        } catch (error) {
            console.error('❌ Failed to process all existing products:', error);
            alert('Failed to process products. Check console for details.');
        } finally {
            setIsBulkGenerating(false);
        }
    };

    const handleImportAllFromConfig = async () => {
        try {
            setIsImporting(true);
            setImportResult(null);

            const confirmed = window.confirm(
                'This will import all products from the codebase (config/products.ts) into the database and generate QR codes + SOPs for each. This may take several minutes. Continue?'
            );

            if (!confirmed) return;

            console.log('🔄 Importing all products from config...');

            const result = await productImportService.importAllProductsFromConfig();

            setImportResult(result);
            await loadDashboardData();

            alert(`Import Complete!\n✅ Success: ${result.success}\n❌ Failed: ${result.failed}\n⏭️  Skipped: ${result.skipped}`);
        } catch (error) {
            console.error('❌ Failed to import products:', error);
            alert('Failed to import products. Check console for details.');
        } finally {
            setIsImporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                            Access Denied
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertDescription>
                                Admin access required. Please contact your system administrator.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">Hygiene Management Dashboard</h1>
                <p className="text-lg text-muted-foreground">
                    Manage hygiene SOPs and QR codes for your inventory
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Total Products</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <Package className="h-6 w-6 text-blue-500" />
                            {stats.totalProducts}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>With Hygiene SOPs</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                            {stats.withSOPs}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>With QR Codes</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <QrCode className="h-6 w-6 text-purple-500" />
                            {stats.withQRCodes}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Pending SOPs</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <AlertCircle className="h-6 w-6 text-amber-500" />
                            {stats.pendingSOPs}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Bulk Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-6 w-6" />
                        Bulk Actions
                    </CardTitle>
                    <CardDescription>
                        Generate hygiene SOPs and QR codes for multiple products at once
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Import All Products from Config */}
                    <Button
                        onClick={handleImportAllFromConfig}
                        disabled={isImporting || isBulkGenerating}
                        size="lg"
                        className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Importing Products from Codebase...
                            </>
                        ) : (
                            <>
                                <Package className="mr-2 h-5 w-5" />
                                Import All Products from Codebase (Generate QR + SOPs)
                            </>
                        )}
                    </Button>

                    {/* Process All Existing Products */}
                    <Button
                        onClick={handleProcessAllExistingProducts}
                        disabled={isBulkGenerating || isImporting}
                        size="lg"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        {isBulkGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Processing All Existing Products...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-5 w-5" />
                                Process All Existing Inventory (SOPs + QR Codes)
                            </>
                        )}
                    </Button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            onClick={handleBulkGenerateSOPs}
                            disabled={isBulkGenerating || stats.pendingSOPs === 0}
                            size="lg"
                            className="w-full"
                        >
                            {isBulkGenerating ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Generating SOPs...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    Generate SOPs for {stats.pendingSOPs} Products
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={handleBulkGenerateQRCodes}
                            disabled={isBulkGenerating}
                            variant="outline"
                            size="lg"
                            className="w-full"
                        >
                            {isBulkGenerating ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Generating QR Codes...
                                </>
                            ) : (
                                <>
                                    <QrCode className="mr-2 h-5 w-5" />
                                    Generate QR Codes for Missing Products
                                </>
                            )}
                        </Button>
                    </div>

                    {bulkResult && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                Bulk generation complete! Success: {bulkResult.success}, Failed: {bulkResult.failed}
                            </AlertDescription>
                        </Alert>
                    )}

                    {importResult && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                Import complete! ✅ Success: {importResult.success}, ❌ Failed: {importResult.failed}, ⏭️ Skipped: {importResult.skipped}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Product List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Product Inventory</CardTitle>
                            <CardDescription>
                                View all products and their hygiene SOP status
                            </CardDescription>
                        </div>
                        <Button variant="outline" asChild>
                            <a href="/#/products/qr-gallery">
                                <QrCode className="mr-2 h-4 w-4" />
                                View QR Gallery
                            </a>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {products.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No products found. Add products using the Product Intake page.
                            </p>
                        ) : (
                            products.map((product) => (
                                <div
                                    key={product.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="space-y-1 flex-1">
                                        <p className="font-semibold">{product.name}</p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline">{product.gender}</Badge>
                                            <Badge variant="outline">{product.eventCategory}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {product.hygieneSopId ? (
                                            <Badge className="bg-green-500">
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                SOP Ready
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                <AlertCircle className="mr-1 h-3 w-3" />
                                                No SOP
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminHygieneDashboard;
