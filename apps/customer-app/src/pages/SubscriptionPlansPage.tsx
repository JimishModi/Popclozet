/**
 * SubscriptionPlansPage — Choose your plan with a premium glassmorphic UI
 * Fetches real plans from the database via subscriptionService
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { Check, CheckCircle2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSubscriptionPlans, SubscriptionPlan, getActiveSubscription, UserSubscription } from "@/services/subscriptionService";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function SubscriptionPlansPage() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [currentSub, setCurrentSub] = useState<UserSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const fetchedPlans = await getSubscriptionPlans();
            setPlans(fetchedPlans);
            
            const activeSub = await getActiveSubscription();
            setCurrentSub(activeSub);

            if (activeSub) {
                setSelectedPlanId(activeSub.plan_id);
            } else if (fetchedPlans.length > 0) {
                setSelectedPlanId(fetchedPlans[0].id);
            }
            setIsLoading(false);
        };
        init();
    }, []);

    if (isLoading) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="mt-4 text-white/60">Loading available plans...</p>
                </div>
            </MobileShell>
        );
    }

    return (
        <MobileShell className="bg-black text-white">
                {/* Header with Back Button and User Icon */}
                <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <span className="text-emerald-500 font-bold text-sm">A</span>
                    </div>
                </header>

                <div className="flex flex-col h-full px-6 py-8">

                <h1 className="text-3xl font-bold mb-10 text-white" style={dmSans}>Choose your plan</h1>

                <div className="space-y-4 flex-1 overflow-y-auto">
                    {plans.map((plan) => {
                        const isSelected = selectedPlanId === plan.id;
                        const isCurrent = currentSub?.plan_id === plan.id;
                        const includedFeatures = (plan.features as any[]).filter(f => f.included);

                        return (
                            <button
                                key={plan.id}
                                onClick={() => setSelectedPlanId(plan.id)}
                                className={cn(
                                    "w-full rounded-[24px] p-6 text-left transition-all duration-300 relative border-2",
                                    isSelected
                                        ? "bg-[#831a28] border-white/40 shadow-xl"
                                        : "bg-[#280a0e] border-transparent"
                                )}
                            >
                                {isCurrent && (
                                    <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-500 text-[10px] font-black tracking-widest px-2 py-1 rounded-md border border-emerald-500/30 uppercase">
                                        Current Plan
                                    </div>
                                )}
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            {isSelected && (
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-[#831a28] stroke-[3]" />
                                                </div>
                                            )}
                                            {/* Real features from plan */}
                                            <div className="flex-1 flex justify-around text-[11px] font-medium text-white/60">
                                                <div className="space-y-1">
                                                    {includedFeatures.slice(0, 3).map(f => (
                                                        <p key={f.id} className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                                                            {f.name}
                                                        </p>
                                                    ))}
                                                </div>
                                                {includedFeatures.length > 3 && (
                                                    <div className="space-y-1">
                                                        {includedFeatures.slice(3, 6).map(f => (
                                                            <p key={f.id} className="flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                                                                {f.name}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-end justify-between mt-8">
                                            <h3 className="text-3xl font-bold text-white tracking-tight" style={dmSans}>{plan.name}</h3>
                                            <div className="text-right">
                                                <span className="text-2xl font-bold text-white" style={dmSans}>₹ {plan.price}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-8">
                    <button
                        onClick={() => {
                            if (currentSub?.plan_id === selectedPlanId) return;
                            navigate(`/payment-processing?type=plan&planId=${selectedPlanId}`);
                        }}
                        disabled={currentSub?.plan_id === selectedPlanId}
                        className={cn(
                            "w-full py-5 rounded-[24px] font-bold text-lg tracking-tight shadow-xl transition-all active:scale-[0.98]",
                            currentSub?.plan_id === selectedPlanId
                                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none"
                                : "bg-[#f2546d] text-white shadow-[#f2546d]/30"
                        )}
                        style={dmSans}
                    >
                        {currentSub?.plan_id === selectedPlanId ? "CURRENT MEMBERSHIP" : "Next"}
                    </button>
                </div>
            </div>
        </MobileShell>
    );
}
