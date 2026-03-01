import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    User,
    Bell,
    Mail,
    Globe,
    HelpCircle,
    Shield,
    LogOut,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNavBar } from '@/components/layout/BottomNavBar';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    // Notification toggle states — persisted to localStorage
    const [pushEnabled, setPushEnabled] = useState(() => {
        const saved = localStorage.getItem('settings_push_notifications');
        return saved !== null ? saved === 'true' : true; // default ON
    });
    const [emailEnabled, setEmailEnabled] = useState(() => {
        const saved = localStorage.getItem('settings_email_notifications');
        return saved !== null ? saved === 'true' : false; // default OFF
    });

    // Persist toggles
    useEffect(() => {
        localStorage.setItem('settings_push_notifications', String(pushEnabled));
    }, [pushEnabled]);
    useEffect(() => {
        localStorage.setItem('settings_email_notifications', String(emailEnabled));
    }, [emailEnabled]);

    // Language state
    const [currentLanguage] = useState('English (US)');

    return (
        <MobileShell className="bg-[#0A0A0A] text-gray-100" hideGlow>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EB485B]/20 bg-[#0A0A0A]/95 backdrop-blur-sm px-4 py-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex w-10 h-10 items-center justify-center rounded-full text-white hover:bg-[#EB485B]/20 transition-colors active:scale-95"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-lg font-bold leading-tight tracking-tight text-white">Settings</div>
                <div className="w-10 h-10" />
            </div>

            <main className="flex-1 px-4 py-6 pb-28 overflow-y-auto">

                {/* Section: Account */}
                <div className="mb-6">
                    <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#EB485B]/80">Account</div>
                    <div className="overflow-hidden rounded-xl bg-[#161616] ring-1 ring-[#EB485B]/10">
                        {/* Edit Profile */}
                        <button
                            onClick={() => navigate('/profile')}
                            className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-[#EB485B]/10 active:scale-[0.98]"
                        >
                            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-[#EB485B]/20 text-[#EB485B]">
                                <User className="w-5 h-5" />
                            </div>
                            <div className="flex flex-1 flex-col items-start text-left">
                                <span className="text-sm font-medium text-white">Edit Profile</span>
                                <span className="text-xs text-gray-400">Manage your personal details</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#EB485B]/40" />
                        </button>
                    </div>
                </div>

                {/* Section: Notifications */}
                <div className="mb-6">
                    <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#EB485B]/80">Notifications</div>
                    <div className="overflow-hidden rounded-xl bg-[#161616] ring-1 ring-[#EB485B]/10">
                        {/* Push Notifications Toggle */}
                        <button
                            onClick={() => setPushEnabled(!pushEnabled)}
                            className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-[#EB485B]/10 active:scale-[0.98]"
                        >
                            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-[#EB485B]/20 text-[#EB485B]">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div className="flex flex-1 flex-col items-start text-left">
                                <span className="text-sm font-medium text-white">Push Notifications</span>
                                <span className="text-xs text-gray-400">{pushEnabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            {/* Toggle switch */}
                            <div
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${pushEnabled ? 'bg-[#EB485B]' : 'bg-neutral-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${pushEnabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </div>
                        </button>

                        <div className="h-px w-full bg-white/5" />

                        {/* Email Notifications Toggle */}
                        <button
                            onClick={() => setEmailEnabled(!emailEnabled)}
                            className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-[#EB485B]/10 active:scale-[0.98]"
                        >
                            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-[#EB485B]/20 text-[#EB485B]">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div className="flex flex-1 flex-col items-start text-left">
                                <span className="text-sm font-medium text-white">Email Updates</span>
                                <span className="text-xs text-gray-400">{emailEnabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            {/* Toggle switch */}
                            <div
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${emailEnabled ? 'bg-[#EB485B]' : 'bg-neutral-700'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${emailEnabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Section: Preferences */}
                <div className="mb-6">
                    <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#EB485B]/80">Preferences</div>
                    <div className="overflow-hidden rounded-xl bg-[#161616] ring-1 ring-[#EB485B]/10">
                        {/* Language */}
                        <button
                            onClick={() => {/* future: open language selector */ }}
                            className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-[#EB485B]/10 active:scale-[0.98]"
                        >
                            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-[#EB485B]/20 text-[#EB485B]">
                                <Globe className="w-5 h-5" />
                            </div>
                            <div className="flex flex-1 flex-col items-start text-left">
                                <span className="text-sm font-medium text-white">Language</span>
                                <span className="text-xs text-gray-400">{currentLanguage}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#EB485B]/40" />
                        </button>
                    </div>
                </div>

                {/* Section: Support */}
                <div className="mb-8">
                    <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#EB485B]/80">Support</div>
                    <div className="overflow-hidden rounded-xl bg-[#161616] ring-1 ring-[#EB485B]/10">
                        {/* Help Center */}
                        <button
                            onClick={() => navigate('/help')}
                            className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-[#EB485B]/10 active:scale-[0.98]"
                        >
                            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-[#EB485B]/20 text-[#EB485B]">
                                <HelpCircle className="w-5 h-5" />
                            </div>
                            <div className="flex flex-1 flex-col items-start text-left">
                                <span className="text-sm font-medium text-white">Help Center</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#EB485B]/40" />
                        </button>

                        <div className="h-px w-full bg-white/5" />

                        {/* Privacy Policy */}
                        <button
                            onClick={() => navigate('/privacy')}
                            className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-[#EB485B]/10 active:scale-[0.98]"
                        >
                            <div className="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-[#EB485B]/20 text-[#EB485B]">
                                <Shield className="w-5 h-5" />
                            </div>
                            <div className="flex flex-1 flex-col items-start text-left">
                                <span className="text-sm font-medium text-white">Privacy Policy</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#EB485B]/40" />
                        </button>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={async () => {
                        await signOut();
                        navigate('/auth/login');
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EB485B]/10 py-4 text-[#EB485B] font-bold hover:bg-[#EB485B]/20 active:scale-[0.98] transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Log Out</span>
                </button>

                <div className="mt-4 text-center text-xs text-gray-600">
                    Version 4.2.0 (Build 2024)
                </div>
            </main>

            <BottomNavBar />
        </MobileShell>
    );
};

export default SettingsPage;
