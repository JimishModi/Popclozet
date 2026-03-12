// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Settings, Heart, ShoppingBag, LogOut, ChevronRight,
  Bell, CreditCard, HelpCircle, Shield, Sparkles, X,
  Edit3, Check, Loader2, Phone, Mail, Package
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { cn } from "@/lib/utils";
import { ClosetIcon } from "@/components/icons/ClosetIcon";
import { useNavigate } from "react-router-dom";
import logo from "@/logo/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/context/WishlistContext";
import { useOrders } from "@/hooks/useOrders";
import { supabase } from "@popclozet/api-client";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const { wishlistItems } = useWishlist();
  const { orders, loading: ordersLoading } = useOrders();

  // Count items currently "In Closet" = active rentals (delivered, not yet picked up)
  const inClosetCount = orders.filter(o =>
    ["delivered", "out_for_delivery", "preparing", "confirmed", "pending"].includes(o.status)
  ).length;

  const quickStats = [
    {
      label: "Orders",
      value: ordersLoading ? "…" : String(orders.length),
      icon: ShoppingBag,
      href: "/orders"
    },
    {
      label: "Wishlist",
      value: String(wishlistItems.length),
      icon: Heart,
      href: "/wishlist"
    },
    {
      label: "In Closet",
      value: ordersLoading ? "…" : String(inClosetCount),
      icon: ClosetIcon,
      href: "/closet"
    },
  ];

  const menuSections = [
    {
      title: "Account",
      items: [
        { icon: Heart, label: "My Wishlist", href: "/wishlist", badge: wishlistItems.length > 0 ? String(wishlistItems.length) : undefined },
        { icon: ShoppingBag, label: "My Orders", href: "/orders" },
        { icon: CreditCard, label: "Payment Methods", href: "/payments" },
      ]
    },
    {
      title: "Preferences",
      items: [
        { icon: Bell, label: "Notifications", href: "/notifications" },
        { icon: Settings, label: "Settings", href: "/settings" },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Center", href: "/help" },
        { icon: Sparkles, label: "About PopClozet", href: "/about-us" },
        { icon: Shield, label: "Privacy Policy", href: "/privacy" },
      ]
    },
  ];

  // ── Edit Profile Sheet ──────────────────────────────────────────────────────
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (showEditSheet) {
      setEditName(profile?.full_name || user?.user_metadata?.full_name || "");
      setEditPhone(profile?.phone || user?.phone || "");
      setSaveError("");
    }
  }, [showEditSheet, profile, user]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setSaveError("Name is required");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await updateProfile({ full_name: editName.trim(), phone: editPhone.trim() });
      setShowEditSheet(false);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const rawName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const displayName = (() => { const first = rawName.trim().split(/\s+/)[0]; return first.charAt(0).toUpperCase() + first.slice(1); })();
  const displaySub = profile?.phone || user?.email || "Signed in";

  return (
    <MobileShell className="bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <img src={logo} alt="POPCLOZET" className="h-6 w-auto object-contain" />
        <button
          onClick={() => navigate("/settings")}
          className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
        >
          <Settings className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Loading skeleton */}
        {loading && (
          <div className="px-4 pt-8 space-y-4 animate-pulse">
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-white/10 rounded-lg w-3/4" />
                  <div className="h-3 bg-white/10 rounded-lg w-1/2" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5 h-24" />
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* Hero Profile Section */}
            <div className="relative px-4 pt-8 pb-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-[#ff4d6d]/15 via-purple-500/10 to-transparent pointer-events-none" />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff4d6d] via-purple-500 to-blue-500 p-[3px]">
                      <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                        <User className="w-10 h-10 text-white/80" />
                      </div>
                    </div>
                    {user && (
                      <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-zinc-900 shadow-[0_0_12px_rgba(34,197,94,0.6)] flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1 truncate">
                      {user ? `Hi, ${displayName}` : "Welcome!"}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-3 truncate">
                      {user ? displaySub : "Sign in to unlock your closet"}
                    </p>
                    {user ? (
                      <button
                        onClick={() => setShowEditSheet(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/8 border border-white/10 text-zinc-300 text-xs font-semibold hover:bg-white/15 transition-all active:scale-95"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit Profile
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate("/auth/login")}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white text-sm font-bold shadow-[0_10px_30px_rgba(255,77,109,0.4)] transition-all active:scale-95"
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Quick Stats Row — live data */}
            <div className="px-4 mb-6">
              <div className="grid grid-cols-3 gap-3">
                {quickStats.map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05 }}
                      onClick={() => navigate(stat.href)}
                      className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/5 text-center group hover:border-[#ff4d6d]/30 transition-all cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-[#ff4d6d]/20 flex items-center justify-center mx-auto mb-2 transition-colors">
                        <Icon className="w-5 h-5 text-[#ff4d6d]" />
                      </div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">{stat.label}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Menu Sections */}
            <div className="px-4 space-y-6">
              {menuSections.map((section, sectionIdx) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + sectionIdx * 0.05 }}
                >
                  <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] mb-3 pl-1">{section.title}</h2>
                  <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                    {section.items.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => navigate(item.href)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-4 group text-left",
                            "hover:bg-white/5 transition-all",
                            index < section.items.length - 1 && "border-b border-white/5"
                          )}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[#ff4d6d]/20 transition-colors">
                            <Icon className="w-5 h-5 text-zinc-500 group-hover:text-[#ff4d6d] transition-colors" />
                          </div>
                          <span className="flex-1 text-white font-medium">{item.label}</span>
                          {item.badge && (
                            <span className="px-2.5 py-1 rounded-full bg-[#ff4d6d]/20 text-[#ff4d6d] text-xs font-bold">
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Logout Button */}
            {user && (
              <div className="px-4 mt-8">
                <button
                  onClick={() => navigate("/auth/signout")}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            )}

            {/* App Info Footer */}
            <div className="mt-12 text-center pb-4">
              <p className="text-xs text-zinc-700 font-medium">PopClozet v1.0.0</p>
              <p className="text-xs text-zinc-800 mt-1">Made with ❤️ in Mumbai</p>
            </div>
          </>
        )}
      </main>

      {/* Edit Profile Bottom Sheet */}
      <AnimatePresence>
        {showEditSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditSheet(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-50 bg-[#111111] rounded-t-3xl border-t border-white/10 px-5 pt-5 pb-10"
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Edit Profile</h2>
                <button
                  onClick={() => setShowEditSheet(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Full Name</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-[#ff4d6d]/50 transition-colors">
                    <User className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Your full name"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Phone Number</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-[#ff4d6d]/50 transition-colors">
                    <Phone className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Email (read-only) */}
                {user?.email && (
                  <div>
                    <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Email</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/5">
                      <Mail className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                      <span className="text-zinc-600 text-sm">{user.email}</span>
                    </div>
                    <p className="text-[10px] text-zinc-700 mt-1 pl-1">Email cannot be changed here</p>
                  </div>
                )}

                {saveError && (
                  <p className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{saveError}</p>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white font-bold text-sm shadow-[0_10px_30px_rgba(255,77,109,0.3)] hover:shadow-[0_14px_40px_rgba(255,77,109,0.4)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Check className="w-4 h-4" /> Save Changes</>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNavBar />
    </MobileShell>
  );
};

export default ProfilePage;
