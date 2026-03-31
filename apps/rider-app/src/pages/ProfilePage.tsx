/**
 * Profile Page
 * 
 * Rider profile display with stats and settings links
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import {
    ArrowLeft, ChevronRight, Star, Truck, FileText,
    Settings, HelpCircle, LogOut, Shield, Clock, Package
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { BottomNavigation } from '../components/BottomNavigation';
import { getRiderProfile, getRiderStats, type RiderProfile, type RiderStats } from '../services/riderProfileService';

interface MenuItem {
    icon: React.ReactNode;
    label: string;
    path: string;
    badge?: string;
    variant?: 'danger';
}

const menuItems: MenuItem[] = [
    { icon: <FileText size={20} />, label: 'Order History', path: '/orders' },
    { icon: <Clock size={20} />, label: 'My Slots', path: '/slots' },
    { icon: <Shield size={20} />, label: 'Documents', path: '/documents', badge: 'Pending' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
    { icon: <HelpCircle size={20} />, label: 'Help & Support', path: '/support' },
];

export function ProfilePage() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<RiderProfile | null>(null);
    const [stats, setStats] = useState<RiderStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            Promise.all([
                getRiderProfile(user.id),
                getRiderStats(user.id),
            ]).then(([prof, st]) => {
                setProfile(prof);
                setStats(st);
                setIsLoading(false);
            });
        }
    }, [user?.id]);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const vehicleEmoji = {
        bike: '🏍️',
        scooter: '🛵',
        car: '🚗',
    };

    return (
        <div className="min-h-screen bg-black flex justify-center">
        <div className="w-full max-w-[430px] sm:max-w-[540px] md:max-w-[768px] min-h-screen bg-[#0a0a0a] pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Profile</h1>
                </div>
            </header>

            <main className="px-4 py-6 space-y-6">
                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6"
                >
                    <div className="flex items-center gap-4 mb-6">
                        {/* Avatar */}
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                            {profile?.name?.[0]?.toUpperCase() || 'R'}
                        </div>

                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white">
                                {isLoading ? '...' : profile?.name || 'Rider'}
                            </h2>
                            <p className="text-zinc-400 text-sm">{profile?.phone}</p>

                            {/* Rating */}
                            <div className="flex items-center gap-1 mt-1">
                                <Star size={14} className="fill-amber-500 text-amber-500" />
                                <span className="text-sm text-white font-medium">
                                    {profile?.rating?.toFixed(1) || '5.0'}
                                </span>
                                <span className="text-xs text-zinc-500">
                                    ({profile?.totalDeliveries || 0} deliveries)
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/edit-profile')}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                            Edit
                        </button>
                    </div>

                    {/* Vehicle info */}
                    {profile && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50">
                            <span className="text-2xl">
                                {vehicleEmoji[profile.vehicleType] || '🛵'}
                            </span>
                            <div>
                                <p className="text-white font-medium capitalize">{profile.vehicleType}</p>
                                <p className="text-xs text-zinc-500">{profile.vehicleNumber}</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Stats */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-3 gap-3 sm:gap-4"
                >
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
                        <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                        <p className="text-xl font-bold text-white">{stats?.totalDeliveries || 0}</p>
                        <p className="text-xs text-zinc-500">Deliveries</p>
                    </div>
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
                        <Star className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                        <p className="text-xl font-bold text-white">{stats?.avgRating?.toFixed(1) || '5.0'}</p>
                        <p className="text-xs text-zinc-500">Rating</p>
                    </div>
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
                        <Truck className="w-6 h-6 text-green-500 mx-auto mb-2" />
                        <p className="text-xl font-bold text-white">{stats?.completionRate || 100}%</p>
                        <p className="text-xs text-zinc-500">Completion</p>
                    </div>
                </motion.div>

                {/* Menu Items */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden"
                >
                    {menuItems.map((item, index) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={clsx(
                                "w-full flex items-center gap-4 px-4 py-4",
                                "hover:bg-zinc-800/50 transition-colors",
                                index !== menuItems.length - 1 && "border-b border-zinc-800"
                            )}
                        >
                            <span className="text-zinc-400">{item.icon}</span>
                            <span className="flex-1 text-left text-white">{item.label}</span>
                            {item.badge && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs">
                                    {item.badge}
                                </span>
                            )}
                            <ChevronRight size={18} className="text-zinc-600" />
                        </button>
                    ))}
                </motion.div>

                {/* Logout button */}
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </motion.button>
            </main>

            <BottomNavigation />
        </div>
        </div>
    );
}

export default ProfilePage;
