// src/pages/PaymentsPage.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CreditCard, Plus, Smartphone, Building2, Check } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";

const PaymentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [showAddUPI, setShowAddUPI] = useState(false);
    const [upiInput, setUpiInput] = useState("");
    const [savedUPI, setSavedUPI] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem("saved_upis") || "[]"); } catch { return []; }
    });
    const [defaultUPI, setDefaultUPI] = useState(() => localStorage.getItem("default_upi") || "");

    const addUPI = () => {
        const trimmed = upiInput.trim();
        if (!trimmed || !trimmed.includes("@")) return;
        const updated = [...new Set([...savedUPI, trimmed])];
        setSavedUPI(updated);
        localStorage.setItem("saved_upis", JSON.stringify(updated));
        if (!defaultUPI) {
            setDefaultUPI(trimmed);
            localStorage.setItem("default_upi", trimmed);
        }
        setUpiInput("");
        setShowAddUPI(false);
    };

    const setDefault = (upi: string) => {
        setDefaultUPI(upi);
        localStorage.setItem("default_upi", upi);
    };

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Payment Methods</h1>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-6">

                {/* UPI Section */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">UPI IDs</h2>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 overflow-hidden">
                        {savedUPI.length === 0 && !showAddUPI && (
                            <div className="px-4 py-6 text-center">
                                <Smartphone className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                                <p className="text-zinc-500 text-sm">No UPI IDs saved yet</p>
                            </div>
                        )}
                        {savedUPI.map((upi, i) => (
                            <div key={upi} className={`flex items-center gap-3 px-4 py-4 ${i < savedUPI.length - 1 ? "border-b border-white/5" : ""}`}>
                                <div className="w-10 h-10 rounded-xl bg-[#ff4d6d]/20 flex items-center justify-center">
                                    <Smartphone className="w-5 h-5 text-[#ff4d6d]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{upi}</p>
                                    {upi === defaultUPI && (
                                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide">Default</span>
                                    )}
                                </div>
                                {upi !== defaultUPI && (
                                    <button
                                        onClick={() => setDefault(upi)}
                                        className="text-xs text-zinc-500 hover:text-white transition-colors font-medium"
                                    >
                                        Set Default
                                    </button>
                                )}
                                {upi === defaultUPI && (
                                    <Check className="w-4 h-4 text-green-400" />
                                )}
                            </div>
                        ))}
                        {showAddUPI && (
                            <div className="px-4 py-4 border-t border-white/5">
                                <input
                                    autoFocus
                                    type="text"
                                    value={upiInput}
                                    onChange={e => setUpiInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addUPI()}
                                    placeholder="yourname@upi"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none placeholder:text-zinc-600 focus:border-[#ff4d6d]/50 transition-colors"
                                />
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => setShowAddUPI(false)}
                                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={addUPI}
                                        className="flex-1 py-2.5 rounded-xl bg-[#ff4d6d] text-white text-sm font-bold"
                                    >
                                        Add UPI
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {!showAddUPI && (
                        <button
                            onClick={() => setShowAddUPI(true)}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-white/15 text-zinc-400 text-sm font-semibold hover:border-[#ff4d6d]/40 hover:text-white transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add UPI ID
                        </button>
                    )}
                </motion.div>

                {/* Cards placeholder */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Debit / Credit Cards</h2>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5">
                        <div className="px-4 py-6 text-center">
                            <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                            <p className="text-zinc-500 text-sm">No cards saved yet</p>
                        </div>
                    </div>
                    <button className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-white/15 text-zinc-400 text-sm font-semibold hover:border-[#ff4d6d]/40 hover:text-white transition-all">
                        <Plus className="w-4 h-4" />
                        Add Card
                    </button>
                </motion.div>

                {/* Net Banking placeholder */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Net Banking</h2>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5">
                        <div className="px-4 py-6 text-center">
                            <Building2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                            <p className="text-zinc-500 text-sm">Configure during checkout</p>
                        </div>
                    </div>
                </motion.div>

                <p className="text-center text-xs text-zinc-700 pb-2">
                    🔒 Your payment info is encrypted and secure
                </p>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default PaymentsPage;
