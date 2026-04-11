// src/pages/PrivacyPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PRIVACY_POLICY } from "@/constants/legalDocs";

const PrivacyPage: React.FC = () => {
    const navigate = useNavigate();

    const lastUpdatedMatch = PRIVACY_POLICY.match(/Last updated\s+(.+)/i);
    const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1].trim() : "March 08, 2026";

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95">
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Privacy Policy</h1>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#f2546d]/15 to-purple-500/10 border border-[#f2546d]/20 mb-6"
                >
                    <div className="w-12 h-12 rounded-xl bg-[#f2546d]/20 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-[#f2546d]" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">Your Privacy Matters</p>
                        <p className="text-zinc-500 text-xs mt-0.5">Last updated: {lastUpdated}</p>
                    </div>
                </motion.div>

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 p-5"
                >
                    <div className="text-zinc-400 text-xs leading-relaxed whitespace-pre-line">
                        {PRIVACY_POLICY}
                    </div>
                </motion.div>

                <p className="text-center text-xs text-zinc-700 mt-8 pb-2">
                    © 2026 Popclozet Pvt. Ltd. All rights reserved.
                </p>
            </main>
        </MobileShell>
    );
};

export default PrivacyPage;
