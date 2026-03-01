/**
 * SubscriptionPlansPage — Choose your plan (2-slide flow)
 *
 * Slide 1 (Android Compact 31): Overview of all 3 plans as vertical cards
 * Slide 2 (Android Compact 25-27): Detailed plan view with tab selector
 *
 * Matches the Figma design exactly.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { ArrowLeft, Check } from "lucide-react";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

type PlanId = "basic" | "standard" | "pro";

interface Plan {
    id: PlanId;
    name: string;
    price: number;
    features: { label: string; spec: string }[];
}

const PLANS: Plan[] = [
    {
        id: "basic",
        name: "Basic",
        price: 4250,
        features: [
            { label: "Feature 1", spec: "Feature 1" },
            { label: "Feature 2", spec: "Feature 2" },
            { label: "Feature 3", spec: "Feature 3" },
        ],
    },
    {
        id: "standard",
        name: "Standard",
        price: 4250,
        features: [
            { label: "Feature 1", spec: "Feature 1" },
            { label: "Feature 2", spec: "Feature 2" },
            { label: "Feature 3", spec: "Feature 3" },
        ],
    },
    {
        id: "pro",
        name: "Pro",
        price: 4250,
        features: [
            { label: "Feature 1", spec: "Feature 1" },
            { label: "Feature 2", spec: "Feature 2" },
            { label: "Feature 3", spec: "Feature 3" },
        ],
    },
];

export default function SubscriptionPlansPage() {
    const navigate = useNavigate();
    const [slide, setSlide] = useState<1 | 2>(1);
    const [selectedPlan, setSelectedPlan] = useState<PlanId>("basic");

    const activePlan = PLANS.find((p) => p.id === selectedPlan)!;

    return (
        <MobileShell className="bg-[#0e0e0e] text-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <button
                    onClick={() => (slide === 2 ? setSlide(1) : navigate(-1))}
                    className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
            </div>

            <AnimatePresence mode="wait">
                {slide === 1 ? (
                    /* ───────────────────────────────────────
                       SLIDE 1 — Plan overview cards (Frame 31)
                       ─────────────────────────────────────── */
                    <motion.div
                        key="slide1"
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 flex flex-col px-5 overflow-y-auto"
                    >
                        <h1
                            className="text-[22px] font-bold tracking-tight mb-6"
                            style={dmSans}
                        >
                            Choose your plan
                        </h1>

                        <div className="space-y-4 flex-1">
                            {PLANS.map((plan) => (
                                <button
                                    key={plan.id}
                                    onClick={() => {
                                        setSelectedPlan(plan.id);
                                        setSlide(2);
                                    }}
                                    className={`w-full rounded-2xl p-5 text-left transition-all border ${selectedPlan === plan.id
                                            ? "bg-[#3a1a22] border-[#f2546d]/40"
                                            : "bg-[#1a1a1a] border-[#333] hover:border-[#555]"
                                        }`}
                                >
                                    {/* Selected checkmark */}
                                    {selectedPlan === plan.id && (
                                        <div className="flex justify-end -mt-1 -mr-1 mb-1">
                                            <div className="w-6 h-6 rounded-full bg-[#2ecc71] flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Feature pills grid */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {plan.features.map((f, i) => (
                                            <span
                                                key={i}
                                                className="text-[11px] text-white/70 bg-[#8d303f]/40 px-2.5 py-1 rounded"
                                                style={dmSans}
                                            >
                                                {f.label}
                                            </span>
                                        ))}
                                        {plan.features.map((f, i) => (
                                            <span
                                                key={`spec-${i}`}
                                                className="text-[11px] text-white/70 bg-[#8d303f]/40 px-2.5 py-1 rounded"
                                                style={dmSans}
                                            >
                                                {f.spec}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Name + Price */}
                                    <div className="flex items-center justify-between">
                                        <span
                                            className="text-lg font-bold text-white"
                                            style={dmSans}
                                        >
                                            {plan.name}
                                        </span>
                                        <span
                                            className="text-lg font-bold text-white"
                                            style={dmSans}
                                        >
                                            ₹ {plan.price}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Next button */}
                        <div className="py-6">
                            <button
                                onClick={() => setSlide(2)}
                                className="w-full py-4 rounded-full font-bold text-white text-base bg-gradient-to-r from-[#f2546d] to-[#e04060] active:scale-[0.97] transition-transform"
                                style={dmSans}
                            >
                                Next
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    /* ───────────────────────────────────────
                       SLIDE 2 — Detailed plan view (Frames 25-27)
                       ─────────────────────────────────────── */
                    <motion.div
                        key="slide2"
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={{ duration: 0.25 }}
                        className="flex-1 flex flex-col px-5 overflow-y-auto"
                    >
                        <h1
                            className="text-[22px] font-bold tracking-tight mb-6"
                            style={dmSans}
                        >
                            Choose your plan
                        </h1>

                        {/* Plan tabs */}
                        <div className="flex gap-3 mb-8">
                            {PLANS.map((plan) => (
                                <button
                                    key={plan.id}
                                    onClick={() => setSelectedPlan(plan.id)}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${selectedPlan === plan.id
                                            ? "bg-[#8d303f] text-white"
                                            : "bg-[#1a1a1a] text-zinc-400 border border-[#333]"
                                        }`}
                                    style={dmSans}
                                >
                                    {plan.name}
                                </button>
                            ))}
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between mb-8">
                            <span
                                className="text-lg font-semibold text-white"
                                style={dmSans}
                            >
                                Price
                            </span>
                            <span
                                className="text-lg font-bold text-white"
                                style={dmSans}
                            >
                                ₹ {activePlan.price}
                            </span>
                        </div>

                        {/* Features table */}
                        <div className="space-y-5 flex-1">
                            {activePlan.features.map((f, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between"
                                >
                                    <span
                                        className="text-[15px] text-white/80"
                                        style={dmSans}
                                    >
                                        {f.label}
                                    </span>
                                    <span
                                        className="text-[15px] text-white/80"
                                        style={dmSans}
                                    >
                                        {f.spec}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Next / Subscribe button */}
                        <div className="py-6">
                            <button
                                onClick={() => {
                                    // TODO: wire to subscription API
                                    navigate(-1);
                                }}
                                className="w-full py-4 rounded-full font-bold text-white text-base bg-gradient-to-r from-[#f2546d] to-[#e04060] active:scale-[0.97] transition-transform"
                                style={dmSans}
                            >
                                Next
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </MobileShell>
    );
}
