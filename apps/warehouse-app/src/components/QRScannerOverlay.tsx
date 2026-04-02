import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertTriangle, RefreshCw, Upload, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';
import { getUnitByCode } from '../services/physicalUnitService';
import { ProductActionCard } from './ProductActionCard';

interface QRScannerOverlayProps {
    onClose: () => void;
}

const SCANNER_ELEMENT_ID = 'reader';
const CAMERA_SCAN_CONFIG = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
};

function isPdfFile(file: File) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function getCameraErrorMessage(error: any) {
    switch (error?.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            return 'Camera access was blocked. Enable browser permissions, upload a QR image/PDF, or use manual entry.';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            return 'No camera was found on this device. Upload a QR image/PDF or use manual entry instead.';
        case 'NotReadableError':
        case 'TrackStartError':
            return 'The camera is busy in another app. Close it and try again, or upload a QR image/PDF.';
        default:
            return 'Camera permission denied or unavailable. Please enable permissions in your browser, upload a QR image/PDF, or use manual entry.';
    }
}

function getFileScanErrorMessage(error: any) {
    const message = typeof error === 'string' ? error : error?.message || '';
    const normalized = message.toLowerCase();

    if (!message) {
        return 'No QR code found in the uploaded file.';
    }

    if (
        normalized.includes('not found') ||
        normalized.includes('no multiformat readers') ||
        normalized.includes('parse error') ||
        normalized.includes('code not found')
    ) {
        return 'No QR code found in the uploaded file.';
    }

    return message;
}

async function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string) {
    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) {
        throw new Error('Failed to render the PDF page for scanning.');
    }

    return new File([blob], fileName, { type: 'image/png' });
}

