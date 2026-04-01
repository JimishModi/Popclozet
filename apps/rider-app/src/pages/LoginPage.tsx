/**
 * Login Page — Phone OTP
 *
 * Rider authentication via phone OTP (same flow as customer app).
 * Works for both new riders and existing users from other apps.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Phone, ChevronRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { sendOtp } from '../services/msg91OtpService';
import logoImage from '../assets/popclozet-logo.svg';

export function LoginPage() {
    const navigate = useNavigate();
    const { loading: authLoading, user } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If already logged in, go to home (App.tsx handles rider check)
    if (!authLoading && user) {
        navigate('/');
        return null;
    }

    const handleSendOtp = useCallback(async () => {
        if (phoneNumber.length < 10) {
            setError('Please enter a valid 10-digit phone number.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const identifier = `91${phoneNumber}`;
            await sendOtp(identifier);
            navigate('/auth-otp', { state: { phone: phoneNumber } });
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [phoneNumber, navigate]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            {/* Header with logo */}
            <header className="flex items-center justify-center pt-16 pb-8">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-3"
                >
                    <img src={logoImage} alt="Popclozet" className="h-10 w-auto object-contain" />
                    <div>
                        <h1 className="text-xl font-bold text-white">Popclozet Rider</h1>
                        <p className="text-xs text-zinc-500">Delivery Partner</p>
                    </div>
                </motion.div>
            </header>

            {/* Form */}
            <main className="flex-1 px-6 flex flex-col justify-center">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="max-w-sm mx-auto w-full"
                >
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold text-white">Welcome</h2>
                        <p className="text-zinc-400 mt-1">Enter your phone number to get started</p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm"
                        >
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <div className="space-y-4">
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-3.5 flex items-center gap-3">
                            <Phone className="w-5 h-5 text-zinc-500" />
                            <span className="text-zinc-400 text-sm font-medium">+91</span>
                            <div className="w-px h-5 bg-zinc-700" />
                            <input
                                type="tel"
                                placeholder="Mobile Number"
                                value={phoneNumber}
                                onChange={(e) => {
                                    setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                                    setError(null);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                                className="flex-1 bg-transparent text-white outline-none text-sm"
                                autoFocus
                            />
                        </div>

                        <motion.button
                            onClick={handleSendOtp}
                            disabled={isLoading || phoneNumber.length < 10}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-base shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </motion.button>
                    </div>

                    <p className="text-center text-[10px] text-zinc-500 mt-10 leading-relaxed">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </motion.div>
            </main>
        </div>
    );
}

export default LoginPage;
