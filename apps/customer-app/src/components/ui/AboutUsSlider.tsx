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
        label: "Sanitization",
        icon: (
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 10H16V8H12V5H16V3H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 5H20L21 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="9" y="10" width="8" height="4" rx="1" stroke="white" strokeWidth="1.5" />
                <path d="M10 14L9 25C9 25.5523 9.44772 26 10 26H16C16.5523 26 17 25.5523 17 25L16 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="22" cy="10" r="1" fill="white" opacity="0.5" />
                <circle cx="24" cy="7" r="0.7" fill="white" opacity="0.4" />
                <circle cx="20" cy="8" r="0.7" fill="white" opacity="0.3" />
            </svg>
        ),
    },
    {
        label: "Pre Cleaning",
        icon: (
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 14H21L19 26H9L7 14Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 14H23" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M14 2V14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 6L14 2L18 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 18V22M14 17V23M17 18V22" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
            </svg>
        ),
    },
    {
        label: "Post Cleaning",
        icon: (
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 4V2M10 8C10 8 10 5 14 5C18 5 18 8 18 8M8 8L14 24L20 8H8Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 8H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M9 12H19M10 16H18M11 20H17" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
            </svg>
        ),
    },
    {
        label: "Quality Check",
        icon: (
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2L4 7V13C4 19.63 8.28 25.79 14 27C19.72 25.79 24 19.63 24 13V7L14 2Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 14.5L12.5 17.5L18.5 11.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
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
