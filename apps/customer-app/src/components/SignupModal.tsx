// src/components/SignupModal.tsx
import { submitEmail, SignupResult } from "@/utils/emailSignup";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles, CheckCircle } from "lucide-react";
import EarlyAccessModalWrapper from "./EarlyAccessModalWrapper";

// Fashion image for the modal
import signupImage from "@/assets/download.jpg";

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignupModal: React.FC<SignupModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successRef = useRef<HTMLHeadingElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => firstInputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res: SignupResult = await submitEmail(email.trim().toLowerCase(), "modal");

      if (res.success === false) {
        const errMsg = typeof res.error === 'string'
          ? res.error
          : res.error?.message || "Signup failed. Please try again.";

        if (/duplicate|23505|already exists|unique/i.test(String(errMsg))) {
          setIsSubmitted(true);
        } else {
          setError(errMsg);
        }
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error("SignupModal error:", err);
      setIsSubmitting(false);
      setError("Something went wrong. Please try again.");
    }
  };

  const handleClose = () => {
    setIsSubmitted(false);
    setIsSubmitting(false);
    setEmail("");
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <EarlyAccessModalWrapper onClose={handleClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative overflow-hidden shadow-2xl w-[95vw] max-w-[950px] mx-4 flex flex-col lg:flex-row rounded-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* LEFT SIDE - Clean Full-Height Fashion Image */}
            <div className="hidden lg:block w-2/5 relative">
              <img
                src={signupImage}
                alt="Pop Look Fashion"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Subtle gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </div>

            {/* RIGHT SIDE - All Content on Crème Background */}
            <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center bg-[#F6F0E0] dark:bg-[#1A1A1A] min-h-[500px]">
              {!isSubmitted ? (
                <div className="max-w-sm w-full mx-auto">
                  {/* Eyebrow */}
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7CB342] dark:text-[#C0E2AD] mb-4">
                    The Fashion Revolution Is Here
                  </p>

                  {/* Main Headline */}
                  <h2 className="text-3xl lg:text-4xl font-playfair font-bold mb-4 text-black dark:text-[#FAFAFA] leading-tight">
                    Unlock Your Dream Closet.
                  </h2>

                  {/* The Hook - Large & Pink */}
                  <p className="text-xl lg:text-2xl font-playfair font-bold text-[#EB76C2] mb-6 leading-snug">
                    Sign Up & Get Your First Rental FREE.
                  </p>

                  {/* Supporting Copy */}
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                    Join our exclusive private beta. Be the first to rent, wear, and swap luxury styles with zero commitment.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Email Address
                      </label>
                      <input
                        ref={firstInputRef}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email for VIP access"
                        className="w-full px-4 py-3.5 text-sm bg-white dark:bg-[#333] border-2 border-[#E3BBE6] dark:border-[#7CB342] rounded-lg outline-none focus:border-[#EB76C2] dark:focus:border-[#C0E2AD] focus:ring-2 focus:ring-[#EB76C2]/20 dark:focus:ring-[#C0E2AD]/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-black dark:text-[#FAFAFA]"
                        disabled={isSubmitting}
                      />
                      {error && (
                        <p className="text-xs text-red-500 font-medium">{error}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group w-full py-4 bg-[#EB76C2] hover:bg-[#D85FAB] text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      {isSubmitting ? "Claiming..." : "Claim My Free Rental"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-[#C0E2AD] rounded-full flex items-center justify-center mb-5"
                  >
                    <CheckCircle className="w-8 h-8 text-black" />
                  </motion.div>

                  <h2 ref={successRef} tabIndex={-1} className="text-2xl lg:text-3xl font-playfair font-bold mb-3 text-black dark:text-[#FAFAFA]">
                    You're In!
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                    Check your inbox for your exclusive free rental code. Your dream wardrobe awaits!
                  </p>

                  <button
                    onClick={handleClose}
                    className="text-xs font-semibold uppercase tracking-widest text-[#EB76C2] hover:text-[#D85FAB] transition-all"
                  >
                    Continue Browsing →
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </EarlyAccessModalWrapper>
      )}
    </AnimatePresence>
  );
};

export default SignupModal;
