// src/pages/SignInPage.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileShell } from '@/components/layout/MobileShell';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@popclozet/api-client';
import logo from '@/logo/logo.png';

const SignInPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockUntil, setLockUntil] = useState<number | null>(null);
    const [botField, setBotField] = useState(''); // honeypot

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();

        // Honeypot: if filled, likely a bot – silently abort
        if (botField.trim() !== '') {
            return;
        }
        const now = Date.now();
        if (lockUntil && now < lockUntil) {
            setError('Too many attempts. Please wait a moment before trying again.');
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            setFailedAttempts(0);
            setLockUntil(null);
            navigate('/home');
        } catch (err: any) {
            setError(err.message || 'Failed to sign in. Please try again.');
            const attempts = failedAttempts + 1;
            setFailedAttempts(attempts);
            if (attempts >= 5) {
                setLockUntil(Date.now() + 60_000);
            }
        } finally {
            setIsLoading(false);
        }
    };


    const isValidEmail = email.includes('@') && email.includes('.');
    const isLocked = lockUntil !== null && Date.now() < lockUntil;

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <img src={logo} alt="POPCLOZET" className="h-5 w-auto object-contain ml-3" />
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff4d6d] via-purple-500 to-blue-500 p-[3px] mx-auto mb-6">
                        <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-2">
                        Welcome Back
                    </h1>
                    <p className="text-sm text-zinc-500">Sign in to access your closet</p>
                </motion.div>

                {/* Sign In Form */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleSignIn}
                    className="space-y-5"
                >
                    {/* Email Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Honeypot field (hidden from users) */}
                    <div className="hidden" aria-hidden="true">
                        <label>
                            Company
                            <input
                                type="text"
                                autoComplete="off"
                                value={botField}
                                onChange={(e) => setBotField(e.target.value)}
                            />
                        </label>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full h-14 pl-12 pr-12 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Forgot Password Link */}
                    <div className="text-right">
                        <button type="button" className="text-sm text-[#ff4d6d] hover:underline">
                            Forgot password?
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        disabled={!isValidEmail || password.length < 6 || isLoading || isLocked}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white font-bold text-lg shadow-[0_10px_30px_rgba(255,77,109,0.4)] hover:shadow-[0_15px_40px_rgba(255,77,109,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing In...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </motion.form>

                {/* Sign Up Link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-8"
                >
                    <p className="text-sm text-zinc-500">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-[#ff4d6d] font-medium hover:underline">
                            Sign Up
                        </Link>
                    </p>
                </motion.div>
            </main>
        </MobileShell>
    );
};

export default SignInPage;
