import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    Camera,
    AlertCircle,
    CheckCircle2,
    Scan,
    ShieldCheck,
    XCircle,
    RefreshCw,
    Maximize2
} from 'lucide-react';
import { qrCodeService } from '@/services/qrCodeService';
import { authService } from '@/services/authService';
import { productService } from '@/services/productService';
import { hygieneSopService } from '@/services/hygieneSopService';
import { HygieneSopViewer } from './HygieneSopViewer';

interface ScanResult {
    productId: string;
    productData: any;
    sopData: any;
}

export const QRScanner: React.FC = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    // Check authorization on mount
    React.useEffect(() => {
        checkAuthorization();
    }, []);

    const checkAuthorization = async () => {
        try {
            const isStaffOrAdmin = await authService.isStaffOrAdmin();
            setIsAuthorized(isStaffOrAdmin);

            if (!isStaffOrAdmin) {
                setError('Access denied. Admin or staff privileges required to scan QR codes.');
            }
        } catch (err) {
            setError('Failed to verify authorization');
            setIsAuthorized(false);
        }
    };

    const handleScan = async (result: any) => {
        if (!result || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            const qrCodeData = result[0]?.rawValue;
            if (!qrCodeData) {
                throw new Error('Invalid QR code');
            }

            console.log('📷 QR Code scanned:', qrCodeData);

            // Validate QR code
            const validation = await qrCodeService.validateQRCode(qrCodeData);
            if (!validation.valid || !validation.productId) {
                throw new Error('Invalid or unrecognized QR code');
            }

            // Fetch product data
            const productData = await productService.getProductById(validation.productId);
            if (!productData) {
                throw new Error('Product not found');
            }

            // Fetch hygiene SOP
            const sopData = await hygieneSopService.getSOPByProductId(validation.productId);
            if (!sopData) {
                throw new Error('Hygiene SOP not found for this product');
            }

            // Set scan result
            setScanResult({
                productId: validation.productId,
                productData,
                sopData,
            });

            setIsScanning(false);
        } catch (err) {
            console.error('❌ QR scan error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process QR code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleError = (error: any) => {
        console.error('❌ QR Scanner error:', error);
        setError('Camera access denied or not available. Please grant camera permissions.');
    };

    const startScanning = () => {
        setIsScanning(true);
        setScanResult(null);
        setError(null);
    };

    const stopScanning = () => {
        setIsScanning(false);
    };

    // Loading authorization check
    if (isAuthorized === null) {
        return (
            <Card className="overflow-hidden border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E3BBE6] to-[#A855F7] flex items-center justify-center">
                            <ShieldCheck className="h-8 w-8 text-white" />
                        </div>
                    </motion.div>
                    <p className="text-muted-foreground">Checking authorization...</p>
                </CardContent>
            </Card>
        );
    }

    // Access Denied State
    if (isAuthorized === false) {
        return (
            <Card className="overflow-hidden border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mx-auto mb-4"
                    >
                        <XCircle className="h-10 w-10 text-white" />
                    </motion.div>
                    <CardTitle className="text-2xl font-playfair text-destructive">Access Denied</CardTitle>
                    <CardDescription className="text-base">
                        You do not have permission to access the QR scanner
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            This feature is restricted to admin and staff users only. Please contact your administrator for access.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Scanner Card */}
            <Card className="overflow-hidden border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardHeader className="relative overflow-hidden pb-4 bg-gradient-to-r from-[#E3BBE6]/10 via-transparent to-[#C0E2AD]/10">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#A855F7]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E3BBE6] to-[#A855F7] flex items-center justify-center">
                            <Scan className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-playfair">QR & Barcode Scanner</CardTitle>
                            <CardDescription>
                                Scan product codes to view hygiene information
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4 p-6">
                    {/* Start Scanning Button */}
                    <AnimatePresence mode="wait">
                        {!isScanning && !scanResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                {/* Visual Indicator */}
                                <div className="relative mx-auto w-48 h-48">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.1, 1],
                                            opacity: [0.3, 0.5, 0.3]
                                        }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#E3BBE6]/30 to-[#A855F7]/30"
                                    />
                                    <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-[#A855F7]/40 flex items-center justify-center">
                                        <Camera className="w-16 h-16 text-[#A855F7]/50" />
                                    </div>
                                    {/* Corner brackets */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#A855F7] rounded-tl-xl" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#A855F7] rounded-tr-xl" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#A855F7] rounded-bl-xl" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#A855F7] rounded-br-xl" />
                                </div>

                                <Button
                                    onClick={startScanning}
                                    size="lg"
                                    className="w-full h-14 bg-gradient-to-r from-[#A855F7] to-[#7C3AED] hover:from-[#9333EA] hover:to-[#6D28D9] text-white font-semibold text-base shadow-lg shadow-[#A855F7]/25"
                                >
                                    <Camera className="mr-2 h-5 w-5" />
                                    Start Scanning
                                </Button>

                                <p className="text-xs text-center text-muted-foreground">
                                    Supports QR codes, barcodes, and multiple code formats
                                </p>
                            </motion.div>
                        )}

                        {/* Active Scanner */}
                        {isScanning && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="space-y-4"
                            >
                                <div className="relative aspect-square w-full max-w-md mx-auto overflow-hidden rounded-2xl bg-black">
                                    {/* Scanner */}
                                    <Scanner
                                        onScan={handleScan}
                                        onError={handleError}
                                        formats={[
                                            'qr_code',
                                            'code_128',
                                            'code_39',
                                            'code_93',
                                            'ean_13',
                                            'ean_8',
                                            'upc_a',
                                            'upc_e',
                                            'itf',
                                            'codabar',
                                            'data_matrix',
                                            'aztec',
                                            'pdf417'
                                        ]}
                                        constraints={{
                                            facingMode: 'environment',
                                        }}
                                        styles={{
                                            container: {
                                                width: '100%',
                                                height: '100%',
                                            },
                                        }}
                                    />

                                    {/* Scanning overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {/* Corner brackets */}
                                        <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-[#A855F7] rounded-tl-xl" />
                                        <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-[#A855F7] rounded-tr-xl" />
                                        <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-[#A855F7] rounded-bl-xl" />
                                        <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-[#A855F7] rounded-br-xl" />

                                        {/* Scanning line animation */}
                                        <motion.div
                                            animate={{ y: [0, 300, 0] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#A855F7] to-transparent"
                                        />
                                    </div>

                                    {/* Loading overlay */}
                                    <AnimatePresence>
                                        {isLoading && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                                            >
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                >
                                                    <Loader2 className="h-12 w-12 text-white" />
                                                </motion.div>
                                                <p className="text-white font-medium">Processing...</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <Button
                                    onClick={stopScanning}
                                    variant="outline"
                                    className="w-full h-12 border-[#A855F7]/50 hover:bg-[#A855F7]/10"
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Stop Scanning
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error Alert */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Success Result */}
                    <AnimatePresence>
                        {scanResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl bg-gradient-to-r from-[#C0E2AD]/20 to-[#22C55E]/10 border border-[#22C55E]/30 p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">QR Code Scanned Successfully!</p>
                                        <p className="text-sm text-muted-foreground">Product details loaded below</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>

            {/* SOP Viewer */}
            <AnimatePresence>
                {scanResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                    >
                        <HygieneSopViewer
                            productData={scanResult.productData}
                            sopData={scanResult.sopData}
                            onClose={() => {
                                setScanResult(null);
                            }}
                        />

                        <Button
                            onClick={startScanning}
                            variant="outline"
                            size="lg"
                            className="w-full mt-4 h-12 border-[#A855F7]/50 hover:bg-[#A855F7]/10"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Scan Another Code
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
