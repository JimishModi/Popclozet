import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, Printer, QrCode, CheckCircle2 } from 'lucide-react';
import { qrCodeService } from '@/services/qrCodeService';

interface QRCodeDisplayProps {
    productId: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ productId }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadQRCode();
    }, [productId]);

    const loadQRCode = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Get QR code for product
            const qrCode = await qrCodeService.getQRCodeByProductId(productId);
            setQrCodeUrl(qrCode.qrCodeUrl || null);
            setQrCodeData(qrCode.qrCodeData);
        } catch (err) {
            console.error('❌ Failed to load QR code:', err);
            setError('Failed to load QR code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!qrCodeUrl) return;

        try {
            await qrCodeService.downloadQRCode(qrCodeUrl, `product-${productId}-qr`);
        } catch (err) {
            console.error('❌ Download failed:', err);
        }
    };

    const handlePrint = async () => {
        if (!qrCodeUrl) return;

        try {
            await qrCodeService.printQRCode(qrCodeUrl);
        } catch (err) {
            console.error('❌ Print failed:', err);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="py-6">
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-6 w-6" />
                    Product QR Code
                </CardTitle>
                <CardDescription>
                    Scan this QR code to access product hygiene information
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {qrCodeUrl && (
                    <>
                        <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-dashed">
                            <img
                                src={qrCodeUrl}
                                alt="Product QR Code"
                                className="w-64 h-64"
                            />
                        </div>

                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                QR code generated successfully! Admin and staff can scan this to view hygiene SOPs.
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={handleDownload} variant="outline" className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Download PNG
                            </Button>
                            <Button onClick={handlePrint} variant="outline" className="w-full">
                                <Printer className="mr-2 h-4 w-4" />
                                Print Label
                            </Button>
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs font-mono text-muted-foreground break-all">
                                {qrCodeData}
                            </p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
