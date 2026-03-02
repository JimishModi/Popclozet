// src/pages/PrivacyPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";

const SECTIONS = [
    {
        title: "Information We Collect",
        content: "We collect information you provide directly to us, such as your name, phone number, email address, and delivery address when you create an account or place a rental order. We also collect usage data and device information to improve your experience."
    },
    {
        title: "How We Use Your Information",
        content: "We use your information to: process and fulfill rental orders, send order updates and delivery notifications, improve our services and personalize your experience, communicate offers and promotions (only with your consent), and comply with legal obligations."
    },
    {
        title: "Information Sharing",
        content: "We do not sell your personal information. We share your details only with delivery partners to fulfill orders, payment processors for secure transactions, and service providers who help us operate our platform, all under strict confidentiality agreements."
    },
    {
        title: "Data Security",
        content: "We implement industry-standard security measures including encryption in transit (TLS), secure data storage, and access controls. Your payment information is handled by certified third-party payment processors and is never stored on our servers."
    },
    {
        title: "Your Rights",
        content: "You have the right to access, correct, or delete your personal data. You may also request data portability or withdraw consent for marketing communications at any time through the app's notification settings or by contacting us."
    },
    {
        title: "Cookies & Tracking",
        content: "We use cookies and similar technologies to remember your preferences and understand how you use our app. You can control cookie settings through your device's browser settings."
    },
    {
        title: "Contact Us",
        content: "For any privacy-related questions or requests, contact our privacy team at privacy@popclozet.com or write to: PopClozet Pvt. Ltd., Mumbai, Maharashtra, India."
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
                        <p className="text-zinc-500 text-xs mt-0.5">Last updated: March 2026</p>
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
