import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { XCircle, RotateCcw, ShoppingBag, Clock, Phone, CheckCircle2 } from "lucide-react";
import { supabase } from "@popclozet/api-client";

export default function PaymentFailedPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const orderId = searchParams.get("orderId");
    const reason = searchParams.get("reason"); // verification_failed | timeout | initiation_failed | not_captured | (empty = cancelled)

    // Money MAY have been charged if verification failed or timeout occurred
    const moneyMayBeCharged = reason === "verification_failed" || reason === "timeout";

    const [orderStatus, setOrderStatus] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(moneyMayBeCharged);
    const pollCount = useRef(0);

    // ── Auto-poll order status for verification_failed cases ──
    // The webhook may confirm the order at any moment. Poll every 5 seconds
    // for up to 2 minutes to catch it and redirect to success.
    useEffect(() => {
        if (!orderId || !moneyMayBeCharged) return;

        const checkStatus = async () => {
            try {
                const { data: order } = await supabase
                    .from("orders")
                    .select("status")
                    .eq("id", orderId)
                    .single();

                if (order) {
                    setOrderStatus(order.status);
                    if (["confirmed", "paid", "packed", "ready_for_pickup", "dispatched", "delivered", "completed"].includes(order.status)) {
                        // Webhook confirmed the order! Navigate to success.
                        setIsPolling(false);
                        navigate(`/order-confirmed/${orderId}`, { replace: true });
                        return true; // stop polling
                    }
                }
            } catch {
                // Network error — keep polling
            }
            return false;
        };

        // Initial check
        checkStatus();

        // Poll every 5 seconds for up to 2 minutes (24 polls)
        const interval = setInterval(async () => {
            pollCount.current++;
            const resolved = await checkStatus();
            if (resolved || pollCount.current >= 24) {
                clearInterval(interval);
                setIsPolling(false);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [orderId, moneyMayBeCharged, navigate]);

    // ── Money may have been charged — show verification pending UI ──
    if (moneyMayBeCharged) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="mb-10"
                    >
                        <div className="w-28 h-28 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-8">
                            {isPolling ? (
                                <Clock className="w-14 h-14 text-amber-500 animate-pulse" />
                            ) : (
                                <Clock className="w-14 h-14 text-amber-500" />
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h1 className="text-3xl font-black tracking-tighter mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            Payment <span className="text-amber-500">Pending</span>
                        </h1>
                        <p className="text-zinc-400 font-medium mb-4 leading-relaxed">
                            {isPolling
                                ? "Verifying your payment... This usually takes a few seconds."
                                : "Your payment is being verified. This usually takes a few minutes."
                            }
                        </p>
                        <p className="text-zinc-500 text-sm mb-4 leading-relaxed">
                            If money was deducted, your order will be confirmed automatically.
                            Otherwise, it will be refunded within 5–7 business days.
                        </p>

                        {isPolling && (
                            <div className="flex items-center justify-center gap-2 mb-4 text-amber-500/70 text-sm">
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                <span className="ml-2">Checking payment status...</span>
                            </div>
                        )}

                        {orderId && (
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-8">
                                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Order ID</p>
                                <p className="text-white font-mono text-sm break-all">{orderId}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                            <button
                                onClick={() => navigate('/orders', { replace: true })}
                                className="flex items-center justify-center gap-2 w-full bg-[#f2546d] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Check My Orders
                            </button>
                            <button
                                onClick={() => navigate('/home', { replace: true })}
                                className="flex items-center justify-center gap-2 w-full bg-white/10 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                            >
                                Go Home
                            </button>
                            <a
                                href="tel:+919876543210"
                                className="flex items-center justify-center gap-2 w-full bg-white/5 text-zinc-400 font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                            >
                                <Phone className="w-5 h-5" />
                                Contact Support
                            </a>
                        </div>
                    </motion.div>
                </div>
            </MobileShell>
        );
    }

    // ── Money was NOT charged — show standard failure UI ──
    return (
        <MobileShell className="bg-black text-white">
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="mb-10"
                >
                    <div className="w-28 h-28 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-8">
                        <XCircle className="w-14 h-14 text-red-500" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h1 className="text-3xl font-black tracking-tighter mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        Payment <span className="text-red-500">Failed</span>
                    </h1>
                    <p className="text-zinc-400 font-medium mb-10 leading-relaxed">
                        Your payment was not completed.{"\n"}No amount has been charged.
                    </p>

                    <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                        <button
                            onClick={() => navigate('/checkout', { replace: true })}
                            className="flex items-center justify-center gap-2 w-full bg-[#f2546d] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                        >
                            <RotateCcw className="w-5 h-5" />
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate('/cart', { replace: true })}
                            className="flex items-center justify-center gap-2 w-full bg-white/10 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            Back to Cart
                        </button>
                    </div>
                </motion.div>
            </div>
        </MobileShell>
    );
}
