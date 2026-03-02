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

export default function OtpVerificationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { confirmOTP, hasConfirmationResult, user, needsOnboarding, loading } = useAuth();

    const phoneNumber = location.state?.phone || "";

    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    // Set to true after confirmOTP succeeds — actual navigation happens in useEffect
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        if (!phoneNumber) {
            navigate("/auth/login");
        }
    }, [phoneNumber, navigate]);

    // Navigate ONLY after auth context has settled with the real user — no more 404 flash
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
            await confirmOTP(otp);
            // Don't navigate yet — wait for auth context to update (see useEffect above)
            setVerified(true);
        } catch (err: unknown) {
            const error = err as { message?: string };
            console.error("[OtpPage] Verification failed:", error);

            if (error.message?.includes("No OTP request")) {
                setError("Session expired. Please go back and request a new OTP.");
            } else if (error.message?.includes("Token has expired") || error.message?.includes("expired")) {
                setError("OTP has expired. Please request a new one.");
            } else if (error.message?.includes("invalid") || error.message?.includes("Invalid")) {
                setError("Invalid OTP. Please check and try again.");
            } else {
                setError(error.message || "Verification failed. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = () => {
        // Go back to login page to resend OTP
        navigate("/auth/login");
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
                                className="text-[#ff4d6d] font-bold hover:underline"
                            >
                                Resend
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </MobileShell>
    );
}
