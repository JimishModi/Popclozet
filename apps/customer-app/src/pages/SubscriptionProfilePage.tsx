import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { getSubscriptionProfile, cancelSubscription } from "@/services/subscriptionService";
import { Loader2, ArrowLeft, Zap, Sparkles, Trophy, CheckCircle2, Lock, Calendar, Star, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function SubscriptionProfilePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    const loadProfile = async () => {
        try {
            const data = await getSubscriptionProfile();
            if (!data) {
                navigate("/subscription-plans", { replace: true });
            } else {
                setProfile(data);
            }
        } catch (e) {
            console.error(e);
            navigate("/subscription-plans", { replace: true });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, [navigate]);

    const handleCancel = async () => {
        if (window.confirm("Are you sure you want to cancel your luxury subscription? You will lose access to member benefits at the end of your billing cycle.")) {
            setIsCancelling(true);
            try {
                await cancelSubscription();
                await loadProfile(); // Refresh UI to show cancelled status
            } catch (e) {
                console.error("Failed to cancel", e);
            } finally {
                setIsCancelling(false);
            }
        }
    };

    if (loading) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[#f2546d]" />
                </div>
            </MobileShell>
        );
    }

    if (!profile) return null;

    const { subscription, plan } = profile;
    const isBasic = plan.id === 'essential';
    const isStandard = plan.id === 'standard';
    const isPro = plan.id === 'pro';

    const PlanIcon = isBasic ? Zap : isStandard ? Sparkles : Trophy;
    const planColor = isBasic ? "from-amber-500 to-orange-600" : isStandard ? "from-blue-500 to-indigo-600" : "from-[#f2546d] to-purple-600";

    const startDate = new Date(subscription.current_period_start);
    const endDate = new Date(subscription.current_period_end);
    const daysLeft = differenceInDays(endDate, new Date());
    const totalDays = differenceInDays(endDate, startDate);
    const progress = Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100));

    return (
        <MobileShell className="bg-black text-white" hideBottomNav>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center justify-between">
                <button
                    onClick={() => navigate("/profile")}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                >
                    <ArrowLeft className="w-5 h-5 text-zinc-300" />
                </button>
                <h1 className="text-sm font-bold tracking-widest uppercase text-white" style={dmSans}>My Membership</h1>
                <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto pb-24 px-4 pt-6 space-y-8">
                {/* Plan Badge Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[32px] p-6 shadow-2xl"
                >
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", planColor)} />
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-white/80 text-sm font-black tracking-widest uppercase mb-1 drop-shadow-sm">Current Plan</p>
                                <h2 className="text-4xl font-black text-white drop-shadow-md tracking-tighter" style={dmSans}>{plan.name}</h2>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
                                <PlanIcon className="w-7 h-7 text-white drop-shadow-md" />
                            </div>
                        </div>

                        <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                            <div className="flex justify-between items-end mb-2">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-white/90 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" />
                                        Renews on {format(endDate, "MMM d, yyyy")}
                                    </p>
                                    {subscription.cancel_at_period_end && (
                                        <p className="text-xs text-red-400 font-bold flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Cancels automatically
                                        </p>
                                    )}
                                </div>
                                <p className="text-xs font-black text-white bg-white/20 px-2 py-1 rounded-lg">
                                    {daysLeft} days left
                                </p>
                            </div>
                            <div className="h-2 bg-black/40 rounded-full overflow-hidden mt-3">
                                <div 
                                    className="h-full bg-white rounded-full relative"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute inset-0 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-lg font-bold text-white" style={dmSans}>Included Features</h3>
                        {!isPro && (
                            <span className="text-xs font-bold text-[#f2546d] bg-[#f2546d]/10 px-2 py-1 rounded-md uppercase tracking-wider">
                                Upgrade Available
                            </span>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        {plan.features.map((feature: any) => {
                            const isIncluded = feature.included;
                            return (
                                <div 
                                    key={feature.id}
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-[20px] transition-all border",
                                        isIncluded 
                                            ? "bg-[#1A1A1A] border-white/10 shadow-lg" 
                                            : "bg-black/40 border-white/5 opacity-60 grayscale-[50%]"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                        isIncluded ? "bg-emerald-500/10" : "bg-white/5"
                                    )}>
                                        {isIncluded ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <Lock className="w-4 h-4 text-zinc-500" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className={cn(
                                            "font-bold text-sm tracking-tight",
                                            isIncluded ? "text-white" : "text-zinc-500"
                                        )}>
                                            {feature.name}
                                        </p>
                                    </div>
                                    {!isIncluded && (
                                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Upgrade CTA */}
                {!isPro && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-r from-zinc-900 to-black border border-white/10 rounded-[24px] p-6 text-center shadow-xl relative overflow-hidden"
                    >
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f2546d]/20 blur-[40px] rounded-full point-events-none" />
                        <Star className="w-8 h-8 text-[#f2546d] mx-auto mb-3" />
                        <h4 className="text-xl font-bold text-white mb-2" style={dmSans}>Want More?</h4>
                        <p className="text-sm text-zinc-400 mb-5">
                            Upgrade to {isBasic ? "Standard" : "Pro"} to unlock more rentals, higher insurance, and exclusive perks.
                        </p>
                        <button
                            onClick={() => navigate("/subscription-plans")}
                            className="w-full py-4 rounded-xl bg-white text-black font-black text-sm tracking-wide shadow-xl active:scale-95 transition-all"
                        >
                            VIEW ALL PLANS
                        </button>
                    </motion.div>
                )}
                
                {/* Cancel Subscription */}
                {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                    <div className="mt-8 text-center pt-8 border-t border-white/5">
                        <button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className="text-zinc-500 hover:text-red-400 text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {isCancelling ? "CANCELLING..." : "CANCEL MEMBERSHIP"}
                        </button>
                    </div>
                )}
                
                <div className="h-8" />
            </div>
        </MobileShell>
    );
}
