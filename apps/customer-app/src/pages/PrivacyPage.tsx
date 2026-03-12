// src/pages/PrivacyPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";

const SECTIONS = [
    {
        title: "1. What Information Do We Collect?",
        content: "We collect personal information that you voluntarily provide to us when you register, express interest in our products, or contact us. This includes names, phone numbers, email addresses, mailing addresses, usernames, passwords, and billing information. We also automatically collect certain technical information (IP addresses, browser characteristics, location) when you visit our Services."
    },
    {
        title: "2. How Do We Process Your Information?",
        content: "We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with the law. We may also process your information for other purposes with your consent."
    },
    {
        title: "3. When And With Whom Do We Share Your Information?",
        content: "We may share information in specific situations and with specific third parties, such as during business transfers, for legal compliance, or with service providers who help us operate our platform."
    },
    {
        title: "4. Cookies & Tracking Technologies",
        content: "We use cookies and similar tracking technologies to access or store information. You can control cookie settings through your device's browser settings."
    },
    {
        title: "5. How Do We Keep Your Information Safe?",
        content: "We have implemented technical and organizational security measures designed to protect your data. However, no electronic transmission over the internet can be guaranteed to be 100% secure, so we cannot promise absolute security."
    },
    {
        title: "6. What Are Your Privacy Rights?",
        content: "Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data. You can exercise these rights by contacting us."
    },
    {
        title: "7. Contact Us",
        content: "If you have questions or concerns about this notice, you may email us at businessrep@popclozet.in or contact us by post at: Popclozet Fashion Pvt Ltd, Mumbai, Maharashtra, India."
    },
];

const PrivacyPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
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
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#ff4d6d]/15 to-purple-500/10 border border-[#ff4d6d]/20 mb-6"
                >
                    <div className="w-12 h-12 rounded-xl bg-[#ff4d6d]/20 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-[#ff4d6d]" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">Your Privacy Matters</p>
                        <p className="text-zinc-500 text-xs mt-0.5">Last updated: March 08, 2026</p>
                    </div>
                </motion.div>

                {/* Sections */}
                <div className="space-y-5">
                    {SECTIONS.map((section, i) => (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i }}
                            className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 p-5"
                        >
                            <h2 className="text-white font-bold text-sm mb-2">{section.title}</h2>
                            <p className="text-zinc-500 text-sm leading-relaxed">{section.content}</p>
                        </motion.div>
                    ))}
                </div>

                <p className="text-center text-xs text-zinc-700 mt-8 pb-2">
                    © 2026 PopClozet Pvt. Ltd. All rights reserved.
                </p>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default PrivacyPage;
