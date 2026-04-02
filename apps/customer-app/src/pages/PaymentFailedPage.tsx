import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { XCircle, RotateCcw, ShoppingBag } from "lucide-react";
import { cancelOrder } from "@/services/ordersService";

export default function PaymentFailedPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const orderId = searchParams.get("orderId");

    useEffect(() => {
        // Automatically mark the order as cancelled since payment failed.
        // This triggers the DB to release any reserved inventory locks.
        if (orderId) {
            cancelOrder(orderId).catch(err => {
                console.error("Failed to cancel abandoned order:", err);
            });
        }
    }, [orderId]);

    return (
        <MobileShell className="bg-black text-white" hideBottomNav>
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
