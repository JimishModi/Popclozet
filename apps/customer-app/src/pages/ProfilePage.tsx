// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Settings, Heart, ShoppingBag, LogOut, ChevronRight, HelpCircle, MapPin, Ruler, Sparkles } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
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
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-[#161616] p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-pink-900/30 text-pink-400 flex items-center justify-center">
            <Ruler className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-white">My Measurements</div>
            <div className="text-xs text-gray-400">Body type & sizing info</div>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 text-gray-400 group-hover:text-[#EB485B] transition-all ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 p-4 rounded-2xl bg-[#161616] border border-white/5 space-y-4"
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
                <label className="text-xs text-gray-500 mb-1 block">{icon} {label}</label>
                <input
                  type="number"
                  value={(measurements as any)[key] || ''}
                  onChange={(e) => updateField(key, Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-sm focus:border-[#EB485B] outline-none"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Body Type</label>
            <div className="flex flex-wrap gap-2">
              {BODY_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateField('bodyType', value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${measurements.bodyType === value
                    ? 'bg-[#EB485B] text-white'
                    : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#EB485B] to-pink-600 text-white text-sm font-bold transition-all active:scale-[0.98]"
          >
            {saved ? '✅ Saved!' : 'Save Measurements'}
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ── Style gallery data ── */
const styleItems = [
  {
    name: "Summer Vibes",
    img: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300&h=400&fit=crop",
  },
  {
    name: "Date Night",
    img: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300&h=400&fit=crop",
  },
  {
    name: "Office Chic",
    img: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=300&h=400&fit=crop",
  },
];

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();

  // Timeout fallback — if auth hangs for >3s, show page anyway
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const showContent = !loading || timedOut;

  const displayName = user
    ? (profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User')
    : 'Welcome!';

  const displaySubtitle = user
    ? (profile?.phone || user.email || 'Signed in')
    : 'Sign in to unlock your closet';

  const quickStats = [
    { label: "Closet", value: "142" },
    { label: "Collections", value: "12", highlight: true },
    { label: "Wishlist", value: "58" },
  ];

  const menuItems = [
    {
      icon: ShoppingBag,
      label: "Orders",
      subtitle: "Track your purchases",
      href: "/orders",
      color: "bg-blue-900/30 text-blue-400",
    },
    {
      icon: Sparkles,
      label: "Refer & Earn",
      subtitle: "Invite friends, get rewards",
      href: "#",
      color: "bg-purple-900/30 text-purple-400",
    },
    {
      icon: HelpCircle,
      label: "Help Center",
      subtitle: "FAQs and support",
      href: "/help",
      color: "bg-orange-900/30 text-orange-400",
    },
  ];

  return (
    <MobileShell className="bg-[#0A0A0A] text-gray-100" hideGlow>
      {/* Gradient overlay at top */}
      <div
        className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{
          background: "linear-gradient(180deg, rgba(235,72,91,0.15) 0%, rgba(10,10,10,0) 100%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 pt-12">
        <div className="flex flex-col">
          <div className="bg-neutral-800/50 px-3 py-1 rounded text-[10px] tracking-widest font-bold text-[#EB485B] w-fit mb-2 uppercase">
            PopClozet
          </div>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-gray-300 hover:bg-neutral-700 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto pb-28">

        {/* Loading spinner — shown briefly while auth resolves */}
        {!showContent && (
          <div className="px-6 pt-16 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-[#EB485B]/30 border-t-[#EB485B] rounded-full animate-spin" />
            <div className="text-sm text-gray-500 mt-4">Loading profile…</div>
          </div>
        )}

        {showContent && (
          <>
            {/* Profile hero section */}
            <section className="px-6 relative z-10 flex flex-col items-center text-center -mt-2">
              {/* Avatar */}
              <div className="relative mb-4">
                <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[#EB485B] to-purple-600">
                  <div className="w-full h-full rounded-full border-4 border-[#0A0A0A] bg-neutral-800 flex items-center justify-center">
                    <User className="w-14 h-14 text-white/70" />
                  </div>
                </div>
                <div className="absolute bottom-1 right-1 bg-[#EB485B] text-white text-xs px-2 py-0.5 rounded-full border-2 border-[#0A0A0A] font-bold">
                  PRO
                </div>
              </div>

              {/* Name — using <div> to avoid global h1 clamp() override */}
              <div className="text-2xl font-bold tracking-tight text-white mb-1">
                {displayName}
              </div>

              {/* Location / subtitle */}
              <div className="flex items-center text-gray-400 text-sm mb-6">
                <MapPin className="w-3.5 h-3.5 mr-1" />
                {displaySubtitle}
              </div>

              {/* Sign in button when not authenticated */}
              {!user && (
                <button
                  onClick={() => navigate('/auth/login')}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#EB485B] to-pink-600 hover:from-[#d63d50] hover:to-pink-500 text-white text-sm font-bold shadow-[0_10px_30px_rgba(235,72,91,0.4)] transition-all active:scale-95 mb-6"
                >
                  Sign In
                </button>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 w-full mb-8">
                {quickStats.map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className={cn(
                      "bg-[#161616] rounded-2xl p-4 flex flex-col items-center shadow-sm",
                      stat.highlight && "border border-[#EB485B]/20 relative overflow-hidden"
                    )}
                  >
                    {stat.highlight && (
                      <div className="absolute inset-0 bg-[#EB485B]/10" />
                    )}
                    <span className={cn(
                      "text-xl font-bold relative z-[1]",
                      stat.highlight ? "text-[#EB485B]" : "text-white"
                    )}>
                      {stat.value}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold relative z-[1]">
                      {stat.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* My Style Section */}
            <section className="px-6 mb-8">
              <div className="flex justify-between items-end mb-4">
                <div className="text-lg font-bold text-white">My Style</div>
                <a className="text-[#EB485B] text-sm font-semibold hover:opacity-80" href="#">See All</a>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                {styleItems.map((item) => (
                  <div key={item.name} className="flex-shrink-0 w-36 group relative">
                    <div className="h-48 rounded-2xl overflow-hidden relative bg-neutral-800">
                      <img
                        alt={item.name}
                        className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110"
                        src={item.img}
                      />
                      <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md rounded-full p-1.5 text-white">
                        <Heart className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="mt-2 text-sm font-medium truncate text-gray-200">{item.name}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Menu items */}
            <section className="px-6 space-y-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => item.href !== '#' && navigate(item.href)}
                    className="w-full bg-[#161616] p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", item.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-white">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.subtitle}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#EB485B] transition-colors" />
                  </button>
                );
              })}

              {/* Measurements Section */}
              {user && <MeasurementsSection userId={user.id} />}
            </section>

            {/* Sign Out & Version */}
            <div className="mt-8 text-center px-6">
              {user && (
                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/auth/login');
                  }}
                  className="text-sm font-medium text-red-400 hover:text-red-300"
                >
                  Sign Out
                </button>
              )}
              <div className="text-[10px] text-gray-500 mt-2">v2.4.0</div>
            </div>
          </>
        )}
      </main>

      <BottomNavBar />
    </MobileShell>
  );
};

export default ProfilePage;
