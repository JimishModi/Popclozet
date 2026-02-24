/**
 * OTP Verify Modal — Rider App
 * 
 * 4-digit input modal for the rider to verify the customer's delivery OTP.
 * On success, marks the delivery as complete.
 */

import React, { useState, useRef, useEffect } from 'react';

interface OtpVerifyModalProps {
    isOpen: boolean;
    orderId: string;
    onVerifySuccess: () => void;
    onClose: () => void;
}

export function OtpVerifyModal({ isOpen, orderId, onVerifySuccess, onClose }: OtpVerifyModalProps) {
    const [digits, setDigits] = useState(['', '', '', '']);
    const [error, setError] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (isOpen) {
            setDigits(['', '', '', '']);
            setError(null);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    const handleDigitChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newDigits = [...digits];
        newDigits[index] = value.slice(-1);
        setDigits(newDigits);
        setError(null);

        // Auto-advance to next input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 4 digits entered
        if (value && index === 3) {
            const otp = newDigits.join('');
            if (otp.length === 4) {
                handleVerify(otp);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otp: string) => {
        setIsVerifying(true);
        setError(null);

        try {
            // Import dynamically to avoid circular deps
            const { verifyDeliveryOtp } = await import('../services/deliveryOtpService');
            const result = await verifyDeliveryOtp(orderId, otp);

            if (result.success) {
                onVerifySuccess();
            } else {
                setError(result.error || 'Incorrect OTP');
                setDigits(['', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }
        } catch (err) {
            setError('Verification failed. Try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-3xl p-6 w-[340px] mx-4 border border-zinc-800">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f2546d]/10 flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f2546d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">Verify Delivery</h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Enter the 4-digit code shown on the customer's phone
                    </p>
                </div>

                {/* OTP Inputs */}
                <div className="flex items-center justify-center gap-3 mb-4">
                    {digits.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleDigitChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            className="w-14 h-16 text-center text-2xl font-bold text-white bg-zinc-800 rounded-xl border border-zinc-700 focus:border-[#f2546d] focus:ring-1 focus:ring-[#f2546d] outline-none transition-colors"
                            disabled={isVerifying}
                        />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <p className="text-center text-sm text-red-400 mb-4">{error}</p>
                )}

                {/* Loading indicator */}
                {isVerifying && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-4 h-4 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-zinc-400">Verifying...</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleVerify(digits.join(''))}
                        disabled={digits.join('').length !== 4 || isVerifying}
                        className="flex-1 py-3 rounded-xl bg-[#f2546d] text-white text-sm font-medium hover:bg-[#e04460] transition-colors disabled:opacity-50"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

export default OtpVerifyModal;
