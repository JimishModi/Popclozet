import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LogOut, ArrowRight, ShoppingBag, Loader2, Sparkles } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/logo/logo.png";

const SignOutPage: React.FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [isSigningOut, setIsSigningOut] = useState(true);

    const hasRun = React.useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const performSignOut = async () => {
            try {
                // Debounce slightly for a more "premium" feel and to show the animation
                await new Promise(resolve => setTimeout(resolve, 1500));
                await signOut();
            } catch (error) {
                console.error("Sign out failed:", error);
            } finally {
                setIsSigningOut(false);
            }
        };
        performSignOut();
    }, []); // Empty dependency array to ensure it only runs once

    useEffect(() => {
        if (!isSigningOut) {
            const timer = setTimeout(() => {
                navigate("/auth/login");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isSigningOut, navigate]);

    return (
        <MobileShell className="bg-black text-white">
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
                <AnimatePresence mode="wait">
                    {isSigningOut ? (
                        <motion.div
                            key="signing-out"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="space-y-6"
                        >
                            <div className="relative w-24 h-24 mx-auto">
                                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 rounded-full border-t-2 border-[#f2546d]"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <LogOut className="w-10 h-10 text-white/20" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                                    Signing you out
                                </h1>
                                <p className="text-zinc-500 text-sm">Saving your closet session...</p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="signed-out"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="space-y-4">
                                <div className="relative mb-8">
                                    <div className="absolute -inset-4 bg-[#f2546d]/20 blur-2xl rounded-full" />
                                    <img src={logo} alt="Popclozet" className="h-10 w-auto mx-auto relative" />
                                </div>

                                <h2 className="text-3xl font-bold tracking-tight">Come back soon!</h2>
                                <div className="space-y-1">
                                    <p className="text-zinc-400 text-base max-w-[280px] mx-auto leading-relaxed">
                                        You have been successfully signed out.
                                    </p>
                                    <p className="text-[#f2546d] text-sm font-medium">Redirecting to login...</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-4">
                                <button
                                    onClick={() => navigate("/auth/login")}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#f2546d] text-white font-bold text-sm shadow-[0_10px_30px_rgba(242,84,109,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    Sign In Now
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="pt-8 flex items-center justify-center gap-2 text-zinc-600">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase tracking-[0.2em]">Popclozet Premium</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MobileShell>
    );
};

export default SignOutPage;
