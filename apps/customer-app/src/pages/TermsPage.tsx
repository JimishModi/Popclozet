// src/pages/TermsPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, FileText, AlertTriangle, ShieldCheck, Scale } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";

const SECTIONS = [
    {
        title: "1. Nature of Services",
        icon: <FileText className="w-5 h-5 text-blue-400" />,
        content: "Popclozet is a hyperlocal fashion rental utility providing 60-minute delivery of sneakers, jackets, and more. All products remain the exclusive property of Popclozet unless legally sold. Rental constitute temporary bailment, not ownership."
    },
    {
        title: "2. Payment Authorization",
        icon: <ShieldCheck className="w-5 h-5 text-green-400" />,
        content: "By placing an order, you authorize us to tokenize and retain your payment credentials via RBI-compliant gateways. You grant irrevocable consent for automated charges for damage, late returns, or Deemed Sales without fresh OTP."
    },
    {
        title: "3. Damage & Deemed Sale",
        icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
        content: "Tier 1: Normal wear covered. Tier 2: Major damage (stains, rips) = Repair + 20%. Tier 3: Non-return within 24h of slot = Deemed Sale. You are immediately liable for 110% of Retail MRP, and we are authorized to charge your stored method."
    },
    {
        title: "4. Criminal Liability Warning",
        icon: <Scale className="w-5 h-5 text-red-400" />,
        content: "Unauthorized retention or concealment may constitute criminal offenses under Sections 403 & 405 of the IPC. Popclozet reserves the right to initiate FIR proceedings, file criminal complaints, and engage recovery agencies."
    },
    {
        title: "5. Cleaning Policy",
        icon: <AlertTriangle className="w-5 h-5 text-purple-400" />,
        content: "Users are STRICTLY PROHIBITED from washing, ironing, or dry cleaning items. Domestic methods damage fabrics and RFID tags. Violation results in automatic Tier 2 (Major Damage) liability."
    },
    {
        title: "6. Privacy & Arbitration",
        icon: <ShieldCheck className="w-5 h-5 text-indigo-400" />,
        content: "Governed by Indian Law. Disputes are subject to binding arbitration in Mumbai. You waive the right to class action. Mumbai courts have exclusive jurisdiction."
    },
];

const TermsPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MobileShell className="bg-black text-white">
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
                        <p className="text-zinc-500 text-xs mt-0.5">Last updated: March 08, 2026</p>
                    </div>
                </motion.div>

                {/* Warning Alert */}
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">Important Notice</p>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                        By using our Services, you agree to be legally bound by these terms. Unauthorized retention of rented items may lead to criminal prosecution under IPC Sections 403 & 405.
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-4">
                    {SECTIONS.map((section, i) => (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className="bg-zinc-900/50 rounded-2xl border border-white/5 p-5"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg bg-white/5">
                                    {section.icon}
                                </div>
                                <h2 className="text-white font-bold text-sm">{section.title}</h2>
                            </div>
                            <p className="text-zinc-400 text-xs leading-relaxed">{section.content}</p>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-8 p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                    <p className="text-zinc-500 text-[10px] leading-relaxed mb-4">
                        Popclozet Fashion Pvt Ltd<br />
                        SANE Colony, Haveli Pimpri Chikhali, Pune, Maharashtra 411062<br />
                        Email: businessrep@popclozet.in
                    </p>
                    <p className="text-zinc-700 text-[10px]">
                        © 2026 PopClozet. All rights reserved.
                    </p>
                </div>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default TermsPage;
