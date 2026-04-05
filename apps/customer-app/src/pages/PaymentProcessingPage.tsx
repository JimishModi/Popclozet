import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { useCart } from "@/context/CartContext";
import { clearCartDB, clearUserCartDB } from "@/lib/db";
import { supabase } from "@popclozet/api-client";
import { debugAuthState } from "@/services/supabaseFunctionInvoke";

export default function PaymentProcessingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type") || "plan";
    const planId = searchParams.get("planId") || "essential";
    const orderId = searchParams.get("orderId");
    const amountStr = searchParams.get("amount");
    const method = searchParams.get("method") || "upi";

    const pickupSlotIso = searchParams.get("pickupSlotIso");
    const pickupAddressId = searchParams.get("pickupAddressId");

    const { user, profile, session } = useAuth();
    const { cartItems, removeFromCart } = useCart();
    const { initiatePayment, isProcessing } = useRazorpayCheckout();
    const hasInitiated = useRef(false);

    // Tracks whether the payment flow has reached a terminal state (success or failure).
    // Used to prevent duplicate navigations from overlapping callbacks.
    const paymentSettled = useRef(false);

    const isUpi = method === "upi";

    useEffect(() => {
        const log = () => {
            debugAuthState(`payment-processing:${document.visibilityState}`).catch(() => { });
        };

        log();
        window.addEventListener("focus", log);
        window.addEventListener("pageshow", log);
        document.addEventListener("visibilitychange", log);

        return () => {
            window.removeEventListener("focus", log);
            window.removeEventListener("pageshow", log);
            document.removeEventListener("visibilitychange", log);
        };
    }, []);

    // Safety timeout: if nothing settles within 5 minutes, something is stuck.
    // This is a last-resort fallback — the Razorpay hook's own ondismiss/handler
    // should resolve the flow well before this fires.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!paymentSettled.current) {
                console.error('[PaymentProcessing] Safety timeout reached — navigating to failure');
                paymentSettled.current = true;
                navigate(`/payment-failed?orderId=${orderId || ''}&reason=timeout`, { replace: true });
            }
        }, 300000); // 5 minutes
        return () => clearTimeout(timer);
    }, [navigate, orderId]);

    // NOTE: The previous visibilitychange listener has been REMOVED.
    //
    // It was the root cause of the "Payment Cancelled" flash bug:
    // When Razorpay's modal closes, the page becomes visible again. The listener
    // would then check paymentSettled after a 2s timeout — but async verification
    // often takes longer than 2s, so it would navigate to /payment-failed even
    // though the payment had succeeded and verification was still in progress.
    //
    // The Razorpay hook (useRazorpayCheckout) already handles all terminal states:
    //   - handler (success) → calls onSuccess
    //   - modal.ondismiss (cancel) → calls onFailure (with outcomeRef guard)
    //   - payment.failed (bank decline) → toast only (user retries in modal)
    //   - SDK load failure → calls onFailure
    // There is no scenario that requires a visibilitychange fallback.

    useEffect(() => {
        if (hasInitiated.current) return;

        const startPayment = async () => {
            if (type === "order" && orderId && amountStr) {
                if (!session?.access_token || !user?.id) {
                    console.warn("[PaymentProcessing] Missing authenticated session before payment invoke", {
                        hasSession: !!session,
                        hasAccessToken: !!session?.access_token,
                        userId: user?.id || null,
                    });
                    navigate("/auth/login", { replace: true });
                    return;
                }

                const amount = parseFloat(amountStr);
                if (isNaN(amount)) {
                    console.error("[PaymentProcessing] Invalid amount:", amountStr);
                    navigate('/checkout', { replace: true });
                    return;
                }

                hasInitiated.current = true;

                initiatePayment({
                    internalOrderId: orderId,
                    amountInRupees: amount,
                    userName: profile?.full_name || user?.user_metadata?.full_name || "",
                    userEmail: profile?.email || user?.email || "",
                    userPhone: profile?.phone || user?.phone || "",
                    onSuccess: async (paymentId) => {
                        if (paymentSettled.current) return;
                        paymentSettled.current = true;

                        // Create pre-scheduled return request now that payment is verified.
                        // This was deferred from CheckoutPage to avoid false notifications
                        // when payment hasn't completed yet.
                        if (pickupSlotIso && orderId) {
                            const { error: rrErr } = await supabase
                                .from('return_requests')
                                .insert({
                                    order_id: orderId,
                                    status: 'approved',
                                    reason: 'pre_scheduled',
                                    pickup_slot: pickupSlotIso,
                                    pickup_address_id: pickupAddressId,
                                    approved_at: new Date().toISOString(),
                                });
                            if (rrErr) {
                                console.warn('[PaymentProcessing] Return request insert failed (non-blocking):', rrErr.message);
                            }
                        }

                        // Clear cart on successful payment (user-scoped)
                        const uid = user?.id;
                        await (uid ? clearUserCartDB(uid) : clearCartDB()).catch(() => { });
                        const cartEntries = Object.entries(cartItems);
                        for (const [key, data] of cartEntries) {
                            const parts = key.split('_');
                            removeFromCart(parts[0], data.size, data.plan);
                        }
                        navigate('/home', { replace: true });
                    },
                    onFailure: (error) => {
                        if (paymentSettled.current) return;
                        paymentSettled.current = true;

                        console.log('[PaymentProcessing] Payment failed or cancelled:', error.message);

                        // User cancelled → go back to checkout so they can retry
                        if (error.message === 'PAYMENT_CANCELLED') {
                            navigate('/checkout', { replace: true });
                        } else {
                            navigate(`/payment-failed?orderId=${orderId}`, { replace: true });
                        }
                    }
                });
            } else if (type === "plan") {
                setTimeout(() => {
                    navigate(`/payment-success?type=${type}&planId=${planId}`, { replace: true });
                }, 3000);
            }
        };

        startPayment();
    }, [type, orderId, amountStr, initiatePayment, profile, user, session, navigate, planId, cartItems, removeFromCart]);


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
