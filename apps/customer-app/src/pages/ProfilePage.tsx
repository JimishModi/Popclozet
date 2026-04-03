// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Settings, Heart, ShoppingBag, LogOut, ChevronRight,
  HelpCircle, Shield, Sparkles, X,
  Edit3, Check, Loader2, Phone, Mail, Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClosetIcon } from "@/components/icons/ClosetIcon";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import logo from "@/logo/popclozet-logo.svg";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/context/WishlistContext";
import { useOrders } from "@/hooks/useOrders";
import { supabase } from "@popclozet/api-client";
import { toast } from "sonner";


const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, profile, loading, updateProfile } = useAuth();
  const { wishlistItems } = useWishlist();


  /** Returns true only if the email looks like a real user-provided address */
  const isRealEmail = (email?: string | null): email is string => {
    if (!email) return false;
    if (email.includes('@phone.') || email.includes('.internal') || email.includes('@sms.')) return false;
    return email.includes('@') && email.includes('.');
  };

  // ── Sends a verification link to the user's real email ────────────────────
  // Step 1: calls the link-email edge function to update auth.users with the real
  //         email (bypassing the invalid placeholder email restriction)
  // Step 2: calls signInWithOtp with shouldCreateUser: false so the magic link
  //         goes to the SAME user instead of creating a new account
  async function sendVerificationEmail(email: string): Promise<void> {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');

    // Step 1: Update auth.users email via edge function
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to link email');

    // Step 2: Now auth.users has the real email — send magic link to the same user
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // CRITICAL — don't create a new user
        emailRedirectTo: `${window.location.origin}/auth/verify-email-callback`,
      },
    });

    if (otpError) throw new Error(otpError.message);
  }


  const { orders, activeOrders, loading: ordersLoading } = useOrders();

  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySent, setVerifySent] = useState(false);

  // KYC verification status
  const [kycVerified, setKycVerified] = useState<boolean | null>(null);
  const [isKycLoading, setIsKycLoading] = useState(false);
  
  // KYC Banner dismissal states
  const [showKycBanner, setShowKycBanner] = useState(() => localStorage.getItem('pop_kyc_dismissed') !== 'true');
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(() => localStorage.getItem('pop_verified_dismissed') !== 'true');

  const dismissKyc = () => {
    setShowKycBanner(false);
    localStorage.setItem('pop_kyc_dismissed', 'true');
  };

  const dismissVerified = () => {
    setShowVerifiedBanner(false);
    localStorage.setItem('pop_verified_dismissed', 'true');
  };

  useEffect(() => {
    if (user?.id) {
      supabase.from("customer_profiles").select("kyc_verified").eq("user_id", user.id).single().then(({ data }) => {
        setKycVerified(data?.kyc_verified ?? false);
      });
    }
  }, [user?.id]);

  // Handle KYC callback from Didit redirect
  useEffect(() => {
    const kycCallback = searchParams.get("kyc_callback");
    const urlUserId = searchParams.get("user_id");
    const effectiveUserId = user?.id || urlUserId;

    if (kycCallback === "success" && effectiveUserId) {
      // Set verified immediately
      setKycVerified(true);

      // Persist to DB
      supabase.from("customer_profiles").update({ kyc_verified: true }).eq("user_id", effectiveUserId)
        .then(({ error }) => {
          if (error) {
            console.error("[KYC] Failed to persist verification:", error);
            toast.error("Verification failed to save. Please try again.");
            setKycVerified(false);
            return;
          }
          toast.success("Identity verified successfully!");
        });

      // Clean up URL
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("kyc_callback");
      newParams.delete("user_id");
      const newUrl = window.location.pathname + (newParams.toString() ? `?${newParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, user?.id]);

  const inClosetCount = orders.filter(o =>
    ["delivered", "in_use"].includes(o.status)
  ).length;

  const quickStats = [
    { label: "Orders", value: ordersLoading ? "…" : String(orders.length), icon: ShoppingBag, href: "/orders" },
    { label: "Wishlist", value: String(wishlistItems.length), icon: Heart, href: "/wishlist" },
    { label: "In Closet", value: ordersLoading ? "…" : String(inClosetCount), icon: ClosetIcon, href: "/closet" },
  ];

  const menuSections = [
    {
      title: "Account",
      items: [
        { icon: Heart, label: "My Wishlist", href: "/wishlist", badge: wishlistItems.length > 0 ? String(wishlistItems.length) : undefined },
        { icon: ShoppingBag, label: "My Orders", href: "/orders" },
        { icon: Settings, label: "Settings", href: "/settings" },
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Center", href: "/help" },
        { icon: Sparkles, label: "About Popclozet", href: "/about-us" },
        { icon: Shield, label: "Privacy Policy", href: "/privacy" },
      ]
    },
  ];

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCoords, setEditCoords] = useState<{lat: number, lng: number} | null>(null);
  const [primaryAddress, setPrimaryAddress] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchPrimaryAddress = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (data) {
        setPrimaryAddress(data);
        setEditAddress(data.full_address);
        setEditCoords({ lat: data.latitude, lng: data.longitude });
      }
    } catch (e) {
      console.warn("Error fetching address:", e);
    }
  };

  useEffect(() => {
    if (showEditSheet) {
      // 1. Check if we are returning from Map with a new address
      const returnedAddr = location.state?.selectedAddress;
      if (returnedAddr) {
        setEditAddress(returnedAddr.formattedAddress);
        setEditCoords({ lat: returnedAddr.lat || 0, lng: returnedAddr.lng || 0 });
        
        // Restore Name & Phone from session storage if available
        const savedData = sessionStorage.getItem('profile_edit_draft');
        if (savedData) {
          const { name, phone, email } = JSON.parse(savedData);
          setEditName(name);
          setEditPhone(phone);
          setEditEmail(email);
        }
        return;
      }

      // 2. Default initial load
      setEditName(profile?.full_name || user?.user_metadata?.full_name || "");
      setEditPhone(profile?.phone || user?.phone || "");
      setEditEmail(user?.email || "");
      fetchPrimaryAddress();
      setSaveError("");
    }
  }, [showEditSheet, profile, user, location.state]);

  // Open sheet automatically if we return with state
  useEffect(() => {
    if (location.state?.selectedAddress) {
      setShowEditSheet(true);
    }
  }, [location.state]);

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editPhone.trim() || !editEmail.trim() || !editAddress.trim()) {
      setSaveError("Please enter complete details (Name, Phone, Email & Address)");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // 1. Update Profile (Name & Phone)
      await updateProfile({ full_name: editName.trim(), phone: editPhone.trim() });

      // 2. Update Email if changed
      if (editEmail !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: editEmail });
        if (emailError) throw emailError;
        toast.success("Confirmation email sent to " + editEmail);
      }

      // 3. Upsert Address
      if (editAddress.trim()) {
        const addressPayload = {
          user_id: user?.id,
          full_address: editAddress.trim(),
          label: 'Home',
          is_default: true,
          latitude: editCoords?.lat || 19.1334,
          longitude: editCoords?.lng || 72.9133,
          geohash: 'te7u'
        };

        if (primaryAddress) {
          await supabase
            .from('addresses')
            .update(addressPayload)
            .eq('id', primaryAddress.id);
        } else {
          await supabase
            .from('addresses')
            .insert([addressPayload]);
        }
        // Success - clear draft
        sessionStorage.removeItem('profile_edit_draft');
      }

      toast.success("Profile updated successfully!");
      setShowEditSheet(false);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("profiles_phone_not_empty")) {
        setSaveError("Please enter a valid phone number.");
      } else {
        setSaveError("Please enter complete credentials or check your connection.");
      }
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    const emailToVerify = profile?.email;
    if (!emailToVerify) return;
    setVerifyLoading(true);
    setVerifyError('');
    setVerifySent(false);
    try {
      await sendVerificationEmail(emailToVerify);
      setVerifySent(true);
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to send verification email');
    } finally {
      setVerifyLoading(false);
    }
  };

  const rawName = profile?.full_name || user?.user_metadata?.full_name || profile?.email?.split("@")[0] || user?.email?.split("@")[0] || "User";
  const displayName = (() => { const first = rawName.trim().split(/\s+/)[0]; return first.charAt(0).toUpperCase() + first.slice(1); })();
  const displaySub = profile?.phone || (isRealEmail(profile?.email) ? profile?.email : null) || "Signed in";

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex items-center justify-between lg:hidden">
        <img src={logo} alt="Popclozet" className="h-10 w-auto object-contain" />
        <button onClick={() => navigate("/settings")} className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
          <Settings className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <main className="flex-1 overflow-y-auto pb-24 lg:pb-12 lg:pt-8 lg:px-8 w-full max-w-7xl mx-auto flex flex-col">
        {loading && (
          <div className="px-4 pt-8 space-y-4 animate-pulse">
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-white/10 rounded-lg w-3/4" />
                  <div className="h-3 bg-white/10 rounded-lg w-1/2" />
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div className="lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start flex-1 w-full">
            {/* Left Column (Hero, Stats, Sub) */}
            <div className="lg:col-span-5 lg:sticky lg:top-8 flex flex-col gap-6">

            {/* Hero Profile Section */}
              <div className="relative px-4 lg:px-0 pt-4 md:pt-8 lg:pt-0 pb-4 md:pb-6 lg:pb-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#f2546d]/15 to-transparent pointer-events-none" />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl rounded-3xl p-4 md:p-6 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] group cursor-default transition-all duration-300 hover:border-[#f2546d]/30"
              >
                <div className="flex items-center gap-4">
                  <div className="relative group/avatar cursor-pointer">
                    <motion.div 
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#f2546d] to-[#ff4d6d] p-[3px] shadow-[0_0_20px_rgba(242,84,109,0.3)] transition-shadow group-hover/avatar:shadow-[0_0_30px_rgba(242,84,109,0.5)]"
                    >
                      <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                        <User className="w-7 h-7 md:w-10 md:h-10 text-white/80 group-hover/avatar:text-white transition-colors" />
                      </div>
                    </motion.div>
                    {user && kycVerified && (
                      <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-zinc-900 shadow-[0_0_12px_rgba(34,197,94,0.6)] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1 truncate">
                      {user ? `Hi, ${displayName}` : "Welcome!"}
                    </h1>
                    <p className="text-sm text-zinc-500 mb-3 truncate">{user ? displaySub : "Sign in to unlock your closet"}</p>
                    {user ? (
                      <button
                        onClick={() => setShowEditSheet(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/8 border border-white/10 text-zinc-300 text-xs font-semibold hover:bg-white/15 transition-all active:scale-95"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit Profile
                      </button>
                    ) : (
                      <button onClick={() => navigate("/auth/login")} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f2546d] to-pink-600 text-white text-sm font-bold shadow-[0_10px_30px_rgba(242,84,109,0.4)] transition-all active:scale-95">
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Email Verification Banner — only when real unverified email exists */}
              {user && profile && isRealEmail(profile.email) && !profile.email_verified && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">Verify your email</p>
                      <p className="text-xs text-zinc-400 truncate">{profile.email}</p>
                    </div>
                  </div>

                  {verifySent ? (
                    <p className="text-xs text-green-400 font-semibold text-center py-1">
                      ✓ Verification link sent — check your inbox
                    </p>
                  ) : (
                    <>
                      {verifyError && <p className="text-xs text-red-400 mb-2">{verifyError}</p>}
                      <button
                        onClick={handleVerifyEmail}
                        disabled={verifyLoading}
                        className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {verifyLoading ? 'Sending...' : 'Send Verification Email'}
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {/* KYC Identity Verification Banner */}
              {user && kycVerified !== null && (
                kycVerified ? (
                  showVerifiedBanner && (
                    <motion.div
                      initial={{ opacity: 0.4, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mt-4 bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 group relative"
                    >
                      <button 
                        onClick={dismissVerified}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                          <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">Identity Verified</p>
                          <p className="text-[11px] text-zinc-500">Your KYC verification is complete</p>
                        </div>
                        <Shield className="w-5 h-5 text-zinc-800" />
                      </div>
                    </motion.div>
                  )
                ) : (
                  showKycBanner && (
                    <motion.div
                      initial={{ opacity: 0.4, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mt-4 bg-[#1C1C1E] border border-amber-500/20 rounded-2xl p-4 relative group"
                    >
                      <button 
                        onClick={dismissKyc}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Shield className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">Verify your identity</p>
                          <p className="text-[11px] text-zinc-500">Complete KYC to place orders</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={async () => {
                            setIsKycLoading(true);
                            try {
                              const { data, error } = await supabase.functions.invoke('create-kyc-session', {
                                body: { callbackParams: { user_id: user.id, callback_path: "/profile" } }
                              });
                              if (error) throw error;
                              if (data?.url) {
                                window.location.href = data.url;
                              } else {
                                window.location.href = "https://verify.didit.me/u/_uYNP1MiRKmW7yMjXCbHQQ";
                              }
                            } catch (err: any) {
                              console.error('KYC Error:', err);
                              window.location.href = "https://verify.didit.me/u/_uYNP1MiRKmW7yMjXCbHQQ";
                            } finally {
                              setIsKycLoading(false);
                            }
                          }}
                          disabled={isKycLoading}
                          className="w-full py-3 rounded-xl bg-white text-black text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isKycLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          {isKycLoading ? "LOADING..." : "VERIFY NOW"}
                        </button>
                        <button
                          onClick={async () => {
                            const { data } = await supabase
                              .from("customer_profiles")
                              .select("kyc_verified")
                              .eq("user_id", user.id)
                              .single();
                            if (data?.kyc_verified) {
                              setKycVerified(true);
                              toast.success("Verification confirmed!");
                            } else {
                              toast.error("Verification not found yet. Please complete verification on Didit first.");
                            }
                          }}
                          className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-500 text-xs font-medium hover:bg-white/10 transition-all"
                        >
                          Already verified? Tap to refresh
                        </button>
                      </div>
                    </motion.div>
                  )
                )
              )}
            </div>

            {/* Quick Stats */}
            <div className="px-4 lg:px-0">
              <div className="grid grid-cols-3 gap-3">
                {quickStats.map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -5, scale: 1.02 }}
                      transition={{ 
                        delay: 0.1 + idx * 0.05,
                        type: "spring",
                        stiffness: 400,
                        damping: 15
                      }}
                      onClick={() => navigate(stat.href)}
                      className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/5 text-center group hover:border-[#f2546d]/50 transition-all cursor-pointer shadow-lg hover:shadow-[#f2546d]/10"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-[#f2546d]/20 flex items-center justify-center mx-auto mb-2 transition-colors">
                        <Icon className="w-5 h-5 text-[#f2546d]" />
                      </div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">{stat.label}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            </div> {/* End Left Column */}

            {/* Right Column (Menus, Log Out) */}
            <div className="lg:col-span-7 flex flex-col gap-6 mt-6 lg:mt-0 px-4 lg:px-0">
            {/* Menu Sections */}
            <div className="space-y-6">
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
                            "w-full flex items-center gap-3 px-3 md:px-4 py-3 md:py-4 group text-left hover:bg-white/5 transition-all",
                            index < section.items.length - 1 && "border-b border-white/5"
                          )}
                        >
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[#f2546d]/20 transition-colors">
                            <Icon className="w-4 h-4 md:w-5 md:h-5 text-zinc-500 group-hover:text-[#f2546d] transition-colors" />
                          </div>
                          <span className="flex-1 text-white font-medium">{item.label}</span>
                          {item.badge && (
                            <span className="px-2.5 py-1 rounded-full bg-[#f2546d]/20 text-[#f2546d] text-xs font-bold">{item.badge}</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {user && (
              <div className="mt-8">
                <button
                  onClick={() => navigate("/auth/signout")}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            )}

            <div className="mt-12 text-center pb-4 lg:pb-0">
              <p className="text-xs text-zinc-700 font-medium">Popclozet v1.0.0</p>
              <p className="text-xs text-zinc-800 mt-1">Made with ❤️ in Mumbai</p>
            </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Profile Sheet */}
      <AnimatePresence>
        {showEditSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditSheet(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            />
            {/* Sheet */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditSheet(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-[100] bg-[#111111] rounded-t-3xl border-t border-white/10 px-5 pt-5 pb-24"
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Edit Profile</h2>
                <button onClick={() => setShowEditSheet(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Full Name</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-[#f2546d]/50 transition-colors">
                    <User className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name" className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Phone Number</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-[#f2546d]/50 transition-colors">
                    <Phone className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <span className="text-zinc-500 text-sm font-medium">+91</span>
                    <input
                      type="tel"
                      value={editPhone.replace(/^\+91/, '')}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setEditPhone('+91' + val);
                      }}
                      placeholder="XXXXX XXXXX"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-700 mt-1 pl-1">Phone number cannot be changed</p>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Email</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus-within:border-[#f2546d]/50 transition-colors">
                    <Mail className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 pl-1">A confirmation will be sent to your new email</p>
                </div>

                {/* Address */}
                <div>
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5 block">Primary Address</label>
                  <button
                    onClick={() => {
                      // Save current draft state to session storage
                      sessionStorage.setItem('profile_edit_draft', JSON.stringify({
                        name: editName,
                        phone: editPhone,
                        email: editEmail
                      }));
                      navigate('/map-location?returnTo=/profile');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#f2546d]/30 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Package className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                      <span className={cn(
                        "text-sm truncate",
                        editAddress ? "text-white" : "text-zinc-600"
                      )}>
                        {editAddress || "Click to select address from map"}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400" />
                  </button>
                </div>

                {saveError && <p className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{saveError}</p>}

                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-600 text-white font-bold text-sm shadow-[0_10px_30px_rgba(242,84,109,0.3)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="h-8" />
    </div>
  );
};

export default ProfilePage;
