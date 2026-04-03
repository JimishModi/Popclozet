// src/pages/index.tsx
import { Suspense, lazy, useState, useEffect } from "react";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle, Gift } from "lucide-react";
import Navigation from "@/components/Navigation";
import popclozetManaca from "@/assets/popclozet-manaca-banner.png";
import QuickFilters from "@/components/QuickFilters";
import SignupModal from "@/components/SignupModal";
import AnnouncementTicker from "@/components/AnnouncementTicker";
import { submitEmail } from "@/utils/emailSignup";
import { clearReloadGuard, hasReloadGuard, setReloadGuard } from "@/lib/reloadGuard";

import heroParty from "@/assets/hero-party.png";
import heroBusiness from "@/assets/hero-business.png";
import heroVacation from "@/assets/hero-vacation.png";
import heroWedding from "@/assets/hero-wedding.png";
import { locationStorage } from "@/lib/locationStorage";

// Retry dynamic imports once with a page reload to handle stale chunk hashes after deploys
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType<unknown> }>) {
  return lazy(() =>
    importFn().catch((error) => {
      if (!hasReloadGuard("chunk_reload")) {
        setReloadGuard("chunk_reload");
        window.location.reload();
        return new Promise(() => {});
      }
      clearReloadGuard("chunk_reload");
      throw error;
    })
  );
}

const AIRecommendations = lazyWithRetry(() => import("@/components/AIRecommendations"));
const SustainabilityImpact = lazyWithRetry(() => import("@/components/SustainabilityImpact"));
const HowItWorks = lazyWithRetry(() => import("@/components/HowItWorks"));
const RentalReviews = lazyWithRetry(() => import("@/components/RentalReviews"));
const HassleReturn = lazyWithRetry(() => import("@/components/HassleReturn"));
const FAQ = lazyWithRetry(() => import("@/components/FAQ"));
const FounderNote = lazyWithRetry(() => import("@/components/FounderNote"));
const Footer = lazyWithRetry(() => import("@/components/Footer"));

const heroImages = [
  { src: heroParty, label: "Party" },
  { src: heroBusiness, label: "Business" },
  { src: heroVacation, label: "Vacation" },
  { src: heroWedding, label: "Wedding" },
];

