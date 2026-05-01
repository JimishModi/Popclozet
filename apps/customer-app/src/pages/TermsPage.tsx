// src/pages/TermsPage.tsx
import React from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Scale } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { TERMS_AND_CONDITIONS } from "@/constants/legalDocs";

const TermsPage: React.FC = () => {
    const navigate = useNavigate();

    // Extract the "Last Updated" date from the document text
    const lastUpdatedMatch = TERMS_AND_CONDITIONS.match(/Last Updated:\s*(.+)/i);
    const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1].trim() : "March 08, 2026";

    return (
        <MobileShell className="bg-black text-white">
            <Helmet>
                <title>Terms & Conditions | Popclozet</title>
                <meta name="description" content="Read Popclozet's terms and conditions. Understand the rules for renting fashion items and using our platform." />
            </Helmet>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95">
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Legal Terms</h1>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-zinc-500/15 to-zinc-800/10 border border-white/10 mb-6"
                >
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Scale className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">Agreement to Terms</p>
                        <p className="text-zinc-500 text-xs mt-0.5">Last updated: {lastUpdated}</p>
                    </div>
                </motion.div>

                {/* Warning Alert */}
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Important Notice</p>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                        By using our Services, you agree to be legally bound by these terms. Unauthorized retention of rented items may lead to criminal prosecution under IPC Sections 403 &amp; 405.
                    </p>
                </div>

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-zinc-900/50 rounded-2xl border border-white/5 p-5"
                >
                    <div className="text-zinc-400 text-xs leading-relaxed whitespace-pre-line">
                        {TERMS_AND_CONDITIONS}
                    </div>
                </motion.div>

                <div className="mt-8 p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                    <p className="text-zinc-500 text-[10px] leading-relaxed mb-4">
                        Popclozet Fashion Pvt Ltd<br />
                        SANE Colony, Haveli Pimpri Chikhali, Pune, Maharashtra 411062<br />
                        Email: businessrep@popclozet.in
                    </p>
                    <p className="text-zinc-700 text-[10px]">
                        © 2026 Popclozet. All rights reserved.
                    </p>
                </div>
            </main>
        </MobileShell>
    );
};

export default TermsPage;
