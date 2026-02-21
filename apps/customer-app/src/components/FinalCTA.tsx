// src/components/FinalCTA.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { submitEmail } from "../utils/emailSignup"; // relative import to utils

const FinalCTA: React.FC = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      // use shared helper which returns { success: true|false, data|error }
      const res = await submitEmail(trimmed, "cta");

      if (res.success === false) {
        // log full error for debugging
        console.error("CTA signup error (server):", res.error);

        // Safely extract error message with type guards
        let msg = "";
        if (res.error && typeof res.error === "object") {
          if ("message" in res.error && typeof res.error.message === "string") {
            msg = res.error.message;
          } else {
            msg = JSON.stringify(res.error);
          }
        } else if (typeof res.error === "string") {
          msg = res.error;
        }

        // Friendly handling for duplicate / unique constraint
        if (/duplicate|23505|unique/i.test(msg)) {
          toast.success("You're already on the list - thank you!");
        } else {
          toast.error("Oops! Something went wrong.", {
            description: msg.length ? msg : "Please try again later.",
          });
        }
        return;
      }

      // success
      toast.success("You're on the list! We'll be in touch soon.", {
        description: "Get ready for your endless closet experience.",
      });
      setEmail("");
    } catch (err: any) {
      // unexpected runtime error
      console.error("CTA signup unexpected error:", err);
      toast.error("Oops! Something went wrong.", {
        description: err?.message || "Please try again later.",
      });
    }
  };

  return (
    <section id="cta" className="py-20 md:py-32 px-4 bg-[#EB76C2] relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-10" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#E3BBE6]/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto max-w-4xl text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-8 md:space-y-10"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl">
              <Sparkles className="w-10 h-10 text-primary animate-pulse" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white px-4 leading-tight">
              Ready to Unlock Your <br className="hidden sm:block" />
              <span className="inline-block bg-white text-primary px-4 py-2 rounded-2xl mt-2">Endless Closet?</span>
            </h2>
            <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto px-4 leading-relaxed">
              Be the first to know when we launch and get <span className="font-bold text-white">50% off</span> your first rental. Don't miss out.
            </p>
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto px-4">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 min-h-[48px] h-14 md:h-16 text-base md:text-lg bg-white border-0 focus:ring-4 focus:ring-white/50 rounded-full px-6 font-medium shadow-lg text-slate-900 placeholder:text-slate-500"
                aria-label="Email address"
              />
              <Button
                type="submit"
                size="lg"
                className="min-h-[48px] h-14 md:h-16 px-8 md:px-12 bg-white hover:bg-white/90 text-primary font-bold text-base md:text-lg shadow-2xl transition-all hover:scale-105 rounded-full w-full sm:w-auto group"
              >
                Join the Early Bird List
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.form>

          {/* Join Text */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center text-white/80"
          >
            <span className="text-sm md:text-base font-medium">Join our growing community of fashion lovers</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
