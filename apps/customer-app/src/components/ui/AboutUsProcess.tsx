import React from "react";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Shirt, ClipboardCheck } from "lucide-react";

const PROCESS_STEPS = [
    {
        title: "Pre-Cleaning",
        icon: <Sparkles className="w-6 h-6 text-[#f2546d]" />,
        details: [
            "Inspect garment for stains, damage, or odors",
            "Remove lint, hair, and debris",
            "Pre-treat visible stains with appropriate stain remover",
            "Empty all pockets"
        ]
    },
    {
        title: "Sanitization",
        icon: <ShieldCheck className="w-6 h-6 text-[#f2546d]" />,
        details: [
            "Steam sanitization at 100°C for 10 minutes",
            "UV-C light treatment for 15 minutes",
            "Apply fabric-safe disinfectant spray",
            "Allow to air out for 30 minutes"
        ]
    },
    {
        title: "Post-Cleaning",
        icon: <Shirt className="w-6 h-6 text-[#f2546d]" />,
        details: [
            "Inspect for remaining stains or damage",
            "Steam press to remove wrinkles",
            "Quality check all fasteners and seams",
            "Package in breathable garment bag"
        ]
    },
    {
        title: "Quality Check",
        icon: <ClipboardCheck className="w-6 h-6 text-[#f2546d]" />,
        details: [
            "Visual inspection under good lighting",
            "Odour test",
            "Functionality check (buttons, zippers)",
            "Fabric integrity assessment"
        ]
    }
];

export const AboutUsProcess: React.FC = () => {
    return (
        <div className="w-full relative overflow-hidden bg-[#111111]">
            {/* Background Blob overlay like the design */}
            <div className="absolute top-[-59px] left-[-33px] w-[200px] h-[200px] rounded-full blur-[100px] bg-gradient-to-r from-[#f2546d] via-[#ff6078] to-[#611624] opacity-50 pointer-events-none" />

            {/* About Us Title */}
            <div className="text-center mb-10 pt-4 relative z-10 w-full flex justify-center">
                <h2 className="text-[24px] font-semibold tracking-[-0.72px] text-white leading-normal font-sans" style={{ fontFamily: '"DM Sans", Helvetica' }}>About Us</h2>
            </div>

            {/* Timeline Process Steps */}
            <div className="relative z-10 space-y-2 max-w-[400px] mx-auto">
                {PROCESS_STEPS.map((step, index) => (
                    <div key={index} className="flex gap-4 min-h-[140px]">
                        {/* Timeline graphic: Icon + Line */}
                        <div className="flex flex-col items-center ml-[46px]">
                            <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center shrink-0 z-10 shadow-lg shadow-black/20 overflow-hidden">
                                <div className="w-full h-full z-10">{step.icon}</div>
                            </div>
                            {/* Line connecting the stages */}
                            {index !== PROCESS_STEPS.length - 1 && (
                                <div className="w-[2px] bg-[#F2546D]/40 flex-1 my-2" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-4 -mt-1 ml-4 pr-5">
                            <h3 className="text-[18px] font-semibold tracking-[-0.54px] text-white leading-[21.6px] mb-4" style={{ fontFamily: '"DM Sans", Helvetica' }}>
                                {step.title}
                            </h3>
                            <div className="space-y-[20px]">
                                {step.details.map((detail, dIndex) => (
                                    <div key={dIndex} className="flex gap-4 items-start">
                                        {/* Sparkle bullet */}
                                        <div className="shrink-0 mt-1.5 flex items-center justify-center">
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path
                                                    d="M6 0C6 3.31371 3.31371 6 0 6C3.31371 6 6 8.68629 6 12C6 8.68629 8.68629 6 12 6C8.68629 6 6 3.31371 6 0Z"
                                                    fill="#F2546D"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-[14px] font-normal text-white tracking-[-0.42px] leading-normal m-0" style={{ fontFamily: '"DM Sans", Helvetica' }}>
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
            <div className="mt-16 pb-12 relative z-10 max-w-[400px] mx-auto text-center px-5">
                <div className="mb-8 w-full flex justify-center">
                    <h2 className="text-[24px] font-semibold tracking-[-0.72px] text-white leading-normal" style={{ fontFamily: '"DM Sans", Helvetica' }}>Our Brand</h2>
                </div>

                {/* Hero / Motto Placements */}
                <div className="w-full h-[229px] bg-[#232323] rounded-2xl mb-8 flex items-center justify-center border border-[#333333] shadow-lg shadow-black/20 overflow-hidden relative">
                    <span className="text-white text-[14px] font-normal tracking-[-0.42px]" style={{ fontFamily: '"DM Sans", Helvetica' }}>PHOTO PLACEHOLDER</span>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>

                <div className="flex flex-col items-center justify-center gap-2 mb-6 text-center w-full">
                    <div className="flex items-start gap-1 justify-center relative -left-4">
                        <img className="w-[21.06px] h-[32.92px] opacity-80" src="https://c.animaapp.com/mm0qbkliKUX7UD/img/mask-group-4.png" alt="" />
                        <h3 className="text-[32px] font-black tracking-[-0.96px] leading-normal uppercase text-white mt-1" style={{ fontFamily: '"DM Sans", Helvetica' }}>
                            MOTTO
                        </h3>
                    </div>
                    <h3 className="text-[32px] font-black tracking-[-0.96px] leading-normal uppercase text-white -mt-2 ml-6" style={{ fontFamily: '"DM Sans", Helvetica' }}>
                        PLACEHOLDER
                    </h3>
                </div>

                <p className="text-[14px] font-normal text-white tracking-[-0.42px] leading-normal text-left mx-auto" style={{ fontFamily: '"DM Sans", Helvetica' }}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum
                </p>
            </div>
        </div>
    );
};
