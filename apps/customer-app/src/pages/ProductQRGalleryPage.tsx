import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Loader2,
    QrCode,
    Package,
    CheckCircle2,
    Download,
    Printer,
    Eye,
    ArrowLeft,
    Grid3X3,
    Sparkles,
    Users,
    User,
    UserCircle2
} from 'lucide-react';
import { productService, GenderCategory } from '@/services/productService';
import { qrCodeService } from '@/services/qrCodeService';
import { hygieneSopService } from '@/services/hygieneSopService';
import { HygieneSopViewer } from '@/components/HygieneSopViewer';
import type { Product } from '@/services/productService';

interface ProductWithQR extends Product {
    qrCodeUrl?: string;
    hasQRCode: boolean;
    hasSOP: boolean;
}

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const ProductQRGalleryPage: React.FC = () => {
    const [products, setProducts] = useState<ProductWithQR[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<ProductWithQR[]>([]);
    const [selectedGender, setSelectedGender] = useState<GenderCategory | 'all'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<ProductWithQR | null>(null);
    const [sopData, setSopData] = useState<any>(null);
    const [isLoadingSOP, setIsLoadingSOP] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        filterProducts();
    }, [products, selectedGender]);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            const allProducts = await productService.getAllProducts();

            // Load QR codes for all products
            const productsWithQR = await Promise.all(
                allProducts.map(async (product) => {
                    try {
                        const qrCode = await qrCodeService.getQRCodeByProductId(product.id);
                        return {
                            ...product,
                            qrCodeUrl: qrCode.qrCodeUrl || undefined,
                            hasQRCode: true,
                            hasSOP: !!product.hygieneSopId,
                        };
                    } catch {
                        return {
                            ...product,
                            hasQRCode: false,
                            hasSOP: !!product.hygieneSopId,
                        };
                    }
                })
            );

            setProducts(productsWithQR);
        } catch (error) {
            console.error('❌ Failed to load products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterProducts = () => {
        if (selectedGender === 'all') {
            setFilteredProducts(products);
        } else {
            setFilteredProducts(products.filter(p => p.gender === selectedGender));
        }
    };

    const handleViewSOP = async (product: ProductWithQR) => {
        if (!product.hygieneSopId) {
            alert('This product does not have a hygiene SOP yet.');
            return;
        }

        try {
            setIsLoadingSOP(true);
            const sop = await hygieneSopService.getSOPByProductId(product.id);
            setSopData(sop);
            setSelectedProduct(product);
        } catch (error) {
            console.error('❌ Failed to load SOP:', error);
            alert('Failed to load hygiene SOP');
        } finally {
            setIsLoadingSOP(false);
        }
    };

    const handleViewQR = async (product: ProductWithQR) => {
        if (!product.hasQRCode) {
            alert('This product does not have a QR code yet.');
            return;
        }

        try {
            const qrCode = await qrCodeService.getQRCodeByProductId(product.id);
            setQrCodeUrl(qrCode.qrCodeUrl || null);
            setSelectedProduct(product);
        } catch (error) {
            console.error('❌ Failed to load QR code:', error);
        }
    };

    const handleDownloadQR = async (qrCodeUrl: string, productName: string) => {
        await qrCodeService.downloadQRCode(qrCodeUrl, `qr-${productName.replace(/\s+/g, '-')}`);
    };

    const handlePrintQR = async (qrCodeUrl: string) => {
        await qrCodeService.printQRCode(qrCodeUrl);
    };

    const stats = {
        total: products.length,
        mens: products.filter(p => p.gender === 'mens').length,
        womens: products.filter(p => p.gender === 'womens').length,
        unisex: products.filter(p => p.gender === 'unisex').length,
        withQR: products.filter(p => p.hasQRCode).length,
        withSOP: products.filter(p => p.hasSOP).length,
    };

    // Loading State
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EB76C2] to-[#A855F7] flex items-center justify-center mx-auto"
                    >
                        <Grid3X3 className="h-8 w-8 text-white" />
                    </motion.div>
                    <p className="text-muted-foreground">Loading products...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#EB76C2]/15 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#C0E2AD]/15 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
                {/* Header */}
                <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-7xl">
                        <Link to="/qr-hygiene">
                            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Hub
                            </Button>
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <QrCode className="h-4 w-4 text-[#EB76C2]" />
                            <span>Gallery</span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="container mx-auto px-4 py-8 max-w-7xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Page Header */}
                        <div className="text-center space-y-4">
                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl md:text-5xl font-playfair font-bold"
                            >
                                <span className="bg-gradient-to-r from-[#EB76C2] via-[#C084FC] to-[#7DD3FC] bg-clip-text text-transparent">
                                    Product QR Gallery
                                </span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-lg text-muted-foreground max-w-xl mx-auto"
                            >
                                View all products with QR codes. Scan to access hygiene SOPs.
                            </motion.p>
                        </div>

                        {/* Stats Cards */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
                        >
                            {[
                                { label: 'Total', value: stats.total, icon: Package, color: 'text-foreground' },
                                { label: "Men's", value: stats.mens, icon: User, color: 'text-blue-500' },
                                { label: "Women's", value: stats.womens, icon: UserCircle2, color: 'text-pink-500' },
                                { label: 'Unisex', value: stats.unisex, icon: Users, color: 'text-purple-500' },
                                { label: 'With QR', value: stats.withQR, icon: QrCode, color: 'text-[#22C55E]' },
                                { label: 'With SOP', value: stats.withSOP, icon: Sparkles, color: 'text-[#A855F7]' },
                            ].map((stat, index) => (
                                <motion.div
                                    key={stat.label}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 * index }}
                                >
                                    <Card className="border-0 bg-card/50 backdrop-blur-sm hover:bg-card transition-colors">
                                        <CardContent className="p-4 text-center">
                                            <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                                            <div className="text-2xl font-bold">{stat.value}</div>
                                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </motion.div>

                        {/* Filter Tabs */}
                        <Tabs value={selectedGender} onValueChange={(v) => setSelectedGender(v as GenderCategory | 'all')}>
                            <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 bg-muted/50 p-1 rounded-full">
                                <TabsTrigger value="all" className="rounded-full data-[state=active]:bg-[#EB76C2] data-[state=active]:text-white">
                                    All
                                </TabsTrigger>
                                <TabsTrigger value="mens" className="rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                                    Men's
                                </TabsTrigger>
                                <TabsTrigger value="womens" className="rounded-full data-[state=active]:bg-pink-500 data-[state=active]:text-white">
                                    Women's
                                </TabsTrigger>
                                <TabsTrigger value="unisex" className="rounded-full data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                                    Unisex
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value={selectedGender} className="mt-8">
                                {filteredProducts.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                    >
                                        <Card className="border-0 bg-card/50 backdrop-blur-sm">
                                            <CardContent className="py-16 text-center">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: "spring" }}
                                                    className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"
                                                >
                                                    <Package className="h-10 w-10 text-muted-foreground" />
                                                </motion.div>
                                                <h3 className="text-xl font-playfair font-bold mb-2">No products found</h3>
                                                <p className="text-muted-foreground mb-6">
                                                    Import products from codebase using the Admin Dashboard
                                                </p>
                                                <Link to="/admin/hygiene">
                                                    <Button variant="outline" className="border-[#EB76C2]/50 hover:bg-[#EB76C2]/10">
                                                        Go to Admin Dashboard
                                                    </Button>
                                                </Link>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        variants={staggerContainer}
                                        initial="hidden"
                                        animate="visible"
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                                    >
                                        {filteredProducts.map((product) => (
                                            <motion.div
                                                key={product.id}
                                                variants={fadeInUp}
                                                layout
                                            >
                                                <Card className="group overflow-hidden border-0 bg-card/80 backdrop-blur-sm hover:shadow-xl hover:shadow-[#EB76C2]/10 transition-all duration-500 hover:-translate-y-1">
                                                    {/* Product Image */}
                                                    <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                                                        <img
                                                            src={product.imageUrl || '/placeholder.svg'}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />

                                                        {/* Overlay gradient */}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                                        {/* Badges */}
                                                        <div className="absolute top-3 left-3 right-3 flex justify-between">
                                                            {product.hasSOP && (
                                                                <Badge className="bg-[#A855F7] text-white border-0">
                                                                    <Sparkles className="h-3 w-3 mr-1" />
                                                                    SOP
                                                                </Badge>
                                                            )}
                                                            {product.hasQRCode && (
                                                                <Badge className="bg-[#22C55E] text-white border-0 ml-auto">
                                                                    <QrCode className="h-3 w-3 mr-1" />
                                                                    QR
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {/* Quick Actions on Hover */}
                                                        <div className="absolute bottom-3 left-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                                                            {product.hasQRCode && (
                                                                <Button
                                                                    size="sm"
                                                                    className="flex-1 bg-white/90 text-black hover:bg-white"
                                                                    onClick={() => handleViewQR(product)}
                                                                >
                                                                    <QrCode className="h-4 w-4 mr-1" />
                                                                    QR
                                                                </Button>
                                                            )}
                                                            {product.hasSOP && (
                                                                <Button
                                                                    size="sm"
                                                                    className="flex-1 bg-white/90 text-black hover:bg-white"
                                                                    onClick={() => handleViewSOP(product)}
                                                                    disabled={isLoadingSOP}
                                                                >
                                                                    <Eye className="h-4 w-4 mr-1" />
                                                                    SOP
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Product Info */}
                                                    <CardContent className="p-4">
                                                        <h3 className="font-playfair font-bold text-base mb-2 line-clamp-1 group-hover:text-[#EB76C2] transition-colors">
                                                            {product.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Badge variant="outline" className="text-xs capitalize">
                                                                {product.gender}
                                                            </Badge>
                                                            <Badge variant="outline" className="text-xs capitalize">
                                                                {product.eventCategory}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-lg">₹{product.price}</span>
                                                            {product.rentalPrice && (
                                                                <span className="text-sm text-muted-foreground">
                                                                    Rent: ₹{product.rentalPrice}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </motion.div>
                </main>
            </div>

            {/* QR Code Dialog */}
            <AnimatePresence>
                {selectedProduct && qrCodeUrl && (
                    <Dialog open={!!qrCodeUrl} onOpenChange={() => setQrCodeUrl(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="font-playfair text-xl">
                                    QR Code - {selectedProduct.name}
                                </DialogTitle>
                                <DialogDescription>
                                    Scan this QR code to access hygiene SOP information
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex justify-center p-6 bg-white rounded-2xl border-2 border-dashed border-[#E3BBE6]"
                                >
                                    <img
                                        src={qrCodeUrl}
                                        alt="Product QR Code"
                                        className="w-56 h-56"
                                    />
                                </motion.div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="border-[#22C55E]/50 hover:bg-[#22C55E]/10"
                                        onClick={() => handleDownloadQR(qrCodeUrl, selectedProduct.name)}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-[#A855F7]/50 hover:bg-[#A855F7]/10"
                                        onClick={() => handlePrintQR(qrCodeUrl)}
                                    >
                                        <Printer className="mr-2 h-4 w-4" />
                                        Print
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>

            {/* SOP Viewer Dialog */}
            <AnimatePresence>
                {selectedProduct && sopData && (
                    <Dialog open={!!sopData} onOpenChange={(open) => !open && setSopData(null)}>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="font-playfair text-xl">
                                    Hygiene SOP - {selectedProduct.name}
                                </DialogTitle>
                                <DialogDescription>
                                    Standard Operating Procedure for cleaning and hygiene
                                </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4">
                                <HygieneSopViewer
                                    productData={selectedProduct}
                                    sopData={sopData}
                                    onClose={() => setSopData(null)}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProductQRGalleryPage;
