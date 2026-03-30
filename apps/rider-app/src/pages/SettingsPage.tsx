/**
 * Settings Page
 * 
 * Rider app settings and preferences
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { ArrowLeft, Bell, Volume2, Vibrate, Globe, Moon, Zap, MapPin, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { getRiderSettings, updateRiderSettings, type RiderSettings } from '../services/riderProfileService';

interface ToggleSetting {
    key: keyof RiderSettings;
    icon: React.ReactNode;
    label: string;
    description: string;
}

const toggleSettings: ToggleSetting[] = [
    {
        key: 'notificationsEnabled',
        icon: <Bell size={20} />,
        label: 'Push Notifications',
        description: 'Receive order and update alerts',
    },
    {
        key: 'soundEnabled',
        icon: <Volume2 size={20} />,
        label: 'Sound',
        description: 'Play sound for new orders',
    },
    {
        key: 'vibrationEnabled',
        icon: <Vibrate size={20} />,
        label: 'Vibration',
        description: 'Vibrate on new orders',
    },
    {
        key: 'autoAcceptOrders',
        icon: <Zap size={20} />,
        label: 'Auto-Accept Orders',
        description: 'Automatically accept nearby orders',
    },
    {
        key: 'darkMode',
        icon: <Moon size={20} />,
        label: 'Dark Mode',
        description: 'Use dark theme',
    },
];

const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'ta', name: 'தமிழ்' },
];

export function SettingsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [settings, setSettings] = useState<RiderSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLanguageModal, setShowLanguageModal] = useState(false);

    useEffect(() => {
        if (user?.id) {
            getRiderSettings(user.id).then((data) => {
                setSettings(data);
                setIsLoading(false);
            });
        }
    }, [user?.id]);

    const handleToggle = async (key: keyof RiderSettings) => {
        if (!user?.id || !settings) return;

        const newValue = !settings[key];
        setSettings({ ...settings, [key]: newValue });

        await updateRiderSettings(user.id, { [key]: newValue });
    };

    const handleLanguageChange = async (langCode: string) => {
        if (!user?.id || !settings) return;

        setSettings({ ...settings, language: langCode });
        setShowLanguageModal(false);

        await updateRiderSettings(user.id, { language: langCode });
    };

    const handleMaxDistanceChange = async (distance: number) => {
        if (!user?.id || !settings) return;

        setSettings({ ...settings, maxDistance: distance });

        await updateRiderSettings(user.id, { maxDistance: distance });
    };

    const selectedLanguage = languages.find(l => l.code === settings?.language) || languages[0];

    return (
        <div className="min-h-screen bg-black flex justify-center">
        <div className="w-full max-w-[430px] sm:max-w-[540px] md:max-w-[768px] min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Settings</h1>
                </div>
            </header>

            <main className="px-4 py-6 space-y-6">
                {/* Toggle Settings */}
                <section>
                    <h2 className="text-sm font-medium text-zinc-500 mb-3">Preferences</h2>
                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                        {toggleSettings.map((setting, index) => (
                            <div
                                key={setting.key}
                                className={clsx(
                                    "flex items-center gap-4 px-4 py-4",
                                    index !== toggleSettings.length - 1 && "border-b border-zinc-800"
                                )}
                            >
                                <span className="text-zinc-400">{setting.icon}</span>
                                <div className="flex-1">
                                    <p className="text-white">{setting.label}</p>
                                    <p className="text-xs text-zinc-500">{setting.description}</p>
                                </div>
                                <button
                                    onClick={() => handleToggle(setting.key)}
                                    disabled={isLoading}
                                    className={clsx(
                                        "relative w-12 h-7 rounded-full transition-colors",
                                        settings?.[setting.key]
                                            ? "bg-blue-500"
                                            : "bg-zinc-700"
                                    )}
                                >
                                    <motion.div
                                        layout
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        className={clsx(
                                            "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md",
                                            settings?.[setting.key] ? "left-[calc(100%-1.625rem)]" : "left-0.5"
                                        )}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Language */}
                <section>
                    <h2 className="text-sm font-medium text-zinc-500 mb-3">Language & Region</h2>
                    <button
                        onClick={() => setShowLanguageModal(true)}
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-zinc-900 border border-zinc-800"
                    >
                        <Globe size={20} className="text-zinc-400" />
                        <div className="flex-1 text-left">
                            <p className="text-white">Language</p>
                            <p className="text-xs text-zinc-500">{selectedLanguage.name}</p>
                        </div>
                        <ChevronRight size={18} className="text-zinc-600" />
                    </button>
                </section>

                {/* Max Distance */}
                <section>
                    <h2 className="text-sm font-medium text-zinc-500 mb-3">Order Preferences</h2>
                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                        <div className="flex items-center gap-4 mb-4">
                            <MapPin size={20} className="text-zinc-400" />
                            <div className="flex-1">
                                <p className="text-white">Maximum Distance</p>
                                <p className="text-xs text-zinc-500">Only show orders within this range</p>
                            </div>
                            <span className="text-blue-500 font-medium">{settings?.maxDistance || 10} km</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="25"
                            value={settings?.maxDistance || 10}
                            onChange={(e) => handleMaxDistanceChange(Number(e.target.value))}
                            className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-zinc-600 mt-1">
                            <span>2 km</span>
                            <span>25 km</span>
                        </div>
                    </div>
                </section>

                {/* App Info */}
                <section className="text-center text-xs text-zinc-600 pt-4">
                    <p>Qikwil Rider v1.0.0</p>
                    <p className="mt-1">© 2024 Qikwil. All rights reserved.</p>
                </section>
            </main>

            {/* Language Modal */}
            {showLanguageModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"
                    onClick={() => setShowLanguageModal(false)}
                >
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-zinc-900 rounded-t-2xl p-6"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Select Language</h3>
                        <div className="space-y-2">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={clsx(
                                        "w-full flex items-center justify-between p-4 rounded-xl transition-colors",
                                        settings?.language === lang.code
                                            ? "bg-blue-500/10 border border-blue-500/30 text-blue-500"
                                            : "bg-zinc-800 text-white hover:bg-zinc-700"
                                    )}
                                >
                                    <span>{lang.name}</span>
                                    {settings?.language === lang.code && (
                                        <span className="text-blue-500">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
        </div>
    );
}

export default SettingsPage;
