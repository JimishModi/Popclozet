/**
 * Signup Page
 * 
 * New rider registration page
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Eye, EyeOff, Mail, Lock, User, Phone, AlertCircle, ChevronRight, Car } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { supabase } from '@popclozet/api-client';

type VehicleType = 'bike' | 'scooter' | 'car';

const vehicleOptions: { value: VehicleType; label: string; icon: string }[] = [
    { value: 'bike', label: 'Bike', icon: '🏍️' },
    { value: 'scooter', label: 'Scooter', icon: '🛵' },
    { value: 'car', label: 'Car', icon: '🚗' },
];

interface SignupPageProps {
    initialStep?: number;
}

export function SignupPage({ initialStep = 1 }: SignupPageProps) {
    const navigate = useNavigate();
    const { signUp, user, profile } = useAuth();
    const [step, setStep] = useState(initialStep);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [botField, setBotField] = useState(''); // honeypot

    // Form data
    const [formData, setFormData] = useState({
        name: profile?.full_name || '',
        email: profile?.email || user?.email || '',
        phone: profile?.phone || '',
        password: '',
        confirmPassword: '',
        vehicleType: 'scooter' as VehicleType,
        vehicleNumber: '',
        licenseNumber: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);

    // Sync form data with profile/user when they load
    useEffect(() => {
        if (profile || user) {
            setFormData(prev => ({
                ...prev,
                name: prev.name || profile?.full_name || '',
                email: prev.email || profile?.email || user?.email || '',
                phone: prev.phone || profile?.phone || '',
            }));
        }
    }, [profile, user]);

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const validateStep1 = () => {
        if (!formData.name.trim()) {
            setError('Please enter your name');
            return false;
        }
        if (!formData.email.trim() || !formData.email.includes('@')) {
            setError('Please enter a valid email');
            return false;
        }
        if (!formData.phone.trim() || formData.phone.length < 10) {
            setError('Please enter a valid phone number');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        const hasMinLength = formData.password.length >= 12;
        const hasLetter = /[A-Za-z]/.test(formData.password);
        const hasNumber = /[0-9]/.test(formData.password);
        const hasSymbol = /[^A-Za-z0-9]/.test(formData.password);

        if (!hasMinLength || !hasLetter || !hasNumber || !hasSymbol) {
            setError('Password must be at least 12 characters and include letters, numbers, and symbols');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        return true;
    };

    const validateStep3 = () => {
        if (!formData.name.trim()) {
            setError('Please enter your name');
            return false;
        }
        if (!formData.vehicleNumber.trim()) {
            setError('Please enter your vehicle number');
            return false;
        }
        if (!formData.licenseNumber.trim()) {
            setError('Please enter your license number');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Honeypot: ignore submissions that fill this field
        if (botField.trim() !== '') {
            return;
        }
        if (!validateStep3()) return;

        setError(null);
        setIsLoading(true);

        try {
            if (user) {
                // Logged-in user completing rider registration (e.g. coming from customer app)
                // Only create the riders table entry — do NOT touch profiles.role
                // so their customer app access remains intact
                const { error: riderInsertError } = await supabase
                    .from('riders')
                    .insert({
                        id: user.id,
                        name: formData.name || profile?.full_name || user.user_metadata?.full_name || '',
                        phone: profile?.phone || user.user_metadata?.phone || user.phone || '',
                        email: user.email,
                        vehicle_type: formData.vehicleType,
                        vehicle_number: formData.vehicleNumber,
                        license_number: formData.licenseNumber,
                    });

                if (riderInsertError) throw riderInsertError;

                window.location.href = '/';
                return;
            }

            // New user registration
            await signUp(formData.email, formData.password, formData.name, formData.phone, {
                role: 'rider',
                vehicle_type: formData.vehicleType,
                vehicle_number: formData.vehicleNumber,
                license_number: formData.licenseNumber
            });
            // Navigate to home on success
            navigate('/');
        } catch (err: any) {
            const message = err?.message || 'Failed to create account';
            if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('already exists')) {
                // Account exists in auth.users (e.g. from customer app) but no rider profile.
                // Try signing in with the provided credentials and create the rider profile.
                try {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email: formData.email,
                        password: formData.password,
                    });

                    if (signInError) {
                        // Password auth failed — user may have signed up via phone OTP (no password).
                        // Send a magic link so they can log in without a password.
                        const { error: otpError } = await supabase.auth.signInWithOtp({
                            email: formData.email,
                            options: { shouldCreateUser: false },
                        });
                        if (otpError) {
                            setError('An account with this email exists. Please log in to the rider app to complete registration.');
                        } else {
                            setMagicLinkSent(true);
                        }
                        return;
                    }

                    const existingUser = signInData.user;

                    // Check if rider profile already exists
                    const { data: existingRider } = await supabase
                        .from('riders')
                        .select('id')
                        .eq('id', existingUser.id)
                        .single();

                    if (existingRider) {
                        navigate('/');
                        return;
                    }

                    // Create the missing rider profile
                    const { error: riderError } = await supabase.from('riders').insert({
                        id: existingUser.id,
                        name: formData.name || existingUser.user_metadata?.full_name || '',
                        phone: formData.phone || existingUser.user_metadata?.phone || '',
                        email: formData.email,
                        vehicle_type: formData.vehicleType,
                        vehicle_number: formData.vehicleNumber,
                        license_number: formData.licenseNumber,
                    });

                    if (riderError) throw riderError;

                    navigate('/');
                } catch (upgradeErr: any) {
                    setError(upgradeErr?.message || 'Failed to complete rider registration. Please contact support.');
                }
            } else {
                setError(message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            {/* Header */}
            <header className="px-4 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : navigate('/login')}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <span className="text-sm text-zinc-500">Step {step} of 3</span>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: `${(step / 3) * 100}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                    />
                </div>
            </header>

            {/* Form */}
            <main className="flex-1 px-6">
                <motion.div
                    key={step}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="max-w-sm mx-auto"
                >
                    {/* Step 1: Personal Info */}
                    {step === 1 && (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Personal Information</h2>
                                <p className="text-zinc-400 mt-1">Tell us about yourself</p>
                            </div>

                            <div className="space-y-4">
                                {/* Name */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => updateFormData('name', e.target.value)}
                                            placeholder="Enter your full name"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-4 rounded-xl",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateFormData('email', e.target.value)}
                                            placeholder="Enter your email"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-4 rounded-xl",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Phone Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => updateFormData('phone', e.target.value)}
                                            placeholder="Enter your phone number"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-4 rounded-xl",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Step 2: Password */}
                    {step === 2 && (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Create Password</h2>
                                <p className="text-zinc-400 mt-1">Secure your account</p>
                            </div>

                            <div className="space-y-4">
                                {/* Password */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={(e) => updateFormData('password', e.target.value)}
                                            placeholder="Create a password"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-12 rounded-xl",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.confirmPassword}
                                            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                                            placeholder="Confirm your password"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-4 rounded-xl",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-zinc-500">
                                    Use at least 12 characters with letters, numbers, and symbols
                                </p>
                            </div>
                        </>
                    )}

                    {/* Step 3: Name + Vehicle Info */}
                    {step === 3 && (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Rider Details</h2>
                                <p className="text-zinc-400 mt-1">Your name and vehicle information</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
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

                                {/* Name */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => updateFormData('name', e.target.value)}
                                            placeholder="Enter your full name"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-4 rounded-xl",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Vehicle Type */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Vehicle Type</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {vehicleOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => updateFormData('vehicleType', option.value)}
                                                className={clsx(
                                                    "p-3 rounded-xl border transition-colors text-center",
                                                    formData.vehicleType === option.value
                                                        ? "bg-blue-500/10 border-blue-500/50 text-white"
                                                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                                                )}
                                            >
                                                <span className="text-2xl block mb-1">{option.icon}</span>
                                                <span className="text-xs">{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Vehicle Number */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Vehicle Number</label>
                                    <div className="relative">
                                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                        <input
                                            type="text"
                                            value={formData.vehicleNumber}
                                            onChange={(e) => updateFormData('vehicleNumber', e.target.value.toUpperCase())}
                                            placeholder="e.g., TS09AB1234"
                                            className={clsx(
                                                "w-full h-12 pl-10 pr-4 rounded-xl uppercase",
                                                "bg-zinc-900 border border-zinc-800",
                                                "text-white placeholder:text-zinc-600",
                                                "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* License Number */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-zinc-400">Driving License Number</label>
                                    <input
                                        type="text"
                                        value={formData.licenseNumber}
                                        onChange={(e) => updateFormData('licenseNumber', e.target.value.toUpperCase())}
                                        placeholder="Enter license number"
                                        className={clsx(
                                            "w-full h-12 px-4 rounded-xl uppercase",
                                            "bg-zinc-900 border border-zinc-800",
                                            "text-white placeholder:text-zinc-600",
                                            "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                        )}
                                    />
                                </div>
                            </form>
                        </>
                    )}

                    {/* Error */}
                    {magicLinkSent && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm"
                        >
                            <p className="font-semibold mb-1">Check your email!</p>
                            <p>We've sent a login link to <strong>{formData.email}</strong>. Click it to get logged in — then you'll be guided to complete your rider registration.</p>
                        </motion.div>
                    )}
                    {error && !magicLinkSent && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm"
                        >
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </motion.div>
                    )}
                </motion.div>
            </main>

            {/* Footer with buttons */}
            <footer className="px-6 py-6">
                <div className="max-w-sm mx-auto">
                    {step < 3 ? (
                        <motion.button
                            onClick={handleNext}
                            whileTap={{ scale: 0.98 }}
                            className={clsx(
                                "w-full h-12 rounded-xl font-semibold",
                                "bg-gradient-to-r from-blue-500 to-blue-600",
                                "text-white shadow-lg shadow-blue-500/25",
                                "flex items-center justify-center gap-2"
                            )}
                        >
                            <span>Continue</span>
                            <ChevronRight size={18} />
                        </motion.button>
                    ) : (
                        <motion.button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            whileTap={{ scale: 0.98 }}
                            className={clsx(
                                "w-full h-12 rounded-xl font-semibold",
                                "bg-gradient-to-r from-green-500 to-green-600",
                                "text-white shadow-lg shadow-green-500/25",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "flex items-center justify-center gap-2"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <span>Create Account</span>
                            )}
                        </motion.button>
                    )}

                    <p className="text-center text-zinc-500 text-sm mt-4">
                        Already have an account?{' '}
                        <Link to="/login" className="text-blue-500 font-medium">Login</Link>
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default SignupPage;
