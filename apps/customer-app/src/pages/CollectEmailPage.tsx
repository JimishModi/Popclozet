import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@popclozet/api-client";
import { useAuth } from "@/context/SupabaseAuthContext";

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

export default function CollectEmailPage() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Requirement 7: Route guard
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                navigate("/auth/login");
            } else {
                checkAndRoute(user, navigate);
            }
        }
    }, [user, authLoading, navigate]);

    const handleSubmit = async () => {
        if (!email || !email.includes("@")) {
            setError("Please enter a valid email address.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`
                }
            });
            if (error) throw error;
            navigate("/auth/verify-collected-email", { state: { email } });
        } catch (err: any) {
            setError(err.message || "Failed to send magic link. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
            <div className="flex flex-col min-h-screen px-6 py-12">
                <div className="mb-12">
                    <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                        <Mail className="w-8 h-8 text-[#ff4d6d]" />
                    </div>
                    <h1 className="text-3xl font-bold mb-3">Add Email Address</h1>
                    <p className="text-zinc-400">Please provide your email address for order receipts and account recovery.</p>
                </div>

                <div className="space-y-6">
                    <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5 flex items-center gap-3">
                        <Mail className="w-5 h-5 text-zinc-500" />
                        <input
                            type="email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm px-1 font-medium">{error}</p>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !email}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#ff4d6d]/30"
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
