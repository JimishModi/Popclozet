import React from "react";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

const PROCESS_STEPS = [
    {
        title: "Pre-Cleaning",
        icon: <img src="/icons/icon-2.png" className="w-full h-full object-cover" alt="Pre-Cleaning" />,
        details: [
            "Inspect garment for stains, damage, or odors",
            "Remove lint, hair, and debris",
            "Pre-treat visible stains with appropriate stain remover",
            "Empty all pockets"
        ]
    },
    {
        title: "Sanitization",
        icon: <img src="/icons/icon-3.png" className="w-full h-full object-cover" alt="Sanitization" />,
        details: [
            "Steam sanitization at 100°C for 10 minutes",
            "UV-C light treatment for 15 minutes",
            "Apply fabric-safe disinfectant spray",
            "Allow to air out for 30 minutes"
        ]
    },
    {
        title: "Post-Cleaning",
        icon: <img src="/icons/icon-4.png" className="w-full h-full object-cover" alt="Post-Cleaning" />,
        details: [
            "Inspect for remaining stains or damage",
            "Steam press to remove wrinkles",
            "Quality check all fasteners and seams",
            "Package in breathable garment bag"
        ]
    },
    {
        title: "Quality Check",
        icon: <img src="/icons/icon-1.png" className="w-full h-full object-cover" alt="Quality Check" />,
        details: [
            "Visual inspection under good lighting",
            "Odour test",
            "Functionality check (buttons, zippers)",
            "Fabric integrity assessment"
        ]
    }
];

const AboutUsProcessPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MobileShell className="bg-[#0A0A0A] text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 px-5 py-6 flex items-center gap-4 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/5">
                <button onClick={() => navigate(-1)} className="shrink-0 p-2 -ml-2 rounded-full hover:bg-white/5 transition-all active:scale-95">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold text-white tracking-tight">
                    About Us
                </h1>
            </div>

            <main className="flex-1 overflow-y-auto pb-28">
                <div className="w-full relative overflow-hidden">
                    {/* Background Blob overlay */}
                    <div className="absolute top-[-100px] left-[-50px] w-[300px] h-[300px] rounded-full blur-[120px] bg-[#F2546D]/10 pointer-events-none" />

                    {/* Timeline Process Steps */}
                    <div className="relative z-10 space-y-4 pt-8 px-6">
                        {PROCESS_STEPS.map((step, index) => (
                            <div key={index} className="flex gap-6 pb-1">
                                {/* Timeline graphic: Icon + Line */}
                                <div className="flex flex-col items-center">
                                    <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center shrink-0 z-10 shadow-lg shadow-black/20 overflow-hidden">
                                        <div className="w-full h-full z-10">{step.icon}</div>
                                    </div>
                                    {/* Line connecting the stages */}
                                    {index !== PROCESS_STEPS.length - 1 && (
                                        <div className="w-[2px] bg-[#F2546D]/40 flex-1 my-2" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 pb-10">
                                    <h3 className="text-lg font-bold text-white mb-6 pt-2">
                                        {step.title}
                                    </h3>
                                    <div className="space-y-6">
                                        {step.details.map((detail, dIndex) => (
                                            <div key={dIndex} className="flex gap-4 items-start group">
                                                {/* Diamond / Sparkle bullet */}
                                                <div className="shrink-0 mt-1.5 flex items-center justify-center">
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path
                                                            d="M6 0C6 3.31371 3.31371 6 0 6C3.31371 6 6 8.68629 6 12C6 8.68629 8.68629 6 12 6C8.68629 6 6 3.31371 6 0Z"
                                                            fill="#F2546D"
                                                        />
                                                    </svg>
                                                </div>
                                                <p className="text-[15px] font-medium text-white/90 leading-snug">
                                                    {detail}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Our Brand Section */}
                    <div className="mt-20 pb-16 px-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                            <h2 className="text-2xl font-bold tracking-tight">Our Brand</h2>
                            <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
                        </div>

                        <div className="w-full aspect-video bg-[#141414] rounded-3xl mb-10 flex flex-col items-center justify-center border border-white/5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#F2546D]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-[#F2546D]/40" />
                            </div>
                            <span className="text-white/40 text-sm font-semibold tracking-widest uppercase">Brand Visual</span>
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-col items-center text-center">
                                <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                                    Elevating
                                </h3>
                                <h3 className="text-4xl font-black tracking-tighter text-[#F2546D] uppercase italic -mt-2">
                                    Everyday Style
                                </h3>
                            </div>

                            <p className="text-[15px] font-medium text-zinc-400 leading-relaxed text-center max-w-[320px] mx-auto">
                                PopClozet is built on a foundation of premium care. We believe that every garment tells a story, and our mission is to preserve those stories through meticulous cleaning, sanitization, and artisanal attention to detail.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default AboutUsProcessPage;
