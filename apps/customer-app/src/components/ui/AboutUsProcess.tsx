import React from "react";
import { motion } from "framer-motion";

const PROCESS_STEPS = [
    {
        title: "Pre-Cleaning",
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 14H21L19 26H9L7 14Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 14H23" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M14 2V14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 6L14 2L18 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 18V22M14 17V23M17 18V22" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
            </svg>
        ),
        details: [
            "Inspect garment for stains, damage, or odors",
            "Remove lint, hair, and debris",
            "Pre-treat visible stains with appropriate stain remover",
            "Empty all pockets"
        ]
    },
    {
        title: "Sanitization",
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 10H16V8H12V5H16V3H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 5H20L21 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="9" y="10" width="8" height="4" rx="1" stroke="white" strokeWidth="1.5" />
                <path d="M10 14L9 25C9 25.5523 9.44772 26 10 26H16C16.5523 26 17 25.5523 17 25L16 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="22" cy="10" r="1" fill="white" opacity="0.5" />
                <circle cx="24" cy="7" r="0.7" fill="white" opacity="0.4" />
                <circle cx="20" cy="8" r="0.7" fill="white" opacity="0.3" />
            </svg>
        ),
        details: [
            "Steam sanitization at 100°C for 10 minutes",
            "UV-C light treatment for 15 minutes",
            "Apply fabric-safe disinfectant spray",
            "Allow to air out for 30 minutes"
        ]
    },
    {
        title: "Post-Cleaning",
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 4V2M10 8C10 8 10 5 14 5C18 5 18 8 18 8M8 8L14 24L20 8H8Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 8H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M9 12H19M10 16H18M11 20H17" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
            </svg>
        ),
        details: [
            "Inspect for remaining stains or damage",
            "Steam press to remove wrinkles",
            "Quality check all fasteners and seams",
            "Package in breathable garment bag"
        ]
    },
    {
        title: "Quality Check",
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2L4 7V13C4 19.63 8.28 25.79 14 27C19.72 25.79 24 19.63 24 13V7L14 2Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 14.5L12.5 17.5L18.5 11.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
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
                            <div className="w-10 h-10 rounded-full bg-[#232323] border border-[#3a3a3a] flex items-center justify-center shrink-0 z-10 shadow-[0_0_15px_rgba(242,84,109,0.15)] relative">
                                {/* The circle behind the icon using the mask group graphic pattern in CSS or inline styling */}
                                <div className="absolute inset-0 bg-[#252525] rounded-full shadow-inner opacity-60 pointer-events-none"></div>
                                <div className="scale-75 z-10">{step.icon}</div>
                            </div>
                            {/* Line connecting the stages */}
                            {index !== PROCESS_STEPS.length - 1 && (
                                <div className="w-[2px] bg-gradient-to-b from-[#f2546d]/50 via-zinc-700 to-zinc-800 flex-1 relative -top-1" />
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
                                        {/* Design-inspired brutalist dot */}
                                        <div className="shrink-0 mt-1 w-3 h-3">
                                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <rect width="12" height="12" fill="#D9D9D9" />
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
