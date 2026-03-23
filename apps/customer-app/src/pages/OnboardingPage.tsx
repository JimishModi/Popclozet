import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import logoImage from "@/logo/logo.png";

// Grid items for the animated marquee
const GRID_ITEMS = Array.from({ length: 15 }, (_, i) => ({ id: i }));

export default function OnboardingPage() {
    const navigate = useNavigate();

    return (
        <MobileShell className="bg-zinc-900 text-white overflow-hidden">
            <div className="flex flex-col min-h-screen">
                {/* Title */}
                <div className="text-center pt-10 pb-4 relative z-10">
                    <p className="text-zinc-400 text-sm font-medium tracking-widest uppercase mb-2">Welcome to</p>
                    <img src={logoImage} alt="PopClozet" className="h-10 mx-auto" />
                </div>

                {/* Animated Grid Container */}
                <div className="flex-1 relative overflow-hidden">
                    <div className="absolute inset-0 flex gap-2 px-2">
                        {/* Column 1 - Scrolling Up */}
                        <div className="flex-1 overflow-hidden">
                            <motion.div
                                className="flex flex-col gap-2"
                                animate={{ y: [0, -500] }}
                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            >
                                {[...GRID_ITEMS, ...GRID_ITEMS].map((item, idx) => (
                                    <div
                                        key={`col1-${idx}`}
                                        className="aspect-[3/4] rounded-xl bg-zinc-800 border border-[#f2546d]/20"
                                    />
                                ))}
                            </motion.div>
                        </div>

                        {/* Column 2 - Scrolling Down */}
                        <div className="flex-1 overflow-hidden">
                            <motion.div
                                className="flex flex-col gap-2"
                                initial={{ y: -500 }}
                                animate={{ y: [0, 500] }}
                                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                            >
                                {[...GRID_ITEMS, ...GRID_ITEMS].map((item, idx) => (
                                    <div
                                        key={`col2-${idx}`}
                                        className="aspect-[3/4] rounded-xl bg-zinc-800 border border-[#f2546d]/20"
                                    />
                                ))}
                            </motion.div>
                        </div>

                        {/* Column 3 - Scrolling Up */}
                        <div className="flex-1 overflow-hidden">
                            <motion.div
                                className="flex flex-col gap-2"
                                animate={{ y: [0, -600] }}
                                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                            >
                                {[...GRID_ITEMS, ...GRID_ITEMS].map((item, idx) => (
                                    <div
                                        key={`col3-${idx}`}
                                        className="aspect-[3/4] rounded-xl bg-zinc-800 border border-[#f2546d]/20"
                                    />
                                ))}
                            </motion.div>
                        </div>

                        {/* Column 4 - Scrolling Down */}
                        <div className="flex-1 overflow-hidden">
                            <motion.div
                                className="flex flex-col gap-2"
                                initial={{ y: -400 }}
                                animate={{ y: [0, 400] }}
                                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                            >
                                {[...GRID_ITEMS, ...GRID_ITEMS].map((item, idx) => (
                                    <div
                                        key={`col4-${idx}`}
                                        className="aspect-[3/4] rounded-xl bg-zinc-800 border border-[#f2546d]/20"
                                    />
                                ))}
                            </motion.div>
                        </div>
                    </div>

                    {/* Gradient Overlays */}
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-zinc-900 to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-zinc-900 to-transparent z-10 pointer-events-none" />
                </div>

                {/* Bottom CTAs */}
                <div className="relative z-20 px-6 pb-8 pt-4 bg-zinc-900">
                    <button
                        onClick={() => {
                            localStorage.setItem("onboarding_completed", "true");
                            navigate("/home");
                        }}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-500 text-white font-bold text-lg shadow-lg shadow-[#f2546d]/30 hover:shadow-[#f2546d]/50 transition-all mb-3"
                    >
                        Continue
                    </button>
                    <button
                        onClick={() => {
                            localStorage.setItem("onboarding_completed", "true");
                            navigate("/home");
                        }}
                        className="w-full py-3 text-zinc-400 font-medium hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                        Start browsing <span className="text-lg">›</span>
                    </button>
                </div>
            </div>
        </MobileShell>
    );
}
