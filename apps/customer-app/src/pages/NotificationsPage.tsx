// src/pages/NotificationsPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, Package, Heart, Tag, Info, Truck, MessageCircle, MapPin, CheckCircle } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { useOrders } from "@/hooks/useOrders";
import { supabase } from "@popclozet/api-client";
import { useAuth } from "@popclozet/auth";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface SupabaseNotification {
    id: string;
    type: string;
    title: string;
    body?: string;
    message?: string;
    order_id?: string;
    is_read: boolean;
    created_at: string;
    metadata?: Record<string, any>;
}

const NOTIF_ICON_MAP: Record<string, { icon: any; color: string; bg: string }> = {
    order_dispatched: { icon: Truck, color: "text-purple-400", bg: "bg-purple-500/20" },
    order_picked_up: { icon: Package, color: "text-emerald-400", bg: "bg-emerald-500/20" },
    out_for_delivery: { icon: MapPin, color: "text-blue-400", bg: "bg-blue-500/20" },
    rider_message: { icon: MessageCircle, color: "text-amber-400", bg: "bg-amber-500/20" },
    rider_arrived_warehouse: { icon: Truck, color: "text-blue-400", bg: "bg-blue-500/20" },
    delivered: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/20" },
};

const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const { orders } = useOrders();
    const { user } = useAuth();
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Supabase notifications
    const [supaNotifs, setSupaNotifs] = useState<SupabaseNotification[]>([]);
    const [notifsLoading, setNotifsLoading] = useState(true);

    // Notification toggles – persisted to localStorage
    const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("notif_push") !== "false");
    const [orderUpdates, setOrderUpdates] = useState(() => localStorage.getItem("notif_orders") !== "false");
    const [promoAlerts, setPromoAlerts] = useState(() => localStorage.getItem("notif_promos") === "true");
    const [wishlistAlerts, setWishlistAlerts] = useState(() => localStorage.getItem("notif_wishlist") !== "false");

    const toggle = (key: string, val: boolean, setter: (v: boolean) => void) => {
        setter(val);
        localStorage.setItem(key, String(val));
    };

    // Fetch notifications from Supabase
    useEffect(() => {
        if (!user?.id) {
            setNotifsLoading(false);
            return;
        }

        const fetchNotifications = async () => {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (!error && data) {
                setSupaNotifs(data as SupabaseNotification[]);
            }
            setNotifsLoading(false);
        };

        fetchNotifications();

        // Realtime subscription for new notifications
        const channel = supabase
            .channel(`customer_notifs_${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    setSupaNotifs((prev) => [payload.new as SupabaseNotification, ...prev]);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [user?.id]);

    // Build order-based notifications
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

                {/* Rider / Dispatch Notifications — from Supabase */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Delivery Updates</h2>
                    {notifsLoading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />)}
                        </div>
                    ) : supaNotifs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-3">
                                <Bell className="w-6 h-6 text-zinc-600" />
                            </div>
                            <p className="text-zinc-500 text-sm">No delivery updates yet</p>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-white/8 to-white/3 rounded-2xl border border-white/5 overflow-hidden">
                            {supaNotifs.map((notif, i) => {
                                const iconConfig = NOTIF_ICON_MAP[notif.type] || { icon: Bell, color: "text-zinc-400", bg: "bg-zinc-500/20" };
                                const Icon = iconConfig.icon;
                                const displayBody = notif.body || notif.message || "";
                                const riderName = notif.metadata?.rider_name;

                                return (
                                    <div
                                        key={notif.id}
                                        className={`flex items-start gap-3 px-4 py-4 ${!notif.is_read ? "bg-white/[0.03]" : ""} ${i < supaNotifs.length - 1 ? "border-b border-white/5" : ""}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${iconConfig.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                            <Icon className={`w-5 h-5 ${iconConfig.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-white text-sm font-semibold">{notif.title}</p>
                                                {!notif.is_read && (
                                                    <div className="w-2 h-2 rounded-full bg-[#ff4d6d] shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                            <p className="text-zinc-500 text-xs mt-0.5">{displayBody}</p>
                                            {riderName && (
                                                <p className="text-zinc-600 text-[10px] mt-1">Rider: {riderName}</p>
                                            )}
                                        </div>
                                        <span className="text-zinc-700 text-[10px] flex-shrink-0">
                                            {new Date(notif.created_at).toLocaleDateString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Preferences */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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

                {/* Recent Activity from Orders */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">Order Activity</h2>
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

