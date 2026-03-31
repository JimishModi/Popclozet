/**
 * ReceiptDownloadButton — Offline-capable receipt download + native sharing
 *
 * Loads receipt data from IndexedDB, generates a PDF in-browser using
 * @react-pdf/renderer, and provides download + share functionality.
 * Works fully offline once the order data is cached.
 */

import { useState, useEffect, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download, Share2, Loader2, FileText } from "lucide-react";
import { getReceiptDB } from "@/lib/db";
import type { ReceiptData } from "@/lib/db";
import { ReceiptPDF } from "./ReceiptPDF";

interface ReceiptDownloadButtonProps {
    orderId: string;
    /** Compact mode for smaller UI contexts */
    compact?: boolean;
}

export function ReceiptDownloadButton({ orderId, compact = false }: ReceiptDownloadButtonProps) {
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load receipt data from IndexedDB on mount
    useEffect(() => {
        async function loadReceipt() {
            try {
                const data = await getReceiptDB(orderId);
                if (data) {
                    setReceiptData(data);
                } else {
                    setError("Receipt not available yet");
                }
            } catch (err) {
                console.error("Failed to load receipt:", err);
                setError("Failed to load receipt");
            } finally {
                setIsLoading(false);
            }
        }
        loadReceipt();
    }, [orderId]);

    // Generate PDF blob
    const generatePDF = useCallback(async (): Promise<Blob | null> => {
        if (!receiptData) return null;

        setIsGenerating(true);
        setError(null);

        try {
            const blob = await pdf(<ReceiptPDF data={receiptData} />).toBlob();
            return blob;
        } catch (err) {
            console.error("PDF generation failed:", err);
            setError("Failed to generate PDF");
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, [receiptData]);

    // Download handler
    const handleDownload = useCallback(async () => {
        const blob = await generatePDF();
        if (!blob) return;

        // Create virtual link and trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `popclozet-Receipt-${orderId.slice(0, 8).toUpperCase()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [generatePDF, orderId]);

    // Share handler (Web Share API)
    const handleShare = useCallback(async () => {
        const blob = await generatePDF();
        if (!blob) return;

        const file = new File(
            [blob],
            `popclozet-Receipt-${orderId.slice(0, 8).toUpperCase()}.pdf`,
            { type: "application/pdf" }
        );

        // Check if native sharing with files is supported
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    title: "popclozet Receipt",
                    text: `Receipt for order #${orderId.slice(0, 8).toUpperCase()}`,
                    files: [file],
                });
                return;
            } catch (err: any) {
                if (err.name === "AbortError") return; // User cancelled
                console.warn("Share with files failed, falling back to download:", err);
            }
        }

        // Fallback: just download
        handleDownload();
    }, [generatePDF, orderId, handleDownload]);

    // Loading state
    if (isLoading) {
        return (
            <div className={`flex items-center gap-2 ${compact ? "" : "p-4 rounded-2xl bg-zinc-900 border border-zinc-800"}`}>
                <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                <span className="text-sm text-zinc-500">Loading receipt...</span>
            </div>
        );
    }

    // Error / not available
    if (error || !receiptData) {
        return null; // Silently hide if receipt isn't available
    }

    // Compact mode: single icon button
    if (compact) {
        return (
            <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Download Receipt"
            >
                {isGenerating ? (
                    <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : (
                    <Download className="w-5 h-5 text-zinc-400" />
                )}
            </button>
        );
    }

    // Full mode: card with download + share buttons
    return (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#f2546d]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#f2546d]" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white">Order Receipt</h3>
                    <p className="text-xs text-zinc-500">
                        Available offline • PDF format
                    </p>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#f2546d] text-white text-sm font-medium hover:bg-[#e04460] transition-colors disabled:opacity-50"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4" />
                            Download Receipt
                        </>
                    )}
                </button>

                {typeof navigator !== "undefined" && navigator.share && (
                    <button
                        onClick={handleShare}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
                        title="Share via WhatsApp, Email, etc."
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

export default ReceiptDownloadButton;
