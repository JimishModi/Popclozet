/**
 * Auth OTP Verification Page
 *
 * Verifies phone OTP for rider login/signup.
 * After verification, App.tsx checks riders table and routes accordingly.
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase } from '@popclozet/api-client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { verifyOtp, loadAndInitMsg91, sendOtp } from '../services/msg91OtpService';

export function AuthOtpPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const phoneNumber: string = location.state?.phone || '';
    const { user, loading } = useAuth();

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [verified, setVerified] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Redirect if no phone was passed
    useEffect(() => {
        if (!phoneNumber) {
            navigate('/login');
            return;
        }
        // Init SDK without auto-sending (OTP already sent from login page)
        loadAndInitMsg91(`91${phoneNumber}`, false).catch(console.error);
    }, [phoneNumber, navigate]);

    // Resend countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Focus first input
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    // After verified + user loaded → navigate (App.tsx handles rider check)
    useEffect(() => {
        if (!verified || loading) return;
        if (user) {
            // Full reload so App.tsx re-checks riders table
            window.location.href = '/';
        }
    }, [verified, user, loading]);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        setError('');

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (newOtp.every(d => d) && index === 5) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setOtp(pasted.split(''));
            handleVerify(pasted);
        }
    };

    const handleVerify = async (otpCode: string) => {
        setIsLoading(true);
        setError('');
        try {
            // Step 1: Verify OTP with MSG91
            const msg91Data = await verifyOtp(String(otpCode));
            const accessToken = msg91Data?.message;
            if (!accessToken) throw new Error('OTP verification failed. No token received.');

            // Step 2: Call edge function to get/create user and session
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp-token`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ accessToken, mobile: phoneNumber }),
                }
            );
            const result = await res.json();
            if (!result.success) {
                throw new Error(result.details ? `${result.error}: ${result.details}` : (result.error || 'Server verification failed.'));
            }

            // Step 3: Set Supabase session
            if (!result.session?.access_token || !result.session?.refresh_token) {
                throw new Error('Verification succeeded but no session returned. Please try again.');
            }
            const { error: sessionError } = await supabase.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token,
            });
            if (sessionError) throw new Error(sessionError.message);

            setVerified(true);
        } catch (err: any) {
            if (err.message?.includes('expired')) {
                setError('OTP has expired. Please request a new one.');
            } else if (err.message?.toLowerCase().includes('invalid')) {
                setError('Invalid OTP. Please check and try again.');
            } else {
                setError(err.message || 'Verification failed. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        try {
            await sendOtp(`91${phoneNumber}`);
            setResendTimer(30);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to resend OTP.');
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            <header className="px-4 pt-6 pb-4">
                <button
                    onClick={() => navigate('/login')}
                    className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 active:scale-95 transition-transform"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
            </header>

            <main className="flex-1 px-6 pt-8">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="max-w-sm mx-auto"
                >
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Verify Phone</h1>
                        <p className="text-zinc-400">Enter the 6-digit code sent to +91 {phoneNumber}</p>
                    </div>

                    {/* OTP Input */}
                    <div className="flex justify-center gap-1.5 sm:gap-2 mb-6">
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={el => { inputRefs.current[i] = el; }}
                                type="tel"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                            />
                        ))}
                    </div>

                    {error && <p className="text-red-500 text-sm text-center font-medium mb-4">{error}</p>}

                    <motion.button
                        onClick={() => handleVerify(otp.join(''))}
                        disabled={isLoading || otp.some(d => !d)}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-base shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
                    </motion.button>

                    <button
                        onClick={handleResend}
                        disabled={resendTimer > 0}
                        className="w-full py-3 mt-4 text-zinc-500 text-sm font-medium disabled:opacity-50"
                    >
                        {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                </motion.div>
            </main>
        </div>
    );
}

export default AuthOtpPage;
