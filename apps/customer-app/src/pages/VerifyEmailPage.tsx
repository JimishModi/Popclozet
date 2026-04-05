import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { supabase } from "@popclozet/api-client";

async function checkAndRoute(user: any, navigate: any) {
    if (!user) {
        navigate("/auth/login", { replace: true });
        return;
    }
    const { data: profile } = await supabase.from("customer_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!profile) {
        navigate("/auth/create-account", { replace: true });
    } else if (profile.onboarding_completed) {
        navigate("/home", { replace: true });
    } else if (!profile.phone && !user.phone) {
        navigate("/auth/collect-phone", { replace: true });
    } else if (!profile.email && !user.email) {
        navigate("/auth/collect-email", { replace: true });
    } else {
        navigate("/auth/create-account", { replace: true });
    }
}

export default function VerifyEmailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, loading: authLoading } = useAuth();

    const email = location.state?.email || "";

    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [verified, setVerified] = useState(false);

    // Redirect if no email in state
    useEffect(() => {
        if (!email) navigate("/auth/login");
    }, [email, navigate]);

    // Requirement 7: Route guard for logged-in users
    useEffect(() => {
        if (!verified || authLoading) return;
        if (user) {
            checkAndRoute(user, navigate);
        }
    }, [verified, user, authLoading, profile, navigate]);

    const handleVerify = async () => {
        if (otp.length !== 6) {
            setError("Please enter the 6-digit code");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: "email",
            });

            if (error) throw error;
            setVerified(true);
        } catch (err: any) {
            console.error("[VerifyEmailPage] Verification failed:", err);
            setError(err.message || "Verification failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
                {/* Header */}
                <header className="sticky top-0 z-50 bg-[#1a1a1a]/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-xl font-bold">Verify Email</h1>
                </header>

                <div className="flex flex-col min-h-screen px-6 pt-8 pb-8 md:max-w-md md:mx-auto w-full">

                {/* Content */}
                <div className="flex-1 flex flex-col items-center md:items-start">
                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-8 border border-zinc-800">
                        <Mail className="w-8 h-8 text-[#f2546d]" />
                    </div>

                    <div className="text-center md:text-left mb-10 w-full">
                        <p className="text-zinc-400 text-sm mb-1">We've sent a verification code to</p>
                        <p className="text-white font-bold text-lg">{email}</p>
                    </div>

                    <div className="mb-8 w-full flex justify-center md:justify-start">
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
                        <p className="text-red-500 text-sm mb-6 font-medium text-center md:text-left w-full">{error}</p>
                    )}

                    <div className="w-full space-y-4">
                        <Button
                            onClick={handleVerify}
                            disabled={otp.length !== 6 || isLoading}
                            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#f2546d]/30 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Verify & Continue"
                            )}
                        </Button>
                    </div>

                    <div className="mt-8 text-center md:text-left w-full">
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            If you don't see the email, check your spam folder or try logging in again.
                        </p>
                    </div>
                </div>
            </div>
        </MobileShell>
    );
}
