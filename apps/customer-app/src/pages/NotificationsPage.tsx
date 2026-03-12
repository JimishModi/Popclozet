// src/pages/NotificationsPage.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, Package, Heart, Tag, Info } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { useOrders } from "@/hooks/useOrders";

const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const { orders } = useOrders();

    // Notification toggles – persisted to localStorage
    const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("notif_push") !== "false");
    const [orderUpdates, setOrderUpdates] = useState(() => localStorage.getItem("notif_orders") !== "false");
    const [promoAlerts, setPromoAlerts] = useState(() => localStorage.getItem("notif_promos") === "true");
    const [wishlistAlerts, setWishlistAlerts] = useState(() => localStorage.getItem("notif_wishlist") !== "false");

    const toggle = (key: string, val: boolean, setter: (v: boolean) => void) => {
        setter(val);
        localStorage.setItem(key, String(val));
    };

    // Build a notification feed from recent orders
    const orderNotifs = orders.slice(0, 5).map(o => ({
        id: o.id,
        icon: Package,
        color: "text-blue-400",
        bg: "bg-blue-500/20",
        title: `Order #${o.id.slice(-6).toUpperCase()}`,
        body: `Status: ${o.status.replace(/_/g, " ")}`,
        time: new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    }));

    const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
        <button
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${value ? "bg-[#ff4d6d]" : "bg-zinc-700"}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${value ? "translate-x-6" : "translate-x-1"}`} />
        </button>
    );

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate("/profile")} className="p-2 -ml-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                        <ChevronLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Notifications</h1>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-6">

                {/* Preferences */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Preferences</h2>
                    <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 overflow-hidden">
                        {[
                            { key: "notif_push", label: "Push Notifications", sub: "Receive alerts on your device", icon: Bell, value: pushEnabled, setter: setPushEnabled },
                            { key: "notif_orders", label: "Order Updates", sub: "Delivery & pickup status", icon: Package, value: orderUpdates, setter: setOrderUpdates },
                            { key: "notif_promos", label: "Promotions & Offers", sub: "Deals and new arrivals", icon: Tag, value: promoAlerts, setter: setPromoAlerts },
                            { key: "notif_wishlist", label: "Wishlist Alerts", sub: "Price drops on saved items", icon: Heart, value: wishlistAlerts, setter: setWishlistAlerts },
                        ].map((item, i, arr) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.key}
                                    className={`flex items-center gap-3 px-4 py-4 ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-[#ff4d6d]" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white text-sm font-medium">{item.label}</p>
                                        <p className="text-zinc-600 text-xs">{item.sub}</p>
                                    </div>
                                    <Toggle value={item.value} onChange={v => toggle(item.key, v, item.setter)} />
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Recent Notifications from Orders */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Recent Activity</h2>
                    {orderNotifs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-3">
                                <Info className="w-6 h-6 text-zinc-600" />
                            </div>
                            <p className="text-zinc-500 text-sm">No recent activity yet</p>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 overflow-hidden">
                            {orderNotifs.map((notif, i) => {
                                const Icon = notif.icon;
                                return (
                                    <div key={notif.id} className={`flex items-start gap-3 px-4 py-4 ${i < orderNotifs.length - 1 ? "border-b border-white/5" : ""}`}>
                                        <div className={`w-10 h-10 rounded-xl ${notif.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                            <Icon className={`w-5 h-5 ${notif.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-semibold">{notif.title}</p>
                                            <p className="text-zinc-500 text-xs capitalize">{notif.body}</p>
                                        </div>
                                        <span className="text-zinc-700 text-[10px] flex-shrink-0">{notif.time}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default NotificationsPage;
