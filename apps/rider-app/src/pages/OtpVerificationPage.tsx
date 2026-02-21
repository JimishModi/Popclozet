/**
 * OTP Verification Page
 * 
 * Customer OTP verification for delivery confirmation
 */

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Shield, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { completeDelivery } from '../services/riderOrderService';
export function OtpVerificationPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const orderDetails = location.state?.order;

    const [otp, setOtp] = useState(['', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(30);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Focus first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Only allow digits

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1); // Only take last digit
        setOtp(newOtp);
        setError(null);

        // Auto-focus next input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all digits entered
        if (newOtp.every(d => d) && index === 3) {
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
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (pasted.length === 4) {
            const newOtp = pasted.split('');
            setOtp(newOtp);
            handleVerify(pasted);
        }
    };

    const handleVerify = async (otpCode: string) => {
        if (!orderId) return;

        setIsVerifying(true);
        setError(null);

        // In production, verify OTP with backend
        // For now, simulate verification
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock verification - accept any 4-digit code for demo
        if (otpCode.length === 4) {
            try {
                // Complete delivery via server-side RPC (validates rider auth + credits wallet)
                await completeDelivery(orderId);
                navigate('/order-complete', { state: { order: orderDetails } });
            } catch (err) {
                console.error('Delivery completion failed:', err);
                setError('Failed to complete delivery. Please try again.');
                setIsVerifying(false);
            }
        } else {
            setError('Invalid OTP. Please try again.');
            setIsVerifying(false);
            setOtp(['', '', '', '']);
            inputRefs.current[0]?.focus();
        }
    };

    const handleResend = () => {
        setResendTimer(30);
        setOtp(['', '', '', '']);
        setError(null);
        inputRefs.current[0]?.focus();
        // In production, call resend OTP API
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            {/* Header */}
            <header className="flex items-center gap-4 px-4 h-16 border-b border-zinc-800/50">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold text-white">Verify Delivery</h1>
            </header>

            {/* Content */}
            <main className="flex-1 flex flex-col items-center justify-center px-6">
                {/* Icon */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6"
                >
                    <Shield className="text-blue-500" size={40} />
                </motion.div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white text-center mb-2">
                    Enter Customer OTP
                </h2>
                <p className="text-zinc-400 text-center mb-8 max-w-xs">
                    Ask the customer for the 4-digit OTP sent to their phone
                </p>

                {/* OTP Input */}
                <div className="flex gap-3 mb-6" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                        <motion.input
                            key={index}
                            ref={el => inputRefs.current[index] = el}
                            type="tel"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            disabled={isVerifying}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={clsx(
                                "w-14 h-16 text-center text-2xl font-bold rounded-xl",
                                "bg-zinc-900 border-2 transition-colors",
                                "focus:outline-none",
                                error
                                    ? "border-red-500 text-red-500"
                                    : digit
                                        ? "border-blue-500 text-white"
                                        : "border-zinc-700 text-white focus:border-blue-500",
                                isVerifying && "opacity-50 cursor-not-allowed"
                            )}
                        />
                    ))}
                </div>

                {/* Loading indicator */}
                {isVerifying && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-blue-400 mb-4"
                    >
                        <span className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                        <span>Verifying...</span>
                    </motion.div>
                )}

                {/* Error message */}
                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-400 text-sm mb-4"
                    >
                        {error}
                    </motion.p>
                )}

                {/* Resend button */}
                <button
                    onClick={handleResend}
                    disabled={resendTimer > 0 || isVerifying}
                    className={clsx(
                        "flex items-center gap-2 text-sm",
                        resendTimer > 0 || isVerifying
                            ? "text-zinc-600"
                            : "text-blue-500 hover:text-blue-400"
                    )}
                >
                    <RefreshCw size={16} className={resendTimer > 0 ? '' : 'animate-spin-slow'} />
                    {resendTimer > 0 ? (
                        <span>Resend OTP in {resendTimer}s</span>
                    ) : (
                        <span>Resend OTP</span>
                    )}
                </button>
            </main>

            {/* Footer */}
            <footer className="px-6 py-6">
                <p className="text-center text-xs text-zinc-600">
                    Having trouble? Contact support for assistance
                </p>
            </footer>
        </div>
    );
}

export default OtpVerificationPage;
