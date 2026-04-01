// src/pages/SignUpPage.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileShell } from '@/components/layout/MobileShell';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2, User, Phone, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '@popclozet/api-client';
import logo from '@/logo/popclozet-logo.svg';

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
    const [botField, setBotField] = useState(''); // honeypot

    const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        // Honeypot: if filled, treat as bot and ignore
        if (botField.trim() !== '') {
            return;
        }
        setError(null);

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Strong password policy: 12+ chars, with letters, numbers, and symbols
        const hasMinLength = formData.password.length >= 12;
        const hasLetter = /[A-Za-z]/.test(formData.password);
        const hasNumber = /[0-9]/.test(formData.password);
        const hasSymbol = /[^A-Za-z0-9]/.test(formData.password);

        if (!hasMinLength || !hasLetter || !hasNumber || !hasSymbol) {
            setError('Password must be at least 12 characters and include letters, numbers, and symbols');
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


    const isValidEmail = formData.email.includes('@') && formData.email.includes('.');
    const hasStrongPassword =
        formData.password.length >= 12 &&
        /[A-Za-z]/.test(formData.password) &&
        /[0-9]/.test(formData.password) &&
        /[^A-Za-z0-9]/.test(formData.password);
    const isFormValid =
        formData.fullName.length > 0 &&
        isValidEmail &&
        hasStrongPassword &&
        formData.password === formData.confirmPassword;

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
                        Welcome to Popclozet!
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
                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-600 text-white font-bold shadow-[0_10px_30px_rgba(242,84,109,0.4)] hover:shadow-[0_15px_40px_rgba(242,84,109,0.5)] transition-all active:scale-[0.98]"
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
                    className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-all active:scale-95"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <img src={logo} alt="Popclozet" className="h-10 w-auto object-contain ml-3" />
            </div>

            <main className="flex-1 overflow-y-auto px-4 py-6">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#f2546d] via-purple-500 to-blue-500 p-[2px] mx-auto mb-4">
                        <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1">
                        Create Account
                    </h1>
                    <p className="text-sm text-zinc-500">Join Popclozet and rent the trend</p>
                </motion.div>

                {/* Sign Up Form */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleSignUp}
                    className="space-y-4"
                >
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
                                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f2546d]/50 focus:ring-2 focus:ring-[#f2546d]/20 transition-all"
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
                                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f2546d]/50 focus:ring-2 focus:ring-[#f2546d]/20 transition-all"
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
                                className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f2546d]/50 focus:ring-2 focus:ring-[#f2546d]/20 transition-all"
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
                                className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f2546d]/50 focus:ring-2 focus:ring-[#f2546d]/20 transition-all"
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
                        {formData.password.length > 0 && !hasStrongPassword && (
                            <p className="text-xs text-amber-500">
                                Use at least 12 characters with letters, numbers, and symbols
                            </p>
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
                                className="w-full h-12 pl-12 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f2546d]/50 focus:ring-2 focus:ring-[#f2546d]/20 transition-all"
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
                        <span className="text-[#f2546d]">Terms of Service</span> and{' '}
                        <span className="text-[#f2546d]">Privacy Policy</span>
                    </p>

                    {/* Sign Up Button */}
                    <button
                        type="submit"
                        disabled={!isFormValid || isLoading}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-600 text-white font-bold text-lg shadow-[0_10px_30px_rgba(242,84,109,0.4)] hover:shadow-[0_15px_40px_rgba(242,84,109,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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


                {/* Sign In Link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-6 pb-4"
                >
                    <p className="text-sm text-zinc-500">
                        Already have an account?{' '}
                        <Link to="/signin" className="text-[#f2546d] font-medium hover:underline">
                            Sign In
                        </Link>
                    </p>
                </motion.div>
            </main>
        </MobileShell>
    );
};

export default SignUpPage;
