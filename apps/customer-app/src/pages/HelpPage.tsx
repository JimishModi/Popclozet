// src/pages/HelpPage.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, MessageCircle, Mail, Phone as PhoneIcon } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
const FAQS = [
    {
        q: "How does renting work?",
        a: "Browse our collection, choose an item, select your rental dates, and checkout. We deliver to your door. After your rental period, we pick it up — no laundry needed!"
    },
    {
        q: "What if the item doesn't fit?",
        a: "If an item doesn't fit, contact us within 2 hours of delivery and we'll arrange a quick exchange where possible, subject to availability."
    },
    {
        q: "How do I return my rental?",
        a: "Go to My Closet → Schedule Return. Our rider will pick up the item from your address. No need to wash or dry-clean — we handle that."
    },
    {
        q: "Is there a security deposit?",
        a: "No! popclozet operates on a zero-deposit model. You only pay the rental fee and delivery charges — no upfront security amount required."
    },
    {
        q: "What if something gets damaged?",
        a: "Minor wear and tear is expected and covered. For major damage, a repair fee may apply based on the assessed extent of damage."
    },
    {
        q: "Can I extend my rental period?",
        a: "Yes! Reach out to us via chat or phone at least 24 hours before your scheduled pickup and we'll try our best to accommodate an extension."
    },
    {
        q: "Which cities do you serve?",
        a: "We currently serve Mumbai. We're expanding rapidly — check the app for the latest coverage in your area."
    },
];

const HelpPage: React.FC = () => {
    const navigate = useNavigate();
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95">
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Help Center</h1>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-6">

                {/* Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#f2546d]/20 to-purple-500/10 border border-[#f2546d]/20 p-5"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#f2546d]/5 to-transparent pointer-events-none" />
                    <h2 className="text-white font-bold text-lg mb-1">How can we help?</h2>
                    <p className="text-zinc-400 text-sm">Browse FAQs or reach us directly — we're here for you.</p>
                </motion.div>

                {/* FAQs */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Frequently Asked Questions</h2>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 overflow-hidden">
                        {FAQS.map((faq, i) => (
                            <div key={i} className={i < FAQS.length - 1 ? "border-b border-white/5" : ""}>
                                <button
                                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/3 transition-colors"
                                >
                                    <span className="flex-1 text-white text-sm font-medium">{faq.q}</span>
                                    <ChevronDown className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${openIdx === i ? "rotate-180" : ""}`} />
                                </button>
                                <AnimatePresence>
                                    {openIdx === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="px-4 pb-4 text-zinc-500 text-sm leading-relaxed">{faq.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Contact */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Contact Us</h2>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 overflow-hidden">
                        {[
                            { icon: Mail, label: "Email Support", sub: "businessrep@popclozet.in", action: () => window.open("mailto:businessrep@popclozet.in") },
                            { icon: PhoneIcon, label: "Call Us", sub: "+91 98765 43210", action: () => window.open("tel:+919876543210") },
                        ].map((item, i, arr) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    onClick={item.action}
                                    className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/5 transition-colors ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[#f2546d]/20 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-[#f2546d]" />
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-medium">{item.label}</p>
                                        <p className="text-zinc-600 text-xs">{item.sub}</p>
                                    </div>
                                    <ChevronLeft className="w-4 h-4 text-zinc-700 ml-auto rotate-180" />
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            </main>
        </MobileShell>
    );
};

export default HelpPage;
