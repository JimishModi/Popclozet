import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import logoImage from "@/logo/logo.png";

export default function WelcomePage() {
    const navigate = useNavigate();

    return (
        <MobileShell className="bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 text-white">
            <div className="flex flex-col items-center justify-between min-h-screen py-8 px-6">
                {/* Title */}
                <div className="text-center pt-8">
                    <p className="text-zinc-400 text-sm font-medium tracking-widest uppercase mb-2">Welcome to</p>
                    <img src={logoImage} alt="PopClozet" className="h-10 mx-auto" />
                </div>

                {/* Phone Mockup */}
                <div className="relative flex-1 flex items-center justify-center py-8">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="relative w-64 h-[28rem] bg-zinc-950 rounded-[2.5rem] border-4 border-zinc-800 shadow-2xl overflow-hidden"
                    >
                        {/* Phone Notch */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-zinc-800 rounded-full z-10" />

                        {/* Screen Content Preview */}
                        <div className="absolute inset-3 top-8 rounded-[2rem] bg-black overflow-hidden">
                            {/* Mini Header */}
                            <div className="px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-[#ff4d6d] font-bold">DELIVERY IN</span>
                                    <span className="text-[10px] text-white font-bold">15 Minutes</span>
                                </div>
                            </div>

                            {/* Mini Gender Toggle */}
                            <div className="mx-3 h-6 bg-zinc-800 rounded-lg flex items-center p-0.5 mb-2">
                                <div className="flex-1 h-full bg-[#ff4d6d] rounded-md flex items-center justify-center">
                                    <span className="text-[8px] text-white font-bold">WOMEN</span>
                                </div>
                                <div className="flex-1 h-full flex items-center justify-center">
                                    <span className="text-[8px] text-zinc-500 font-bold">MEN</span>
                                </div>
                            </div>

                            {/* Mini Search */}
                            <div className="mx-3 h-6 bg-zinc-800 rounded-lg mb-3" />

                            {/* Mini Featured Card */}
                            <div className="mx-3 h-24 bg-zinc-800 rounded-xl mb-3" />

                            {/* Mini Collections */}
                            <div className="px-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[8px] text-white font-bold">Collections</span>
                                    <span className="text-[6px] text-[#ff4d6d]">See all</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <div className="h-12 bg-zinc-800 rounded-lg" />
                                    <div className="h-12 bg-zinc-800 rounded-lg" />
                                </div>
                            </div>

                            {/* Mini Banner */}
                            <div className="mx-3 mt-3 h-8 bg-[#ff4d6d]/20 border border-[#ff4d6d]/30 rounded-lg flex items-center px-2">
                                <span className="text-[7px] text-white">Schedule Return</span>
                            </div>

                            {/* Mini Nav */}
                            <div className="absolute bottom-0 left-0 right-0 h-10 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-around px-2">
                                <div className="w-4 h-4 rounded-full bg-[#ff4d6d]" />
                                <div className="w-4 h-4 rounded-full bg-zinc-700" />
                                <div className="w-4 h-4 rounded-full bg-zinc-700" />
                                <div className="w-4 h-4 rounded-full bg-zinc-700" />
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Bottom CTAs */}
                <div className="w-full space-y-3">
                    <button
                        onClick={() => navigate("/onboarding")}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-lg shadow-lg shadow-[#ff4d6d]/30 hover:shadow-[#ff4d6d]/50 transition-all"
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
