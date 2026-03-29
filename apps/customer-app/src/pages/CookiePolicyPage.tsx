// src/pages/CookiePolicyPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Cookie } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
const SECTIONS = [
    {
        title: "1. What are cookies?",
        content: "Cookies are small data files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work, or to work more efficiently, as well as to provide reporting information."
    },
    {
        title: "2. Why do we use cookies?",
        content: "We use first- and third-party cookies for several reasons. Some are required for technical reasons ('essential' cookies), while others enable us to track and target the interests of our users to enhance their experience."
    },
    {
        title: "3. How can I control cookies?",
        content: "You have the right to decide whether to accept or reject cookies. You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, your access to some functionality and areas of our Website may be restricted."
    },
    {
        title: "4. Specific Cookies We Use",
        content: "We use analytics and customization cookies (e.g., s7 by Adobe Analytics) to understand site usage. We also use session storage (e.g., welcomeSeen) and local storage (e.g., cart) to maintain your experience and shopping cart."
    },
    {
        title: "5. Other tracking technologies",
        content: "We may use other similar technologies like web beacons (tracking pixels) to monitor traffic patterns, understand if you came from an online advertisement, and measure the success of email marketing campaigns."
    },
    {
        title: "6. Targeted advertising",
        content: "Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These companies may use information about your visits to this and other websites to provide relevant advertisements."
    },
    {
        title: "7. Contact Us",
        content: "If you have any questions about our use of cookies or other technologies, please email us at businessrep@popclozet.in or post to: Popclozet Fashion Pvt Ltd, SANE Colony, haveli Pimpri chikhali, Pune, Maharashtra 411062, India. Phone: +91 77559 02716"
    },
];

const CookiePolicyPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95">
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Cookie Policy</h1>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
                {/* Hero */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 mb-6"
                >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Cookie className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">Cookie Preferences</p>
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
                    © 2026 Popclozet Pvt. Ltd. All rights reserved.
                </p>
            </main>
        </MobileShell>
    );
};

export default CookiePolicyPage;
