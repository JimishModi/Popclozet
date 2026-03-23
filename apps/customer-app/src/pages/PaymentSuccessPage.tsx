import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { Check, Sparkles, Trophy, Zap, ArrowRight, ShoppingBag } from "lucide-react";
import { activateSubscription, getSubscriptionPlans, SubscriptionPlan } from "@/services/subscriptionService";
import { toast } from "sonner";
import { supabase } from "@popclozet/api-client";

export default function PaymentSuccessPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type") || "plan";
    const planId = searchParams.get("planId") || "essential";
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    const [activating, setActivating] = useState(true);
    const [activationError, setActivationError] = useState<string | null>(null);
    const [plan, setPlan] = useState<SubscriptionPlan | null>(null);

    useEffect(() => {
        const handleFinalization = async () => {
            try {
                // Fetch plans for UI display
                const allPlans = await getSubscriptionPlans();
                const foundPlan = allPlans.find(p => p.id === planId) || allPlans[0];
                setPlan(foundPlan);

                if (type === "order" && orderId) {
                    // Update order status to pending
                    const { error } = await supabase
                        .from('orders')
                        .update({ status: 'pending' })
                        .eq('id', orderId);

                    if (error) throw error;
                    toast.success("Order confirmed successfully!");
                    // Navigate to order confirmed page
                    navigate(`/order-confirmed/${orderId}`, { replace: true });
                    return;
                }
                /*
                else if (type === "plan") {
                    await activateSubscription(planId);
                    toast.success(`Welcome to the ${plan.name} Plan!`);
                }
                */
                setActivating(false);
            } catch (error: any) {
                console.error("Finalization failed:", error);
                setActivationError(error?.message || "Something went wrong.");
                setActivating(false);
            }
        };
        handleFinalization();
    }, [planId, type, orderId, navigate]);

    const PlanIcon = planId === 'essential' ? Zap : planId === 'standard' ? Sparkles : Trophy;

    return (
        <MobileShell className="bg-black text-white" hideBottomNav>
            <div className="flex flex-col h-full px-6 py-12 relative overflow-hidden">
                {/* Background Confetti/Glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.4, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute top-[10%] left-[20%] w-64 h-64 bg-[#f2546d]/20 rounded-full blur-[80px]"
                    />
                </div>

                {activationError ? (
                    <div className="flex flex-col items-center justify-center h-full text-center mt-20">
                        <div className="w-24 h-24 rounded-[32px] bg-red-500/20 flex items-center justify-center shadow-2xl shadow-red-500/40 border border-red-500/30 mb-8">
                            <Zap className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tighter mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>Oops!</h1>
                        <p className="text-zinc-400 mb-8 px-4">{activationError}</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="h-14 px-8 rounded-full bg-zinc-800 text-white font-bold active:scale-95 transition-all border border-white/10 active:scale-95"
                            >
                                Go Back
                            </button>
                            {/* 
                            <button
                                onClick={() => navigate('/subscription-plans')}
                                className="h-14 px-8 rounded-full bg-white text-black font-bold active:scale-95 transition-all shadow-xl shadow-white/10"
                            >
                                Try Again
                            </button>
                            */}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Success Icon */}
                        <div className="flex justify-center mb-10">
                            <motion.div
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                                className="w-24 h-24 rounded-[32px] bg-[#f2546d] flex items-center justify-center shadow-2xl shadow-[#f2546d]/40"
                            >
                                <Check className="w-12 h-12 text-white stroke-[4]" />
                            </motion.div>
                        </div>

                        <div className="text-center mb-12">
                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-4xl font-black tracking-tighter mb-4"
                                style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                                {type === 'order' ? 'Order Placed!' : 'Success!'}
                            </motion.h1>
                            {plan && (
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-zinc-500 font-medium px-4"
                                >
                                    {type === 'order'
                                        ? <>Your order <span className="text-white font-bold">#PC-{orderId?.slice(0, 6).toUpperCase()}</span> has been confirmed.</>
                                        : <>Your <span className="text-white font-bold">{plan.name}</span> membership is now active.</>
                                    }
                                </motion.p>
                            )}
                        </div>

                        {/* Card Summary */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 }}
                            className="bg-[#1A1A1A] border border-white/10 rounded-[40px] p-8 mb-12 relative overflow-hidden"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-[#831a28] flex items-center justify-center">
                                    <ShoppingBag className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-[#f2546d]">
                                        Order Summary
                                    </p>
                                    <p className="text-xl font-bold tracking-tight text-white">
                                        Amount Paid: ₹ {amount}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500 font-bold">Delivery Status</span>
                                    <span className="text-emerald-500 font-black uppercase">PREPARING</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500 font-bold">Estimated Arrival</span>
                                    <span className="text-white font-black uppercase">45-60 MINS</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500 font-bold">Items Rented</span>
                                    <span className="text-white font-black uppercase">SECURED</span>
                                </div>
                            </div>

                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#f2546d]/5 blur-[40px] -mr-16 -mt-16" />
                        </motion.div>

                        {/* Final Call to Action */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="mt-auto"
                        >
                            <button
                                onClick={() => navigate(type === 'order' ? `/tracking/${orderId}` : "/home")}
                                className="w-full h-16 rounded-[24px] bg-white text-black font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-white/10"
                                style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                                {type === 'order' ? 'TRACK MY RIDE' : 'VIEW MY PROFILE'}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mt-6">
                                {type === 'order' ? `Order #PC-${orderId?.slice(0, 6).toUpperCase()}` : `Order #PC-${Math.floor(100000 + Math.random() * 900000)}`} • POPCLOZET SECURE
                            </p>
                        </motion.div>
                    </>
                )}
            </div>
        </MobileShell>
    );
}
