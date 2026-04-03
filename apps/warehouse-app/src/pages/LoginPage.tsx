/**
 * Login Page — Mobile Layout
 * Warehouse staff authentication with purple branding.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react';
import { WarehouseShell } from '../components/layout/WarehouseShell';
import logoImage from '../assets/popclozet-logo.svg';

export function LoginPage() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setLoading(true);
        setError('');
        try {
            await signIn(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <WarehouseShell hideBottomNav>
            <div className="flex-1 flex flex-col justify-center px-6 py-12">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <img src={logoImage} alt="Popclozet" className="h-12 w-auto mx-auto mb-4 object-contain" />
                    <h1 className="text-2xl font-bold text-white">Popclozet Warehouse</h1>
                    <p className="text-sm text-zinc-500 mt-1">Inventory & Operations Hub</p>
                </motion.div>

                {/* Form */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleLogin}
                    className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4"
                >
                    <div>
                        <h2 className="text-base font-bold text-white">Welcome Back</h2>
                        <p className="text-xs text-zinc-500">Sign in to manage warehouse operations</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <p className="text-xs text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="warehouse@popclozet.com"
                                className="input-field pl-9 h-11 text-sm"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="input-field pl-9 pr-10 h-11 text-sm"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-warehouse-500 to-warehouse-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? (
                            <><Loader size={16} className="animate-spin" /> Signing in...</>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </motion.form>

                <p className="text-center text-[10px] text-zinc-600 mt-6">Popclozet Warehouse Hub v1.0</p>
            </div>
        </WarehouseShell>
    );
}
