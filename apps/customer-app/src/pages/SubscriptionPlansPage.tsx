/**
 * SubscriptionPlansPage — Choose your plan with a premium glassmorphic UI
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { ArrowLeft, Check, Sparkles, Zap, Trophy, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

type PlanId = "essential" | "standard" | "future";

interface Plan {
    id: PlanId;
    name: string;
    price: number;
    tagline: string;
    features: { label: string; spec: string }[];
    icon: any;
    color: string;
}

const PLANS: Plan[] = [
    {
        id: "essential" as PlanId,
        name: "Basic",
        price: 4250,
        tagline: "Start your fashion journey",
        icon: Zap,
        color: "#831a28",
        features: [
            { label: "Feature 1", spec: "Feature 1" },
            { label: "Feature 2", spec: "Feature 2" },
            { label: "Feature 3", spec: "Feature 3" },
        ],
    },
    {
        id: "standard" as PlanId,
        name: "Standard",
        price: 4250,
        tagline: "The perfect balance",
        icon: Sparkles,
        color: "#831a28",
        features: [
            { label: "Feature 1", spec: "Feature 1" },
            { label: "Feature 2", spec: "Feature 2" },
            { label: "Feature 3", spec: "Feature 3" },
        ],
    },
    {
        id: "future" as PlanId,
        name: "Pro",
        price: 4250,
        tagline: "Ultimate fashion access",
        icon: Trophy,
        color: "#831a28",
        features: [
            { label: "Feature 1", spec: "Feature 1" },
            { label: "Feature 2", spec: "Feature 2" },
            { label: "Feature 3", spec: "Feature 3" },
        ],
    },
];

export default function SubscriptionPlansPage() {
    const navigate = useNavigate();
    const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("essential");

    const selectedPlan = PLANS.find((p) => p.id === selectedPlanId)!;

    return (
        <MobileShell className="bg-black text-white">
            <div className="flex flex-col h-full px-6 py-8">
                {/* User Profile / Icon at top right */}
                <div className="flex justify-end mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <span className="text-emerald-500 font-bold text-sm">A</span>
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-10 text-white" style={dmSans}>Choose your plan</h1>

                <div className="space-y-4 flex-1 overflow-y-auto">
                    {PLANS.map((plan) => {
                        const isSelected = selectedPlanId === plan.id;
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
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            {isSelected && (
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-[#831a28] stroke-[3]" />
                                                </div>
                                            )}
                                            {/* Dummy features as per image */}
                                            <div className="flex-1 flex justify-around text-[11px] font-medium text-white/60">
                                                <div className="space-y-1">
                                                    <p>Feature 1</p>
                                                    <p>Feature 2</p>
                                                    <p>Feature 3</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p>Feature 1</p>
                                                    <p>Feature 2</p>
                                                    <p>Feature 3</p>
                                                </div>
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
                            navigate(`/payment-processing?planId=${selectedPlanId}`);
                        }}
                        className="w-full py-5 rounded-[24px] bg-[#f2546d] text-white font-bold text-lg tracking-tight shadow-xl shadow-[#f2546d]/30 active:scale-[0.98] transition-all"
                        style={dmSans}
                    >
                        Next
                    </button>
                </div>
            </div>
        </MobileShell>
    );
}
