import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { cn } from '@/lib/utils';
import logo from '@/logo/logo.png';

// Icons
const SettingsIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const ShoppingBagIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const LogOutIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
    </svg>
);

export const ProfilePage: React.FC = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const quickStats = [
        { label: "Orders", value: "0", icon: ShoppingBagIcon },
        { label: "Wishlist", value: "0", icon: HeartIcon },
        { label: "In Closet", value: "0", icon: UserIcon },
    ];

    const menuSections = [
        {
            title: "Account",
            items: [
                { icon: HeartIcon, label: "My Wishlist", href: "/favorites" },
                { icon: ShoppingBagIcon, label: "My Orders", href: "/orders" },
                { icon: CreditCardIcon, label: "Payment Methods", href: "/payments" },
            ]
        },
        {
            title: "Preferences",
            items: [
                { icon: BellIcon, label: "Notifications", href: "/notifications" },
                { icon: SettingsIcon, label: "Settings", href: "/settings" },
            ]
        },
        {
            title: "Support",
            items: [
                { icon: HelpCircleIcon, label: "Help Center", href: "/help" },
                { icon: ShieldIcon, label: "Privacy Policy", href: "/privacy" },
            ]
        },
    ];

    return (
        <MobileShell className="bg-black text-white">
            {/* Header - Premium Glassmorphism */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <img src={logo} alt="POPCLOZET" className="h-6 w-auto object-contain" />
                <button className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                    <SettingsIcon className="w-5 h-5 text-zinc-400" />
                </button>
            </div>

            <main className="flex-1 overflow-y-auto pb-24">
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
                                        <span className="text-2xl font-bold text-white/80">
                                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                </div>
                                {/* Online indicator */}
                                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-zinc-900 shadow-[0_0_12px_rgba(34,197,94,0.6)] flex items-center justify-center">
                                    <SparklesIcon className="w-2.5 h-2.5 text-white" />
                                </div>
                            </div>

                            <div className="flex-1">
                                {user ? (
                                    <>
                                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1">
                                            {user.email?.split('@')[0] || 'User'}
                                        </h1>
                                        <p className="text-sm text-zinc-500 mb-1">{user.email}</p>
                                    </>
                                ) : (
                                    <>
                                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1">Welcome!</h1>
                                        <p className="text-sm text-zinc-500 mb-3">Sign in to unlock your closet</p>
                                        <Link to="/login">
                                            <button className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 hover:from-[#ff3355] hover:to-pink-500 text-white text-sm font-bold shadow-[0_10px_30px_rgba(255,77,109,0.4)] transition-all active:scale-95">
                                                Sign In
                                            </button>
                                        </Link>
                                    </>
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
                                        <Link
                                            key={item.label}
                                            to={item.href}
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
                                            <ChevronRightIcon className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                                        </Link>
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
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold transition-all active:scale-[0.98]"
                        >
                            <LogOutIcon className="w-5 h-5" />
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
            </main>

            <BottomNavigation />
        </MobileShell>
    );
};

export default ProfilePage;
