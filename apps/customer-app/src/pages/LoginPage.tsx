import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import logoImage from "@/logo/logo.png";
import { useAuth } from "@/context/SupabaseAuthContext";
import { Loader2 } from "lucide-react";

// Generate the grid of small rounded-rect tiles for background
function BackgroundGrid() {
    const cols = 7;
    const rows = 10;
    const tiles = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            tiles.push(
                <div
                    key={`${r}-${c}`}
                    style={{
                        width: '100%',
                        aspectRatio: '1 / 1.2',
                        borderRadius: '10px',
                        background: '#2a2a2a',
                        border: '1px solid rgba(255,77,109,0.12)',
                    }}
                />
            );
        }
    }
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: '6px',
                padding: '8px',
                width: '100%',
                height: '100%',
            }}
        >
            {tiles}
        </div>
    );
}

export default function LoginPage() {
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signInWithGoogle, signInWithPhoneNumber } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const handlePhoneLogin = useCallback(async () => {
        if (phoneNumber.length < 10) {
            setError("Please enter a valid 10-digit phone number.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const formattedNumber = `+91${phoneNumber}`;
            await signInWithPhoneNumber(formattedNumber);
            navigate("/auth/otp", { state: { phone: phoneNumber } });
        } catch (err: unknown) {
            const error = err as { message?: string };
            setError(error.message || "Failed to send OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [phoneNumber, signInWithPhoneNumber, navigate]);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
            navigate("/auth/create-account");
        } catch (error) {
            console.error("Login failed", error);
            setError("Google sign-in failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <MobileShell className="bg-[#1a1a1a] text-white">
            <div className="flex flex-col min-h-screen">
                {/* Top: Logo over subtle tile grid */}
                <div className="relative flex-1 overflow-hidden">
                    {/* Logo floating above grid */}
                    <div className="absolute inset-0 flex items-start justify-center pt-6 z-20">
                        <img src={logoImage} alt="PopClozet" className="h-8" />
                    </div>

                    {/* Background grid of small rounded tiles */}
                    <div className="absolute inset-0 z-10 overflow-hidden opacity-70">
                        <BackgroundGrid />
                    </div>

                    {/* Gradient fade to bottom form area */}
                    <div
                        className="absolute inset-x-0 bottom-0 h-40 pointer-events-none z-10"
                        style={{ background: 'linear-gradient(0deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)' }}
                    />
                </div>

                {/* Login Form */}
                <div className="relative z-30 px-6 pb-8 bg-[#1a1a1a]">
                    {/* Phone Input */}
                    <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5 flex items-center gap-3 mb-4">
                        <span className="text-zinc-400 text-sm font-medium">+91</span>
                        <div className="w-px h-5 bg-zinc-700" />
                        <input
                            type="tel"
                            placeholder="Mobile Number"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm mb-3 text-center font-medium">{error}</p>
                    )}

                    {/* Login OTP */}
                    <button
                        onClick={handlePhoneLogin}
                        disabled={phoneNumber.length < 10 || isLoading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#ff4d6d]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Sending OTP...
                            </>
                        ) : (
                            "Login using OTP"
                        )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-zinc-500 text-xs font-medium">OR</span>
                        <div className="flex-1 h-px bg-zinc-800" />
                    </div>

                    {/* Google Sign In – white button like Figma */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full py-4 rounded-2xl bg-white text-gray-800 font-medium text-sm flex items-center justify-center gap-3 hover:bg-gray-100 transition-all disabled:opacity-50"
                    >
                        <span>Sign with Google</span>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 16.42 6.5L19.9 3A12 12 0 0 0 2.03 7.43l3.24 2.33z" />
                            <path fill="#34A853" d="M16.04 18.01A7.08 7.08 0 0 1 5.27 14.24l-3.24 2.33A12 12 0 0 0 19.13 21l-3.09-2.99z" />
                            <path fill="#4A90E2" d="M19.13 21C21.16 19.1 22.5 16.1 22.5 12c0-.82-.08-1.61-.24-2.36H12v4.79h5.9c-.25 1.24-.96 2.3-2.02 3.02l3.25 3.55z" />
                            <path fill="#FBBC05" d="M5.27 14.24a7.12 7.12 0 0 1 0-4.48L2.03 7.43a12 12 0 0 0 0 9.14l3.24-2.33z" />
                        </svg>
                    </button>

                    {/* Terms */}
                    <p className="text-center text-xs text-zinc-500 mt-6">
                        By Signing in you are accepting the{" "}
                        <button className="text-white font-medium underline">
                            Terms and Conditions
                        </button>
                    </p>
                </div>
            </div>
        </MobileShell>
    );
}
