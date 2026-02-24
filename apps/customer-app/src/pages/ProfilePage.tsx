// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Settings, Heart, ShoppingBag, LogOut, ChevronRight, Bell, CreditCard, HelpCircle, Shield, Sparkles, Ruler } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import logo from "@/logo/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { saveUserMeasurements, getUserMeasurements, type BodyType, type UserMeasurements } from "@/services/userMeasurementService";

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'petite', label: 'Petite' },
  { value: 'slim', label: 'Slim' },
  { value: 'regular', label: 'Regular' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'curvy', label: 'Curvy' },
  { value: 'plus', label: 'Plus' },
];

function MeasurementsSection({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [measurements, setMeasurements] = useState<Partial<UserMeasurements>>({
    bust: 0, waist: 0, hip: 0, height: 0, weight: 0, bodyType: 'regular',
  });

  useEffect(() => {
    getUserMeasurements(userId).then((m) => {
      if (m) setMeasurements(m);
    });
  }, [userId]);

  const handleSave = async () => {
    await saveUserMeasurements({
      userId,
      bust: measurements.bust || 0,
      waist: measurements.waist || 0,
      hip: measurements.hip || 0,
      height: measurements.height || 0,
      weight: measurements.weight || 0,
      bodyType: measurements.bodyType || 'regular',
      updatedAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateField = (field: string, value: number | string) =>
    setMeasurements((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="px-4 mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-[#ff4d6d]/30 transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Ruler className="w-5 h-5 text-[#ff4d6d]" />
        </div>
        <span className="flex-1 text-left text-white font-medium">My Measurements</span>
        <ChevronRight className={`w-4 h-4 text-zinc-700 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'bust', label: 'Bust (cm)', icon: '📏' },
              { key: 'waist', label: 'Waist (cm)', icon: '📐' },
              { key: 'hip', label: 'Hip (cm)', icon: '📏' },
              { key: 'height', label: 'Height (cm)', icon: '📐' },
              { key: 'weight', label: 'Weight (kg)', icon: '⚖️' },
            ].map(({ key, label, icon }) => (
              <div key={key}>
                <label className="text-xs text-zinc-500 mb-1 block">{icon} {label}</label>
                <input
                  type="number"
                  value={(measurements as any)[key] || ''}
                  onChange={(e) => updateField(key, Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-[#ff4d6d] outline-none"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Body Type</label>
            <div className="flex flex-wrap gap-2">
              {BODY_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateField('bodyType', value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${measurements.bodyType === value
                    ? 'bg-[#ff4d6d] text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white text-sm font-bold transition-all active:scale-[0.98]"
          >
            {saved ? '✅ Saved!' : 'Save Measurements'}
          </button>
        </motion.div>
      )}
    </div>
  );
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const quickStats = [
    { label: "Orders", value: "12", icon: ShoppingBag, href: "/orders" },
    { label: "Wishlist", value: "8", icon: Heart, href: "/closet?tab=wishlist" },
    { label: "In Closet", value: "3", icon: User, href: "/closet" },
  ];

  const menuSections = [
    {
      title: "Account",
      items: [
        { icon: Heart, label: "My Wishlist", href: "/wishlist", badge: "8" },
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
        { icon: Shield, label: "Privacy Policy", href: "/privacy" },
      ]
    },
  ];

  return (
    <MobileShell className="bg-black text-white">
      {/* Header - Premium Glassmorphism */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <img src={logo} alt="POPCLOZET" className="h-6 w-auto object-contain" />
        <button
          onClick={() => navigate('/settings')}
          className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
        >
          <Settings className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Loading state */}
        {loading && (
          <div className="px-4 pt-10 text-center text-zinc-400">
            Loading profile…
          </div>
        )}

        {!loading && (
          <>
            {/* Hero Profile Section */}
            <div className="relative px-4 pt-8 pb-6 overflow-hidden">
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#ff4d6d]/15 via-purple-500/10 to-transparent pointer-events-none" />

              {/* Profile Card - Premium Glass */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar with Animated Glow Ring */}
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff4d6d] via-purple-500 to-blue-500 p-[3px] animate-pulse">
                      <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                        <User className="w-10 h-10 text-white/80" />
                      </div>
                    </div>
                    {/* Online indicator */}
                    <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-3 border-zinc-900 shadow-[0_0_12px_rgba(34,197,94,0.6)] flex items-center justify-center">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1">
                      {user ? `Hi, ${profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}` : 'Welcome!'}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-3">
                      {user ? (profile?.phone || user.email || 'Signed in') : 'Sign in to unlock your closet'}
                    </p>
                    {!user && (
                      <button
                        onClick={() => navigate('/auth/login')}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 hover:from-[#ff3355] hover:to-pink-500 text-white text-sm font-bold shadow-[0_10px_30px_rgba(255,77,109,0.4)] transition-all active:scale-95"
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Quick Stats Row */}
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
                        <a
                          key={item.label}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-4 group",
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
                        </a>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* My Measurements Section */}
            {user && (
              <MeasurementsSection userId={user.id} />
            )}

            {/* Logout Button */}
            {user && (
              <div className="px-4 mt-8">
                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/auth/login');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            )}

            {/* App Info Footer */}
            <div className="mt-12 text-center pb-4">
              <p className="text-xs text-zinc-700 font-medium">
                PopClozet v1.0.0
              </p>
              <p className="text-xs text-zinc-800 mt-1">
                Made with ❤️ in Mumbai
              </p>
            </div>
          </>
        )}
      </main>

      <BottomNavBar />
    </MobileShell>
  );
};

export default ProfilePage;
