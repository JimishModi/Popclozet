import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, RefreshCw } from 'lucide-react';
import { getUnitByCode } from '../services/physicalUnitService';
import { ProductActionCard } from './ProductActionCard';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';

interface QRScannerOverlayProps {
    onClose: () => void;
}

export function QRScannerOverlay({ onClose }: QRScannerOverlayProps) {
    const { showToast } = useToast();
    const [scannedItem, setScannedItem] = useState<any | null>(null);
    const [searching, setSearching] = useState(false);
    const [manualId, setManualId] = useState('');
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;

        return () => {
            scanner.clear().catch(err => console.error("Failed to clear scanner", err));
        };
    }, []);

    const lookupUnit = async (code: string) => {
        if (searching || scannedItem) return;
        setSearching(true);
        try {
            const item = await getUnitByCode(code);
            if (item) {
                setScannedItem(item);
                scannerRef.current?.pause(true);
                setManualId('');
            } else {
                showToast(`Item not found: ${code}`, 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Lookup failed', 'error');
        } finally {
            setSearching(false);
        }
    };

    const onScanSuccess = async (decodedText: string) => {
        lookupUnit(decodedText);
    };

    function onScanFailure(error: any) {
        // quiet fail
    }

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualId.trim()) {
            lookupUnit(manualId.trim());
        }
    };

    const handleActionComplete = () => {
        setScannedItem(null);
        scannerRef.current?.resume();
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-[400px] flex flex-col gap-4">
                {/* Scanner Viewport */}
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl">
                    <div id="reader" className="w-full h-full" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-[110] p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    {searching && (
                        <div className="absolute inset-0 z-[105] bg-black/40 flex items-center justify-center">
                            <RefreshCw size={32} className="text-warehouse-400 animate-spin" />
                        </div>
                    )}
                </div>

                {/* Manual Fallback */}
                <form
                    onSubmit={handleManualSubmit}
                    className="relative z-10 bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-2 shadow-xl"
                >
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">QR Not working? Enter ID manually</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={manualId}
                            onChange={(e) => setManualId(e.target.value.toUpperCase())}
                            placeholder="e.g. PC-ABCD-M-1234"
                            className="flex-1 input-field h-10 text-xs font-mono"
                        />
                        <button
                            type="submit"
                            disabled={!manualId.trim() || searching}
                            className="px-4 rounded-lg bg-warehouse-500 text-black text-xs font-bold disabled:opacity-50"
                        >
                            Lookup
                        </button>
                    </div>
                </form>
            </div>

            <AnimatePresence>
                {scannedItem && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <ProductActionCard
                            item={scannedItem}
                            onClose={() => {
                                setScannedItem(null);
                                scannerRef.current?.resume();
                            }}
                            onActionComplete={handleActionComplete}
                        />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
