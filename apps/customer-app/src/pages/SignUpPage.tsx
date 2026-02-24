// src/pages/SignUpPage.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileShell } from '@/components/layout/MobileShell';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, User, Phone, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '@popclozet/api-client';
import logo from '@/logo/logo.png';

const SignUpPage: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        phone: formData.phone,
                    },
                },
            });

            if (error) throw error;

            setIsSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: `${window.location.origin}/auth/callback`,
                    },
                });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'Failed to sign up with Google.');
        }
    };

    const isValidEmail = formData.email.includes('@') && formData.email.includes('.');
    const isFormValid = formData.fullName.length > 0 && isValidEmail && formData.password.length >= 6 && formData.password === formData.confirmPassword;

    // Success State
    if (isSuccess) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-8 shadow-[0_20px_50px_rgba(34,197,94,0.4)]"
                    >
                        <CheckCircle2 className="w-12 h-12 text-white" />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-bold text-white mb-3 text-center"
                    >
                        Welcome to PopClozet!
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-zinc-400 text-center mb-8 max-w-xs"
                    >
                        Check your email to verify your account, then sign in to start shopping!
                    </motion.p>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        onClick={() => navigate('/signin')}
                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white font-bold shadow-[0_10px_30px_rgba(255,77,109,0.4)] hover:shadow-[0_15px_40px_rgba(255,77,109,0.5)] transition-all active:scale-[0.98]"
                    >
                        Go to Sign In
                    </motion.button>
                </div>
            </MobileShell>
        );
    }

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

            <main className="flex-1 overflow-y-auto px-4 py-6">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff4d6d] via-purple-500 to-blue-500 p-[2px] mx-auto mb-4">
                        <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1">
                        Create Account
                    </h1>
                    <p className="text-sm text-zinc-500">Join PopClozet and rent the trend</p>
                </motion.div>

                {/* Sign Up Form */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleSignUp}
                    className="space-y-4"
                >
                    {/* Full Name Field */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-400">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={handleChange('fullName')}
                                placeholder="John Doe"
                                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-400">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={handleChange('email')}
                                placeholder="your@email.com"
                                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Phone Field */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-400">Phone (Optional)</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange('phone')}
                                placeholder="+91 98765 43210"
                                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-400">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={handleChange('password')}
                                placeholder="••••••••"
                                className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
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
                        {formData.password.length > 0 && formData.password.length < 6 && (
                            <p className="text-xs text-amber-500">Password must be at least 6 characters</p>
                        )}
                    </div>

                    {/* Confirm Password Field */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-zinc-400">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={formData.confirmPassword}
                                onChange={handleChange('confirmPassword')}
                                placeholder="••••••••"
                                className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && (
                            <p className="text-xs text-red-400">Passwords do not match</p>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Terms */}
                    <p className="text-xs text-zinc-600 text-center py-2">
                        By signing up, you agree to our{' '}
                        <span className="text-[#ff4d6d]">Terms of Service</span> and{' '}
                        <span className="text-[#ff4d6d]">Privacy Policy</span>
                    </p>

                    {/* Sign Up Button */}
                    <button
                        type="submit"
                        disabled={!isFormValid || isLoading}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-600 text-white font-bold text-lg shadow-[0_10px_30px_rgba(255,77,109,0.4)] hover:shadow-[0_15px_40px_rgba(255,77,109,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Creating Account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </motion.form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-zinc-600 font-medium">OR</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Social Sign Up */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={handleGoogleSignUp}
                    className="w-full h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Continue with Google
                </motion.button>

                {/* Sign In Link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-6 pb-4"
                >
                    <p className="text-sm text-zinc-500">
                        Already have an account?{' '}
                        <Link to="/signin" className="text-[#ff4d6d] font-medium hover:underline">
                            Sign In
                        </Link>
                    </p>
                </motion.div>
            </main>
        </MobileShell>
    );
};

export default SignUpPage;
