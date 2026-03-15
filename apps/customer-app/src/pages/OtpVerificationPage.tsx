import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Loader2, ArrowLeft } from "lucide-react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { verifyOtp, resendOtp } from "@/services/msg91OtpService";
import { supabase } from "@popclozet/api-client";

const SUPABASE_VERIFY_URL =
    "https://hfcdvcpgpkdgmcakgiuy.supabase.co/functions/v1/verify-otp-token";

export default function OtpVerificationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, needsOnboarding, loading } = useAuth();

    const phoneNumber = location.state?.phone || "";

    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [verified, setVerified] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Redirect if no phone in state
    useEffect(() => {
        if (!phoneNumber) navigate("/auth/login");
    }, [phoneNumber, navigate]);

    // Resend countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Navigate after auth context settles
    useEffect(() => {
        if (!verified || loading) return;
        if (user) {
            navigate(needsOnboarding ? "/auth/create-account" : "/home", { replace: true });
        }
    }, [verified, user, loading, needsOnboarding, navigate]);

    const handleVerify = async () => {
        if (otp.length !== 6) {
            setError("Please enter the 6-digit code");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            // Step 1: Verify OTP with MSG91 SDK — returns access token
            const msg91Data = await verifyOtp(otp);
            console.log('[OtpPage] MSG91 verify response:', msg91Data);

            const accessToken = msg91Data?.message;
            if (!accessToken) {
                throw new Error("OTP verification failed. No token received.");
            }

            // Step 2: Send access token to Supabase edge function
            const res = await fetch(SUPABASE_VERIFY_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ accessToken, mobile: phoneNumber }),
            });

            const result = await res.json();
            console.log('[OtpPage] Edge function response:', result);

            if (!result.success) {
                throw new Error(result.error || "Server verification failed.");
            }

            // Step 3: Set Supabase session from edge function response
            const { error: sessionError } = await supabase.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token,
            });

            if (sessionError) throw new Error(sessionError.message);

            setVerified(true);

        } catch (err: unknown) {
            const error = err as { message?: string };
            console.error("[OtpPage] Verification failed:", error);

            if (error.message?.includes("expired")) {
                setError("OTP has expired. Please request a new one.");
            } else if (error.message?.toLowerCase().includes("invalid")) {
                setError("Invalid OTP. Please check and try again.");
            } else {
                setError(error.message || "Verification failed. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        try {
            await resendOtp();
            setResendTimer(30);
            setError("");
        } catch (err: unknown) {
            const error = err as { message?: string };
            setError(error.message || "Failed to resend OTP.");
        }
    };

    return (
        <MobileShell className="bg-black text-white">
            <div className="flex flex-col min-h-screen px-6 pt-8 pb-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-xl font-bold">Verification</h1>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col items-center">
                    <div className="text-center mb-10">
                        <p className="text-zinc-400 text-sm mb-1">We've sent a verification code to</p>
                        <p className="text-white font-bold text-lg">+91 {phoneNumber}</p>
                    </div>

                    <div className="mb-8">
                        <InputOTP
                            maxLength={6}
                            value={otp}
                            onChange={(value) => {
                                setOtp(value);
                                setError("");
                            }}
                        >
                            <InputOTPGroup className="gap-2">
                                <InputOTPSlot index={0} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-lg rounded-lg" />
                                <InputOTPSlot index={1} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-lg rounded-lg" />
                                <InputOTPSlot index={2} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-lg rounded-lg" />
                                <InputOTPSlot index={3} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-lg rounded-lg" />
                                <InputOTPSlot index={4} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-lg rounded-lg" />
                                <InputOTPSlot index={5} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-lg rounded-lg" />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm mb-6 font-medium text-center">{error}</p>
                    )}

                    <Button
                        onClick={handleVerify}
                        disabled={otp.length !== 6 || isLoading}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#ff4d6d]/30 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            "Verify & Continue"
                        )}
                    </Button>

                    <div className="mt-6 text-center">
                        <p className="text-zinc-500 text-sm">
                            Didn't receive code?{" "}
                            <button
                                onClick={handleResend}
                                disabled={resendTimer > 0}
                                className={`font-bold transition-colors ${resendTimer > 0
                                    ? "text-zinc-600 cursor-not-allowed"
                                    : "text-[#ff4d6d] hover:underline"
                                    }`}
                            >
                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend"}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </MobileShell>
    );
}