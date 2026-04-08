import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { XCircle, RotateCcw, ShoppingBag, Clock, Phone } from "lucide-react";
import { cancelOrder } from "@/services/ordersService";
import { supabase } from "@popclozet/api-client";

export default function PaymentFailedPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const orderId = searchParams.get("orderId");
    const reason = searchParams.get("reason"); // verification_failed | timeout | initiation_failed | (empty = cancelled)

    // Money MAY have been charged if verification failed or timeout occurred
    const moneyMayBeCharged = reason === "verification_failed" || reason === "timeout";

    const [cancelStatus, setCancelStatus] = useState<"idle" | "cancelling" | "done" | "failed">("idle");

    useEffect(() => {
        if (!orderId) return;

        // First, check if the webhook already confirmed this order
        const checkAndHandle = async () => {
            try {
                const { data: order } = await supabase
                    .from("orders")
                    .select("status")
                    .eq("id", orderId)
                    .single();

                if (order && ["confirmed", "paid", "packed", "ready_for_pickup", "dispatched", "delivered", "completed"].includes(order.status)) {
                    // Webhook beat us — order is confirmed! Redirect to success.
                    navigate("/home", { replace: true });
                    return;
                }
            } catch {
                // Network error checking status — proceed with page logic
            }

            // Only cancel if money was NOT charged
            if (!moneyMayBeCharged) {
                setCancelStatus("cancelling");
                try {
                    await cancelOrder(orderId);
                    setCancelStatus("done");
                } catch (err) {
                    if (err instanceof Error && err.message.includes("cancelled")) {
                        setCancelStatus("done");
                    } else {
                        console.error("Failed to cancel abandoned order:", err);
                        setCancelStatus("failed");
                        // Store for offline recovery — cron job is the server-side fallback
                        try {
                            localStorage.setItem(`pending_cancel:${orderId}`, JSON.stringify({
                                orderId,
                                timestamp: Date.now(),
                            }));
                        } catch { /* best-effort */ }
                    }
                }
            }
        };

        checkAndHandle();
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
                            <Clock className="w-14 h-14 text-amber-500" />
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
                            Your payment is being verified. This usually takes a few minutes.
                        </p>
                        <p className="text-zinc-500 text-sm mb-4 leading-relaxed">
                            If money was deducted, your order will be confirmed automatically.
                            Otherwise, it will be refunded within 5–7 business days.
                        </p>

                        {orderId && (
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-8">
                                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Order ID</p>
                                <p className="text-white font-mono text-sm break-all">{orderId}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                            <button
                                onClick={() => navigate('/home', { replace: true })}
                                className="flex items-center justify-center gap-2 w-full bg-[#f2546d] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
                            >
                                Go Home
                            </button>
                            <a
                                href="tel:+919876543210"
                                className="flex items-center justify-center gap-2 w-full bg-white/10 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
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

                    {cancelStatus === "failed" && (
                        <p className="text-zinc-500 text-sm mb-4">
                            Your order will be cancelled automatically.
                        </p>
                    )}

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
