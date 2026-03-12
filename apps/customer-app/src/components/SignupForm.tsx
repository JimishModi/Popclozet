import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Mail, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SignupFormProps {
    onClose: () => void;
}

export function SignupForm({ onClose }: SignupFormProps) {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            // Simulate API call for email signup
            await new Promise(resolve => setTimeout(resolve, 1500));
            setIsSuccess(true);

            // Auto-close after success
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isValidEmail = email.includes('@') && email.includes('.');

    if (isSuccess) {
        return (
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-card rounded-2xl p-8 text-center border border-border shadow-2xl"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#C0E2AD] to-[#22C55E] flex items-center justify-center mb-6"
                >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-playfair font-bold mb-2">You're In!</h3>
                <p className="text-muted-foreground">We'll notify you about exclusive drops and early access.</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-2xl overflow-hidden border border-border shadow-2xl"
        >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-[#EB76C2] to-[#E3BBE6] p-6 text-white">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-medium uppercase tracking-wide">Exclusive Access</span>
                </div>
                <h2 className="text-2xl font-playfair font-bold">Join the Waitlist</h2>
                <p className="text-sm opacity-90 mt-1">Be first to rent luxury fashion</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="signup-email" className="sr-only">
                        Email address
                    </Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            id="signup-email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-12 bg-background"
                            required
                        />
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                <Button
                    type="submit"
                    disabled={!isValidEmail || isSubmitting}
                    className="w-full h-12 bg-gradient-to-r from-[#EB76C2] to-[#C0E2AD] text-white hover:opacity-90 font-medium"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Joining...
                        </>
                    ) : (
                        <>
                            Get Early Access
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                    By joining, you agree to our Terms & get style updates.
                </p>
            </form>

            {/* Benefits */}
            <div className="px-6 pb-6">
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-medium text-foreground/80">Why join?</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                            First access to new arrivals
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                            Exclusive member discounts
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                            Priority delivery slots
                        </li>
                    </ul>
                </div>
            </div>
        </motion.div>
    );
}
