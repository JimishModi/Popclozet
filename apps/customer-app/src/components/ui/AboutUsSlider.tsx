/**
 * AboutUsSlider — Compact auto-cycling card for the home page.
 *
 * Shows each hygiene phase (Sanitization → Pre Cleaning → Post Cleaning → Quality Check)
 * in a sliding card with a progress bar. Clicking the chevron navigates to /how-it-works.
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PHASES = [
    {
        label: "Pre Cleaning",
        icon: <img src="/icons/process-1.png" className="w-full h-full object-cover" alt="Pre Cleaning" />,
    },
    {
        label: "Sanitization",
        icon: <img src="/icons/process-2.png" className="w-full h-full object-cover" alt="Sanitization" />,
    },
    {
        label: "Post Cleaning",
        icon: <img src="/icons/process-3.png" className="w-full h-full object-cover" alt="Post Cleaning" />,
    },
    {
        label: "Quality Check",
        icon: <img src="/icons/process-4.png" className="w-full h-full object-cover" alt="Quality Check" />,
    },
];

const CYCLE_MS = 4500;

export function AboutUsSlider() {
    const navigate = useNavigate();
    const [active, setActive] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setActive((prev) => (prev + 1) % PHASES.length);
        }, CYCLE_MS);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="rounded-2xl bg-[#232323] border border-[#484848] p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2
                    className="text-[20px] font-bold text-white tracking-tight"
                    style={{ fontFamily: '"DM Sans", Helvetica' }}
                >
                    About Us
                </h2>
                <button
                    onClick={() => navigate("/about-us")}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                    aria-label="View more"
                >
                    <ChevronRight className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Sliding Phase Card */}
            <div className="rounded-xl bg-[#2e2e2e] border border-[#3a3a3a] px-5 py-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={active}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="flex items-center gap-4"
                    >
                        <div className="w-10 h-10 rounded-full bg-[#363636] flex items-center justify-center flex-shrink-0">
                            {PHASES[active].icon}
                        </div>
                        <span
                            className="text-[15px] font-semibold text-white tracking-tight"
                            style={{ fontFamily: '"DM Sans", Helvetica' }}
                        >
                            {PHASES[active].label}
                        </span>
                    </motion.div>
                </AnimatePresence>

                {/* Progress bar with dots */}
                <div className="mt-4 flex items-center">
                    {PHASES.map((_, i) => (
                        <React.Fragment key={i}>
                            {/* Dot */}
                            <div
                                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-500 ${i <= active ? "bg-[#f2546d]" : "bg-[#555]"
                                    } ${i === active
                                        ? "ring-[2.5px] ring-white ring-offset-[1.5px] ring-offset-[#2e2e2e] scale-110"
                                        : ""
                                    }`}
                            />
                            {/* Line */}
                            {i < PHASES.length - 1 && (
                                <div
                                    className={`flex-1 h-[2px] transition-colors duration-500 ${i < active ? "bg-[#f2546d]" : "bg-[#555]"
                                        }`}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}