export function QRScannerOverlay({ onClose }: QRScannerOverlayProps) {
    const { showToast } = useToast();
    const [scannedItem, setScannedItem] = useState<any | null>(null);
    const [searching, setSearching] = useState(false);
    const [manualId, setManualId] = useState('');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [fileScanning, setFileScanning] = useState(false);
    const [fileScanStatus, setFileScanStatus] = useState<string | null>(null);
    const [fileScanError, setFileScanError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const isPausedRef = useRef(false);
    const isMountedRef = useRef(false);
    const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startingCameraRef = useRef(false);

    const clearPendingCameraStart = () => {
        if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
        }
    };

    const clearScannerCanvas = () => {
        try {
            scannerRef.current?.clear();
        } catch {
            // Html5Qrcode throws if there is nothing rendered yet.
        }
    };

    const stopCameraScanner = async () => {
        const scanner = scannerRef.current;
        if (!scanner) return;

        try {
            if (scanner.isScanning) {
                await scanner.stop();
            }
        } catch (error) {
            console.error('Failed to stop QR scanner:', error);
        } finally {
            clearScannerCanvas();
        }
    };

    const lookupUnit = async (code: string) => {
        if (searching || scannedItem) return;

        setSearching(true);

        try {
            if (scannerRef.current?.isScanning) {
                isPausedRef.current = true;
                scannerRef.current.pause(true);
            }
        } catch {
            // Ignore pause failures; lookup can still continue.
        }

        try {
            const item = await getUnitByCode(code);
            if (item) {
                setScannedItem(item);
                setManualId('');
                setFileScanError(null);
            } else {
                showToast(`Item not found: ${code}`, 'error');
                await resumeLiveScanning();
            }
        } catch (error: any) {
            showToast(error?.message || 'Lookup failed', 'error');
            await resumeLiveScanning();
        } finally {
            setSearching(false);
        }
    };

    const startCameraScanner = async () => {
        const scanner = scannerRef.current;
        if (!scanner || startingCameraRef.current || scanner.isScanning) return;

        startingCameraRef.current = true;
        clearScannerCanvas();

        try {
            await scanner.start(
                { facingMode: 'environment' },
                CAMERA_SCAN_CONFIG,
                (decodedText) => {
                    if (isMountedRef.current && !isPausedRef.current) {
                        void lookupUnit(decodedText);
                    }
                },
                () => { }
            );

            if (isMountedRef.current) {
                setCameraError(null);
            }
        } catch (error: any) {
            console.error('Environment camera failed:', error);

            try {
                await scanner.start(
                    { facingMode: 'user' },
                    CAMERA_SCAN_CONFIG,
                    (decodedText) => {
                        if (isMountedRef.current && !isPausedRef.current) {
                            void lookupUnit(decodedText);
                        }
                    },
                    () => { }
                );

                if (isMountedRef.current) {
                    setCameraError(null);
                }
            } catch (fallbackError: any) {
                console.error('Camera start failed entirely:', fallbackError);
                if (isMountedRef.current) {
                    setCameraError(getCameraErrorMessage(fallbackError));
                }
            }
        } finally {
            startingCameraRef.current = false;
        }
    };

    const resumeLiveScanning = async () => {
        const scanner = scannerRef.current;
        if (!scanner) return;

        if (scanner.isScanning) {
            if (isPausedRef.current) {
                try {
                    scanner.resume();
                    setCameraError(null);
                } catch (error) {
                    console.error('Failed to resume QR scanner:', error);
                    await stopCameraScanner();
                    await startCameraScanner();
                }
            }

            isPausedRef.current = false;
            return;
        }

        isPausedRef.current = false;
        await startCameraScanner();
    };

    const scanImageFile = async (file: File) => {
        const scanner = scannerRef.current;
        if (!scanner) {
            throw new Error('Scanner is still loading. Please try again.');
        }

        const decodedText = await scanner.scanFile(file, false);
        clearScannerCanvas();
        return decodedText;
    };

    const scanPdfFile = async (file: File) => {
        const scanner = scannerRef.current;
        if (!scanner) {
            throw new Error('Scanner is still loading. Please try again.');
        }

        const [{ getDocument, GlobalWorkerOptions }, workerSrcModule] = await Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);

        GlobalWorkerOptions.workerSrc = workerSrcModule.default;

        const loadingTask = getDocument({
            data: new Uint8Array(await file.arrayBuffer()),
        });
        const pdf = await loadingTask.promise;

        try {
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                if (!isMountedRef.current) {
                    return null;
                }

                setFileScanStatus(`Scanning PDF page ${pageNumber}/${pdf.numPages}`);

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                if (!context) {
                    continue;
                }

                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);

                await page.render({ canvas, canvasContext: context, viewport }).promise;
                page.cleanup();

                const pageImage = await canvasToPngFile(canvas, `${file.name}-page-${pageNumber}.png`);

                try {
                    const decodedText = await scanner.scanFile(pageImage, false);
                    clearScannerCanvas();
                    return decodedText;
                } catch {
                    clearScannerCanvas();
                }
            }

            return null;
        } finally {
            try {
                pdf.cleanup();
            } catch {
                // Cleanup is best-effort only.
            }
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        clearPendingCameraStart();
        setFileScanning(true);
        setFileScanError(null);
        setFileScanStatus(isPdfFile(file) ? 'Preparing PDF scan...' : 'Scanning uploaded image...');
        isPausedRef.current = true;

        try {
            await stopCameraScanner();

            let decodedText: string | null = null;
            if (isPdfFile(file)) {
                decodedText = await scanPdfFile(file);
            } else if (file.type.startsWith('image/')) {
                decodedText = await scanImageFile(file);
            } else {
                throw new Error('Please choose a QR image or PDF file.');
            }

            if (!decodedText) {
                await resumeLiveScanning();
                if (isMountedRef.current) {
                    setFileScanError('No QR code found in the uploaded file.');
                }
                return;
            }

            if (isMountedRef.current) {
                setFileScanStatus('QR found. Looking up item...');
            }

            await lookupUnit(decodedText);
        } catch (error: any) {
            console.error('File scan failed:', error);
            await resumeLiveScanning();
            if (isMountedRef.current) {
                setFileScanError(getFileScanErrorMessage(error));
            }
        } finally {
            clearScannerCanvas();
            if (isMountedRef.current) {
                setFileScanning(false);
                setFileScanStatus(null);
            }
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualId.trim()) {
            setFileScanError(null);
            void lookupUnit(manualId.trim());
        }
    };

    const handlePickerOpen = () => {
        setFileScanError(null);
        fileInputRef.current?.click();
    };

    const handleActionComplete = () => {
        setScannedItem(null);
        setFileScanError(null);
        void resumeLiveScanning();
    };

    const handleActionCardClose = () => {
        setScannedItem(null);
        setFileScanError(null);
        void resumeLiveScanning();
    };

    useEffect(() => {
        isMountedRef.current = true;

        const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = html5QrCode;

        startTimeoutRef.current = setTimeout(() => {
            void startCameraScanner();
        }, 250);

        return () => {
            isMountedRef.current = false;
            clearPendingCameraStart();

            try {
                if (html5QrCode.isScanning) {
                    html5QrCode.stop()
                        .catch(() => {})
                        .finally(() => {
                            try { html5QrCode.clear(); } catch {}
                        });
                } else {
                    try { html5QrCode.clear(); } catch {}
                }
            } catch (e) {
                try { html5QrCode.clear(); } catch {}
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const busyMessage = fileScanning
        ? fileScanStatus || 'Scanning uploaded file...'
        : searching
            ? 'Looking up item...'
            : null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-[400px] flex flex-col gap-4">
                <div className="relative w-full aspect-square rounded-2xl bg-black border border-zinc-800 shadow-2xl flex items-center justify-center overflow-hidden">
                    <div id={SCANNER_ELEMENT_ID} className="w-full h-full absolute inset-0 [&>video]:object-cover" />

                    {busyMessage && (
                        <div className="absolute inset-0 z-[105] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                            <RefreshCw size={32} className="text-warehouse-400 animate-spin" />
                            <p className="mt-3 text-sm font-medium text-white">{busyMessage}</p>
                        </div>
                    )}

                    {!busyMessage && cameraError && (
                        <div className="absolute inset-0 z-[105] bg-black/80 flex flex-col items-center justify-center p-6 text-center">
                            <AlertTriangle size={32} className="text-red-400 mb-3" />
                            <p className="text-sm font-medium text-white mb-2">Camera Unavailable</p>
                            <p className="text-xs text-zinc-400">{cameraError}</p>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-[110] p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form
                    onSubmit={handleManualSubmit}
                    className="relative z-10 bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-2 shadow-xl"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        QR not working? Upload an image/PDF or enter the ID manually
                    </label>

                    <button
                        type="button"
                        onClick={handlePickerOpen}
                        disabled={fileScanning || searching}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold hover:border-warehouse-500/50 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                    >
                        {fileScanning ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                Scanning File...
                            </>
                        ) : (
                            <>
                                <Upload size={14} />
                                Scan Image / PDF
                            </>
                        )}
                    </button>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={manualId}
                            onChange={(e) => setManualId(e.target.value.toUpperCase())}
                            placeholder="e.g. PC-ABCD-M-1234"
                            className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 text-white focus:outline-none focus:border-warehouse-500 focus:ring-1 focus:ring-warehouse-500 text-xs font-mono placeholder:text-zinc-600"
                        />
                        <button
                            type="submit"
                            disabled={!manualId.trim() || searching || fileScanning}
                            className="px-4 py-2.5 rounded-lg bg-warehouse-500 text-black text-xs font-bold disabled:opacity-50 hover:bg-warehouse-400 transition-colors"
                        >
                            Lookup
                        </button>
                    </div>

                    {fileScanError ? (
                        <p className="text-xs text-red-400">{fileScanError}</p>
                    ) : (
                        <p className="text-xs text-zinc-500">
                            PDF label downloads from intake and product profile can be scanned here directly.
                        </p>
                    )}
                </form>
            </div>

            <AnimatePresence>
                {scannedItem && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <ProductActionCard
                            item={scannedItem}
                            onClose={handleActionCardClose}
                            onActionComplete={handleActionComplete}
                        />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