const Index = () => {
  const [currentImage, setCurrentImage] = useState(0);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSubmitting, setHeroSubmitting] = useState(false);
  const [heroSuccess, setHeroSuccess] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState<'15min' | 'delayed' | null>(null);

  useEffect(() => {
    const stored = locationStorage.get();
    if (stored && (stored as any).delivery_estimate) {
      setDeliveryEstimate((stored as any).delivery_estimate);
    }
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeroError(null);

    if (!validateEmail(heroEmail)) {
      setHeroError("Please enter a valid email address.");
      return;
    }

    try {
      setHeroSubmitting(true);
      const res = await submitEmail(heroEmail.trim().toLowerCase(), "hero-lead-form");

      if (res.success === false) {
        const errMsg = typeof res.error === 'string'
          ? res.error
          : (res.error as any)?.message || "Something went wrong. Please try again.";

        if (/duplicate|23505|already exists|unique/i.test(String(errMsg))) {
          setHeroSuccess(true);
        } else {
          setHeroError(errMsg);
        }
        setHeroSubmitting(false);
        return;
      }

      setHeroSuccess(true);
      setHeroSubmitting(false);
    } catch (err) {
      console.error("Hero form error:", err);
      setHeroSubmitting(false);
      setHeroError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-white">
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent origin-left z-50"
        style={{ scaleX }}
        aria-hidden
      />

      <Navigation />
      <AnnouncementTicker />
      <QuickFilters />

      <main className="pt-[90px] md:pt-[100px]">
        {/* Hero Section - Lead Capture Form Design */}
        <section className="relative bg-[#F6F0E0] dark:bg-[#1A1A1A] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[92vh]">
            {/* LEFT SIDE - Lead Capture Content */}
            <div className="flex flex-col justify-center
                px-8 md:px-12 lg:px-16 xl:px-24
                pt-6 pb-10 lg:pt-8 lg:pb-14
                relative z-10">

              {/* Exclusive Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2
           bg-[#E3BBE6] rounded-full w-fit
           mt-4 md:mt-6
           mb-6"
              >
                <Gift className="w-4 h-4 text-black" />
                <span className="text-xs font-bold tracking-[0.15em] uppercase text-black">Limited Time Offer</span>
              </motion.div>

              {/* Main Headline */}
              {/* Main Headline */}
              {/* Main Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="relative text-3xl md:text-4xl lg:text-5xl
                          font-playfair font-black tracking-tight
                          leading-[1.08] mb-4"
              >
                <span
                  className="block bg-gradient-to-r
                            from-[#C084FC] via-[#7DD3FC] to-[#EB76C2]
                            bg-[length:300%_300%]
                            bg-clip-text text-transparent
                            animate-[gradient-shift_8s_ease-in-out_infinite]
                            drop-shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
                >
                  New Outfit Everyday!
                  <br />
                  {deliveryEstimate === 'delayed' 
                    ? "Expected Delayed Delivery!" 
                    : "Delivered in 60 Minutes!"}
                </span>
              </motion.h1>




              {/* Offer Highlight */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.9, ease: "easeOut" }}
                className="mb-4"
              >
                <motion.span
                  animate={{
                    textShadow: [
                      "0px 0px 0px rgba(235,118,194,0)",
                      "0px 0px 22px rgba(235,118,194,0.35)",
                      "0px 0px 0px rgba(235,118,194,0)",
                    ],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="block text-3xl md:text-4xl lg:text-5xl
                            font-playfair font-extrabold
                            tracking-tight leading-tight
                            text-[#EB76C2]"
                >
                  Signup Early to get your 1st Outfit Free!!
                </motion.span>
              </motion.div>



              {/* Value Proposition */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-lg md:text-xl text-black/70 dark:text-zinc-400 max-w-lg mb-8 leading-relaxed font-light"
              >
                Why own it when you can rent it? Get the perfect outfit for dates, parties, and trips from your endless closet—on demand, no commitment necessary.
              </motion.p>

              {/* Email Signup Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="w-full max-w-md"
              >
                {!heroSuccess ? (
                  <form onSubmit={handleHeroSubmit} className="space-y-4">
                    <div className="relative">
                      <input
                        type="email"
                        value={heroEmail}
                        onChange={(e) => setHeroEmail(e.target.value)}
                        placeholder="Enter your email"
                        disabled={heroSubmitting}
                        className="w-full px-6 py-5 text-lg bg-white dark:bg-[#282828] border-2 border-black/10 dark:border-[#FAFAFA]/10 rounded-xl outline-none focus:border-[#EB76C2] dark:focus:border-[#EB76C2] focus:ring-4 focus:ring-[#EB76C2]/20 transition-all placeholder:text-black/40 dark:placeholder:text-[#FAFAFA]/50 text-black dark:text-[#FAFAFA] shadow-lg"
                      />
                    </div>
                    {heroError && (
                      <p className="text-sm text-red-500 font-medium">{heroError}</p>
                    )}
                    <motion.button
                      type="submit"
                      disabled={heroSubmitting}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="group w-full py-5 bg-[#EB76C2] text-white font-bold text-base uppercase tracking-widest rounded-xl overflow-hidden shadow-xl hover:shadow-[#EB76C2]/40 transition-all flex items-center justify-center gap-3 relative"
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      <span className="relative z-10 flex items-center gap-2">
                        {heroSubmitting ? "Claiming..." : "Claim Your Free Rental"}
                        <Gift className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      </span>
                    </motion.button>
                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                      By clicking above, you agree to receive email updates and your exclusive discount code.
                    </p>
                  </form>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30"
                    >
                      <CheckCircle className="w-8 h-8 text-white" />
                    </motion.div>
                    <h3 className="text-2xl font-playfair font-bold text-foreground mb-2">You're In!</h3>
                    <p className="text-muted-foreground">
                      Check your inbox for your exclusive free rental code. Your dream wardrobe awaits!
                    </p>
                  </motion.div>
                )}
              </motion.div>

              {/* Beta Badge */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-10 inline-flex items-center gap-3 px-4 py-2.5 bg-[#C0E2AD] rounded-full"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black/30 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black"></span>
                </span>
                <span className="text-sm font-semibold text-black">
                  Now in Beta — Be an Early Tester
                </span>
              </motion.div>
            </div>

            {/* RIGHT SIDE - Rotating Image with Offer Badge */}
            <div className="relative min-h-[500px] lg:min-h-screen">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="absolute inset-0"
                >
                  <img
                    src={heroImages[currentImage].src}
                    alt={heroImages[currentImage].label}
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
                </motion.div>
              </AnimatePresence>

              {/* Free Outfit Badge - Bottom Right */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 }}
                className="absolute bottom-8 right-8 bg-gradient-to-br from-pink-500 to-purple-600 px-6 py-4 shadow-2xl rounded-xl"
              >
                <div className="text-2xl font-playfair font-bold text-white">FREE</div>
                <div className="text-xs font-bold uppercase tracking-widest text-white/80">First Outfit</div>
              </motion.div>

              {/* Occasion Label - Top Right */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute top-8 right-8 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                  {heroImages[currentImage].label} Ready
                </span>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Brand Banner Section */}
        <section className="relative w-full bg-[#F6F0E0] dark:bg-[#0E0E0E] overflow-hidden">
          <motion.a
            href="https://manaca.in/?srsltid=AfmBOoqp-4Vi7bT9t91h6BPPFNOv9N6Dkxe8N5tl25EeL2hTaiu-XhUZ"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            whileHover={{ scale: 1.02 }}
            className="relative block w-full group cursor-pointer"
          >
            <img
              src={popclozetManaca}
              alt="Popclozet x Manaca – Your Infinite Closet"
              className="
                w-full h-auto object-cover
                rounded-2xl
                shadow-2xl
                transition-all duration-500
                group-hover:shadow-black/40
              "
            />

            {/* Overlay decoration */}
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

            {/* CTA Badge */}
            <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md px-5 py-3 rounded-full shadow-xl">
              <span className="text-sm font-bold tracking-widest text-black uppercase">
                View Manaca →
              </span>
            </div>
          </motion.a>
        </section>


        <div id="how-it-works" className="scroll-mt-28" />

        {/* Brand Collaboration - Featured Partner */}

        <Suspense fallback={<div className="h-[60vh] sm:h-96 bg-secondary/5 animate-pulse" />}>
          <AIRecommendations />
        </Suspense>

        <Suspense fallback={<div className="h-[50vh] sm:h-96 bg-[#f5f0e8] animate-pulse" />}>
          <HowItWorks />
        </Suspense>

        <Suspense fallback={<div className="h-[80vh] sm:h-96 bg-secondary/5 animate-pulse" />}>
          <HassleReturn />
        </Suspense>

        <Suspense fallback={<div className="h-[50vh] sm:h-96 bg-transparent animate-pulse" />}>
          <RentalReviews />
        </Suspense>

        <Suspense fallback={<div className="h-[40vh] sm:h-96 bg-transparent animate-pulse" />}>
          <SustainabilityImpact />
        </Suspense>

        <Suspense fallback={<div className="h-[50vh] sm:h-96 bg-secondary/5 animate-pulse" />}>
          <FounderNote />
        </Suspense>

        <Suspense fallback={<div className="h-[40vh] sm:h-96 bg-transparent animate-pulse" />}>
          <FAQ />
        </Suspense>
      </main>

      <Suspense fallback={<div className="h-20 bg-black" />}>
        <Footer />
      </Suspense>

      <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
    </div>
  );
};

export default Index;
