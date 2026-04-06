// src/pages/SettingsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, User, Bell, Mail, Shield, LogOut, ChevronRight,
    MapPin, CreditCard, Clock, Ruler, Package, RefreshCw,
    HelpCircle, FileText, Trash2, Phone, Zap, AlertTriangle,
    Check, X, ChevronLeft, Loader2, Smartphone
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { MobileShell } from '@/components/layout/MobileShell';
/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const storeBool = (key: string, value: boolean) => {
    try { localStorage.setItem(key, String(value)); } catch {}
};

const loadBool = (key: string, def: boolean): boolean => {
    try {
        const v = localStorage.getItem(key);
        return v !== null ? v === 'true' : def;
    } catch { return def; }
};

const loadStr = (key: string, def: string): string => {
    try { return localStorage.getItem(key) ?? def; } catch { return def; }
};

/* ─── Sub-components ──────────────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f2546d]/70">{children}</div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-hidden rounded-2xl bg-[#141414] border border-white/5">{children}</div>
);

const Divider = () => <div className="h-px w-full bg-white/5" />;

interface RowProps {
    icon: React.ElementType;
    iconBg?: string;
    label: string;
    sub?: string;
    right?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
    last?: boolean;
}

const Row: React.FC<RowProps> = ({ icon: Icon, iconBg = 'bg-[#f2546d]/20', label, sub, right, onClick, danger, last }) => (
    <>
        <button
            onClick={onClick}
            disabled={!onClick}
            className={`flex w-full items-center gap-3 px-3 md:px-4 py-3 md:py-4 text-left transition-colors
                ${onClick ? (danger ? 'hover:bg-red-500/10 active:scale-[0.98]' : 'hover:bg-white/5 active:scale-[0.98]') : 'cursor-default'}
            `}
        >
            <div className={`flex w-8 h-8 md:w-10 md:h-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${danger ? 'text-red-400' : 'text-[#f2546d]'}`} />
            </div>
            <div className="flex flex-1 flex-col items-start min-w-0">
                <span className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-white'}`}>{label}</span>
                {sub && <span className="text-xs text-zinc-500 truncate">{sub}</span>}
            </div>
            {right !== undefined ? right : onClick ? <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" /> : null}
        </button>
        {!last && <Divider />}
    </>
);

interface ToggleRowProps extends Omit<RowProps, 'right' | 'onClick'> {
    value: boolean;
    onChange: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ value, onChange, ...rest }) => (
    <Row
        {...rest}
        onClick={() => onChange(!value)}
        right={
            <div className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 ${value ? 'bg-[#f2546d]' : 'bg-zinc-700'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${value ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
        }
    />
);

interface SelectRowProps extends Omit<RowProps, 'right' | 'onClick'> {
    value: string;
    options: string[];
    onChange: (v: string) => void;
}

const SelectRow: React.FC<SelectRowProps> = ({ value, options, onChange, icon: Icon, iconBg, label, sub, last }) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center gap-3 px-3 md:px-4 py-3 md:py-4 text-left hover:bg-white/5 active:scale-[0.98] transition-colors"
            >
                <div className={`flex w-8 h-8 md:w-10 md:h-10 shrink-0 items-center justify-center rounded-xl ${iconBg ?? 'bg-[#f2546d]/20'}`}>
                    <Icon className={`w-4 h-4 md:w-5 md:h-5 text-[#f2546d]`} />
                </div>
                <div className="flex flex-1 flex-col items-start min-w-0">
                    <span className="text-sm font-medium text-white">{label}</span>
                    <span className="text-xs text-[#f2546d] font-semibold">{value}</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-zinc-700 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap gap-2 px-4 pb-4">
                            {options.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => { onChange(opt); setOpen(false); }}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${value === opt
                                        ? 'bg-[#f2546d] text-white'
                                        : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                                        }`}
                                >
                                    {opt === value && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {!last && <Divider />}
        </>
    );
};

/* ─── Main Page ───────────────────────────────────────────────────────────── */

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile, signOut } = useAuth();

    const displayName = (() => {
        const raw = profile?.full_name || user?.user_metadata?.full_name || profile?.email?.split('@')[0] || user?.email?.split('@')[0] || 'User';
        const first = raw.trim().split(/\s+/)[0];
        return first.charAt(0).toUpperCase() + first.slice(1);
    })();

    // ── Push notifications (real Web Push API) ─────────────────────────────
    const push = usePushNotifications();
    const handlePushToggle = async () => {
        if (push.isLoading) return;
        if (push.isSubscribed) {
            await push.unsubscribe();
        } else {
            const success = await push.subscribe();
            if (!success) {
                if (push.permission === 'denied') {
                    alert('Notifications are blocked in your browser settings. Please enable them in your browser/device settings and try again.');
                } else {
                    // We need to wait a tick for push.error state to update, or just use the hook
                    setTimeout(() => alert("Failed to turn on push: " + (push.error || "Unknown error")), 100);
                }
            }
        }
    };

    // ── Notification toggles ──────────────────────────────────────────────
    const [pushOrders, setPushOrders] = useState(() => loadBool('s_push_orders', true));
    const [pushDelivery, setPushDelivery] = useState(() => loadBool('s_push_delivery', true));
    const [pushReturn, setPushReturn] = useState(() => loadBool('s_push_return', true));
    const [pushPromo, setPushPromo] = useState(() => loadBool('s_push_promo', false));
    const [emailUpdates, setEmailUpdates] = useState(() => loadBool('s_email_updates', false));

    const toggle = (setter: (v: boolean) => void, key: string) => (v: boolean) => {
        setter(v);
        storeBool(key, v);
    };

    const saveStr = (setter: (v: string) => void, key: string) => (v: string) => {
        setter(v);
        localStorage.setItem(key, v);
    };

    // ── Delete account confirmation ───────────────────────────────────────
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    /* Fake icon render for SelectRow (can't pass JSX as prop directly) */
    const makeIconProp = (Icon: React.ElementType) => ({ render: () => <Icon className="w-5 h-5 text-[#f2546d]" /> });

    return (
        <MobileShell className="bg-[#0A0A0A] text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 transition-all active:scale-95"
                >
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <h1 className="text-lg font-bold text-white">Settings</h1>
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-5 pb-28 space-y-6">

                {/* ── Profile Banner ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate('/profile')}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#f2546d]/20 to-purple-500/10 border border-[#f2546d]/20 p-4 cursor-pointer active:scale-[0.98] transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-[#f2546d] via-purple-500 to-blue-500 p-[2px] shrink-0">
                            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                                <User className="w-5 h-5 md:w-7 md:h-7 text-white/80" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-base truncate">{displayName}</p>
                            <p className="text-zinc-500 text-xs truncate">{profile?.phone || profile?.email || user?.email || ''}</p>
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                            <span className="text-xs text-white font-semibold">Edit</span>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                    </div>
                </motion.div>

                {/* ── 1. Account ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <SectionLabel>Account</SectionLabel>
                    <Card>
                        <Row icon={User} label="Edit Profile" sub="Name, phone, email" onClick={() => navigate('/profile')} />
                        <Row icon={MapPin} label="Delivery Addresses" sub="Manage saved addresses" onClick={() => navigate('/map')} />
                        <Row icon={Package} label="My Orders" sub="Active & past rentals" onClick={() => navigate('/orders')} last />
                    </Card>
                </motion.div>



                {/* ── 3. Notifications ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <SectionLabel>Notifications</SectionLabel>
                    <Card>
                        {/* Real Web Push toggle */}
                        <Row
                            icon={Smartphone}
                            label="Push Notifications"
                            sub={!push.isSupported
                                ? 'Not supported'
                                : push.permission === 'denied'
                                  ? 'Blocked — enable in browser settings'
                                  : push.isSubscribed
                                    ? 'Enabled on this device'
                                    : 'Enable alerts on this device'}
                            right={push.isLoading
                                ? <Loader2 className="w-5 h-5 text-[#f2546d] animate-spin" />
                                : <div className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 ${push.isSubscribed ? 'bg-[#f2546d]' : 'bg-zinc-700'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${push.isSubscribed ? 'translate-x-6' : 'translate-x-1'}`} /></div>}
                            onClick={handlePushToggle}
                        />
                        <ToggleRow icon={Package} label="Order Status Updates" sub="Confirmed, preparing, out for delivery" value={pushOrders} onChange={toggle(setPushOrders, 's_push_orders')} />
                        <ToggleRow icon={Zap} label="Delivery Alerts" sub="Rider nearby, delivered" value={pushDelivery} onChange={toggle(setPushDelivery, 's_push_delivery')} />
                        <ToggleRow icon={RefreshCw} label="Return Reminders" sub="24h & same-day pickup alerts" value={pushReturn} onChange={toggle(setPushReturn, 's_push_return')} />
                        <ToggleRow icon={Bell} label="Offers & New Arrivals" sub="Deals, discounts, new styles" value={pushPromo} onChange={toggle(setPushPromo, 's_push_promo')} />
                        <ToggleRow icon={Mail} label="Email Updates" sub="Receipts & rental summaries" value={emailUpdates} onChange={toggle(setEmailUpdates, 's_email_updates')} last />
                    </Card>
                </motion.div>

                {/* ── 4. Support & Legal ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <SectionLabel>Support & Legal</SectionLabel>
                    <Card>
                        <Row icon={HelpCircle} label="Help Center" sub="FAQs & contact support" onClick={() => navigate('/help')} />
                        <Row icon={Zap} label="About Popclozet" sub="Our hygiene process & brand" onClick={() => navigate('/about-us')} />
                        <Row icon={Phone} label="Call Support" sub="+91 98765 43210" onClick={() => window.open('tel:+919876543210')} />
                        <Row icon={Shield} label="Privacy Policy" onClick={() => navigate('/privacy')} />
                        <Row icon={FileText} label="Terms & Conditions" onClick={() => navigate('/terms')} last />
                    </Card>
                </motion.div>

                {/* ── 5. Danger Zone ── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <SectionLabel>Account Actions</SectionLabel>
                    <Card>
                        <Row
                            icon={LogOut}
                            iconBg="bg-red-500/15"
                            label="Log Out"
                            sub="You'll need to sign in again"
                            danger
                            onClick={() => navigate('/auth/signout')}
                        />
                        <Row
                            icon={Trash2}
                            iconBg="bg-red-500/15"
                            label="Delete Account"
                            sub="Permanently remove your data"
                            danger
                            last
                            onClick={() => setShowDeleteConfirm(true)}
                        />
                    </Card>
                </motion.div>

                <p className="text-center text-xs text-zinc-700 pb-2">Popclozet v1.0.0 · Mumbai 🇮🇳</p>
            </main>

            {/* Delete Confirmation Sheet */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteConfirm(false)}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-50 bg-[#111] rounded-t-3xl border-t border-white/10 px-5 pt-5 pb-10"
                        >
                            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-8 h-8 text-red-400" />
                                </div>
                                <h2 className="text-white font-bold text-lg mb-2">Delete Account?</h2>
                                <p className="text-zinc-500 text-sm leading-relaxed max-w-[280px]">
                                    This will permanently delete your account, order history, and all saved data. This action cannot be undone.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/8 border border-white/10 text-white font-bold text-sm"
                                >
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                                <button
                                    onClick={async () => { await signOut(); navigate('/auth/login'); }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </MobileShell>
    );
};

export default SettingsPage;
