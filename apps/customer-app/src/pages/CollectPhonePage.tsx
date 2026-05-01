import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { Phone, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/SupabaseAuthContext";
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

export default function CollectPhonePage() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Requirement 7: Redirect if user already has phone or is logged out correctly
    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/auth/login");
        }
    }, [user, authLoading, navigate]);

    const handleSubmit = async () => {
        if (phoneNumber.length < 10) {
            setError("Please enter a valid 10-digit phone number.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // Step 0: Check if phone already exists in customer_profiles
            const { data: existing, error: checkError } = await supabase
                .from("customer_profiles")
                .select("id")
                .or(`phone.eq.+91${phoneNumber},phone.eq.91${phoneNumber}`)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing && existing.id !== user?.id) {
                setError("This phone number is already linked to another account.");
                setIsLoading(false);
                return;
            }

            const nextPhone = phoneNumber.trim();
            const params = new URLSearchParams({
                phone: nextPhone,
                send: '1',
            });
            navigate(`/auth/otp?${params.toString()}`, { state: { phone: nextPhone } });
        } catch (err: any) {
            if (err.code === '23505') {
                setError("This phone number is already linked to another account.");
            } else {
                setError(err.message || "Failed to send OTP. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
            <div className="flex flex-col min-h-screen px-6 py-12">
                <div className="mb-12">
                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                        <Phone className="w-8 h-8 text-[#f2546d]" />
                    </div>
                    <h1 className="text-3xl font-bold mb-3">Add Phone Number</h1>
                    <p className="text-zinc-400">Please provide your phone number for account security and delivery updates.</p>
                </div>

                <div className="space-y-6">
                    <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5 flex items-center gap-3">
                        <span className="text-zinc-400 text-sm font-medium">+91</span>
                        <div className="w-px h-5 bg-zinc-700" />
                        <input
                            type="tel"
                            placeholder="Mobile Number"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                            autoFocus
                            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm px-1 font-medium">{error}</p>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || phoneNumber.length < 10}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#f2546d]/30"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <span>Send Verification Code</span>
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </MobileShell>
    );
}
