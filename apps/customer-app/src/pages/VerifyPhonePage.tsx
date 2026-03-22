import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { supabase } from "@popclozet/api-client";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Loader2, ArrowLeft, Phone } from "lucide-react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { verifyOtp as msg91Verify, resendOtp as msg91Resend } from "@/services/msg91OtpService";

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

export default function VerifyPhonePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, loading: authLoading, updateProfile: ctxUpdateProfile } = useAuth();

    const phoneNumber = location.state?.phone || "";

    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [verified, setVerified] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Redirect if no phone in state
    useEffect(() => {
        if (!phoneNumber) navigate("/auth/collect-phone");
    }, [phoneNumber, navigate]);

    // Resend timer effect
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Handle profile update after verification
    useEffect(() => {
        if (!verified || !user) return;

        const savePhone = async () => {
            try {
                // Requirement 5: After verification, update the customer_profiles table
                await ctxUpdateProfile({ phone: `+91${phoneNumber}` });
                checkAndRoute(user, navigate);
            } catch (err: any) {
                console.error("Failed to update profile with phone:", err);
                if (err.code === '23505') {
                    setError("This phone number is already linked to another account.");
                } else {
                    setError("Failed to update profile. Please try again.");
                }
                setVerified(false);
            }
        };

        savePhone();
    }, [verified, user, phoneNumber, navigate, ctxUpdateProfile]);

    const handleResend = async () => {
        if (resendTimer > 0) return;
        try {
            await msg91Resend();
            setResendTimer(30);
            setError("");
        } catch (err: any) {
            setError(err.message || "Failed to resend OTP.");
        }
    };

    const handleVerify = async () => {
        if (otp.length !== 6) {
            setError("Please enter the 6-digit code");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const msg91Data = await msg91Verify(otp);
            const accessToken = msg91Data?.message;
            if (!accessToken) throw new Error("Verification failed. No token received.");

            setVerified(true);
        } catch (err: any) {
            console.error("[VerifyPhonePage] Verification failed:", err);
            setError(err.message || "Verification failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
            <header className="sticky top-0 z-50 bg-[#1a1a1a]/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95">
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
                <h1 className="text-xl font-bold">Verify Phone</h1>
            </header>

            <div className="flex flex-col min-h-screen px-6 pt-8 pb-8">

                <div className="flex-1 flex flex-col items-center">
                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-8 border border-zinc-800">
                        <Phone className="w-8 h-8 text-[#ff4d6d]" />
                    </div>

                    <div className="text-center mb-10">
                        <p className="text-zinc-400 text-sm mb-1">We've sent a verification code to</p>
                        <p className="text-white font-bold text-lg">+91 {phoneNumber}</p>
                    </div>

                    <div className="mb-8">
                        <InputOTP maxLength={6} value={otp} onChange={(value) => { setOtp(value); setError(""); }}>
                            <InputOTPGroup className="gap-2">
                                <InputOTPSlot index={0} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-sm rounded-lg" />
                                <InputOTPSlot index={1} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-sm rounded-lg" />
                                <InputOTPSlot index={2} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-sm rounded-lg" />
                                <InputOTPSlot index={3} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-sm rounded-lg" />
                                <InputOTPSlot index={4} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-sm rounded-lg" />
                                <InputOTPSlot index={5} className="w-12 h-14 border-zinc-700 bg-zinc-900 text-sm rounded-lg" />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>

                    {error && <p className="text-red-500 text-sm mb-6 font-medium text-center">{error}</p>}

                    <div className="space-y-4 w-full">
                        <Button onClick={handleVerify} disabled={otp.length !== 6 || isLoading} className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#ff4d6d]/30 disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Continue"}
                        </Button>

                        <button
                            onClick={handleResend}
                            disabled={resendTimer > 0 || isLoading}
                            className="w-full py-2 text-zinc-500 text-sm font-medium disabled:opacity-50"
                        >
                            {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
                        </button>
                    </div>
                </div>
            </div>
        </MobileShell>
    );
}
