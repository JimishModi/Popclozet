// src/pages/DeliveryTrackingPage.tsx
// Real-time delivery tracking page

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChevronLeft, Share2, Phone, MessageCircle } from 'lucide-react';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { DeliveryTracker } from '@/components/map/DeliveryTracker';
import { ReceiptDownloadButton } from '@/components/receipt/ReceiptDownloadButton';
import { getDeliveryOtp } from '@/services/deliveryOtpService';
import type { ProximityStatus } from '@/services/geofenceSubscription';

export default function DeliveryTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();

    const [otp, setOtp] = useState<string | null>(null);
    const [proximity, setProximity] = useState<ProximityStatus>('far');

    // Load delivery OTP
    useEffect(() => {
        if (orderId) {
            getDeliveryOtp(orderId).then(setOtp).catch(() => { });
        }
    }, [orderId]);

    if (!orderId) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex items-center justify-center h-full">
                    <p className="text-zinc-400">Order not found</p>
                </div>
            </MobileShell>
        );
    }

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Track my PopClozet order',
                    url,
                });
            } catch {
                // User cancelled or share failed
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(url);
        }
    };

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold">Track Order</h1>
                        <p className="text-xs text-zinc-500">#{orderId.slice(0, 8)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Compact receipt download in header */}
                    <ReceiptDownloadButton orderId={orderId} compact />
                    <button
                        onClick={handleShare}
                        className="p-2 rounded-full hover:bg-white/10"
                    >
                        <Share2 className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                <DeliveryTracker orderId={orderId} />

                {/* Receipt download card */}
                <div className="mt-6">
                    <ReceiptDownloadButton orderId={orderId} />
                </div>

                {/* Delivery OTP */}
                {otp && (
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#f2546d]/10 to-[#ff6078]/10 border border-[#f2546d]/30">
                        <h3 className="text-sm font-semibold text-white mb-1">Delivery Code</h3>
                        <p className="text-xs text-zinc-400 mb-3">Share this code with your rider to confirm delivery</p>
                        <div className="flex items-center justify-center gap-3">
                            {otp.split('').map((digit, i) => (
                                <div key={i} className="w-12 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-[#f2546d]">{digit}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Proximity Badge */}
                {proximity !== 'far' && (
                    <div className={`mt-4 p-3 rounded-xl text-center text-sm font-medium ${proximity === 'nearby'
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                        : 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                        }`}>
                        {proximity === 'nearby'
                            ? '🎉 Your rider is almost at your door!'
                            : '🏍️ Your rider is on the way!'}
                    </div>
                )}

                {/* Contact options */}
                <div className="mt-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-semibold text-white mb-3">Need Help?</h3>
                    <div className="flex gap-3">
                        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors">
                            <Phone className="w-4 h-4" />
                            Call
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                            Chat
                        </button>
                    </div>
                </div>

                {/* Order actions */}
                <div className="mt-4 space-y-3">
                    <button className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
                        View Order Details
                    </button>
                    <button className="w-full py-3 rounded-xl bg-zinc-900 border border-[#ff4d6d]/30 text-sm text-[#ff4d6d] hover:bg-[#ff4d6d]/10 transition-colors">
                        Report an Issue
                    </button>
                </div>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
}

