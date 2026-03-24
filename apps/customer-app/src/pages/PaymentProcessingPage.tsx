import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { useCart } from "@/context/CartContext";
import { clearCartDB } from "@/lib/db";

export default function PaymentProcessingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type") || "plan";
    const planId = searchParams.get("planId") || "essential";
    const orderId = searchParams.get("orderId");
    const amountStr = searchParams.get("amount");
    const method = searchParams.get("method") || "upi";
    
    const { user, profile } = useAuth();
    const { cartItems, removeFromCart } = useCart();
    const { initiatePayment, isProcessing } = useRazorpayCheckout();
    const hasInitiated = useRef(false);
    const paymentSettled = useRef(false);

    // Add isUpi logic to avoid next IDE errors
    const isUpi = method === "upi";

    const handleCancel = useCallback(() => {
        if (!paymentSettled.current) {
            paymentSettled.current = true;
            navigate(`/payment-failed?orderId=${orderId || ''}`, { replace: true });
        }
    }, [navigate, orderId]);

    // Fallback: if user dismisses Razorpay via back button / swipe without ondismiss firing
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && hasInitiated.current && !paymentSettled.current) {
                // Give ondismiss 500ms to fire first before we force-navigate
                setTimeout(() => {
                    if (!paymentSettled.current) {
                        handleCancel();
                    }
                }, 500);
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [handleCancel]);

    useEffect(() => {
        // Prevent multiple initiations if the effect runs twice
        if (hasInitiated.current) return;

        const startPayment = async () => {
            if (type === "order" && orderId && amountStr) {
                const amount = parseFloat(amountStr);
                if (isNaN(amount)) {
                    console.error("[PaymentProcessing] Invalid amount:", amountStr);
                    navigate('/checkout', { replace: true });
                    return;
                }

                hasInitiated.current = true;

                // Call real Razorpay
                initiatePayment({
                    internalOrderId: orderId,
                    amountInRupees: amount,
                    userName: profile?.full_name || user?.user_metadata?.full_name || "",
                    userEmail: profile?.email || user?.email || "",
                    userPhone: profile?.phone || user?.phone || "",
                    onSuccess: async () => {
                        paymentSettled.current = true;
                        // Clear cart on successful payment
                        await clearCartDB().catch(() => { });
                        const cartEntries = Object.entries(cartItems);
                        for (const [key, data] of cartEntries) {
                            const parts = key.split('_');
                            removeFromCart(parts[0], data.size, data.plan);
                        }
                        // Navigate to order confirmed
                        navigate(`/order-confirmed/${orderId}`, { replace: true });
                    },
                    onFailure: (error) => {
                        paymentSettled.current = true;
                        console.log('[PaymentProcessing] Payment failed or cancelled:', error.message);
                        navigate(`/payment-failed?orderId=${orderId}`, { replace: true });
                    }
                });
            } else if (type === "plan") {
                // If plan payments are also managed via Razorpay, handle here.
                setTimeout(() => {
                    navigate(`/payment-success?type=${type}&planId=${planId}`, { replace: true });
                }, 3000);
            }
        };

        startPayment();
    }, [type, orderId, amountStr, initiatePayment, profile, user, navigate, planId, cartItems, removeFromCart]);


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
                        {isProcessing ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-12 h-12 text-[#f2546d] animate-spin" />
                            </div>
                        ) : (
                            <ShieldCheck className="w-12 h-12 text-[#f2546d] animate-pulse" />
                        )}
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-3xl font-black tracking-tighter mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {isProcessing ? (
                            <>Opening <span className="text-[#f2546d]">Razorpay</span> Securely</>
                        ) : (
                            <>Ready for <span className="text-[#f2546d]">Payment</span></>
                        )}
                    </h1>
                    <p className="text-zinc-500 font-medium mb-12 leading-relaxed">
                        {isProcessing 
                            ? "Connecting to payment gateway... Please do not refresh."
                            : "Verifying order details before checkout..."
                        }
                    </p>

                    <div className="flex items-center justify-center gap-3 bg-white/5 py-4 px-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold tracking-tight text-emerald-500/80 uppercase">PCI-DSS Compliant Secure Pay</span>
                    </div>
                </motion.div>
            </div>
        </MobileShell>
    );
}
