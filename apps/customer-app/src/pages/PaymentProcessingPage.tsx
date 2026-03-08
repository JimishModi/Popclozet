import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function PaymentProcessingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type") || "plan";
    const planId = searchParams.get("planId") || "essential";
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const method = searchParams.get("method") || "upi";

    useEffect(() => {
        // Simulate payment processing time
        const timer = setTimeout(() => {
            if (type === "order" && orderId) {
                // Navigate to order confirmed page directly
                navigate(`/order-confirmed/${orderId}`, { replace: true });
            } else {
                navigate(`/payment-success?planId=${planId}`, { replace: true });
            }
        }, 3500);

        return () => clearTimeout(timer);
    }, [navigate, planId, type, orderId, amount, method]);

    const isUpi = method === "upi";

    return (
        <MobileShell className="bg-black text-white" hideBottomNav>
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                {/* 3D-like Glowing Loader */}
                <div className="relative mb-12">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 rounded-full border-t-4 border-r-4 border-[#f2546d] filter blur-[1px] shadow-[0_0_30px_rgba(242,84,109,0.3)]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 text-[#f2546d] animate-pulse" />
                    </div>
                    {/* Floating Orbs */}
                    <motion.div
                        animate={{ y: [0, -10, 0], opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -top-4 -right-4 w-6 h-6 bg-[#f2546d]/40 rounded-full blur-md"
                    />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h1 className="text-3xl font-black tracking-tighter mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {isUpi ? (
                            <>Processing <span className="text-[#f2546d]">UPI Payment</span></>
                        ) : (
                            <>Securing your <span className="text-[#f2546d]">Fashion Future</span></>
                        )}
                    </h1>
                    <p className="text-zinc-500 font-medium mb-12 leading-relaxed">
                        {isUpi
                            ? "Verifying your UPI transaction..."
                            : "Verifying transaction details..."
                        }
                    </p>

                    <div className="flex items-center justify-center gap-3 bg-white/5 py-4 px-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold tracking-tight text-emerald-500/80 uppercase">Fully Encrypted Segment</span>
                    </div>
                </motion.div>

                {/* Aesthetic Background Accents */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-[20%] -left-[20%] w-[300px] h-[300px] bg-[#f2546d]/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[20%] -right-[20%] w-[300px] h-[300px] bg-[#831a28]/10 rounded-full blur-[120px]" />
                </div>
            </div>
        </MobileShell>
    );
}
