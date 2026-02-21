import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "@/logo/logo.png";
import mockupBg from "@/logo/main mockup 2 1.png";

const brandPink = "#F2546D";
const tileCount = 12;
const TOTAL_SLIDES = 2;

/**
 * Landing page – 2-slide auto-transitioning onboarding.
 *  Slide 0: Mockup image background
 *  Slide 1: 3-column scrolling masonry grid
 * Auto-advances every 4 seconds. Each slide is a full page
 * (header + content + footer) so the entire view crossfades.
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);

  const handleContinue = useCallback(() => navigate("/auth/login"), [navigate]);
  const handleStartBrowsing = useCallback(() => {
    localStorage.setItem("onboarding_completed", "true");
    navigate("/home");
  }, [navigate]);

  // Auto-advance every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % TOTAL_SLIDES);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const sharedProps: SlideProps = {
    activeSlide,
    onDotClick: setActiveSlide,
    onContinue: handleContinue,
    onStartBrowsing: handleStartBrowsing,
  };

  return (
    <div className="min-h-screen w-full max-w-[430px] mx-auto overflow-hidden relative flex flex-col">
      <AnimatePresence mode="wait">
        {activeSlide === 0 ? (
          <MockupSlide key="mockup" {...sharedProps} />
        ) : (
          <WelcomeGridSlide key="grid" {...sharedProps} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Shared types ─── */
interface SlideProps {
  activeSlide: number;
  onDotClick: (idx: number) => void;
  onContinue: () => void;
  onStartBrowsing: () => void;
}

/* ─── Shared Header ─── */
function SlideHeader() {
  return (
    <div className="text-center mb-4">
      <p
        className="text-white text-2xl font-semibold tracking-tight mb-2"
        style={{ letterSpacing: "-0.72px" }}
      >
        WELCOME TO
      </p>
      <img src={logoImage} alt="PopClozet" className="h-10 mx-auto" />
    </div>
  );
}

/* ─── Shared Footer (dots + CTAs) ─── */
function SlideFooter({ activeSlide, onDotClick, onContinue, onStartBrowsing }: SlideProps) {
  return (
    <>
      {/* Pagination Dots */}
      <div className="flex items-center justify-center gap-2.5 mt-5 mb-6">
        {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => onDotClick(idx)}
            className={`rounded-full transition-all duration-300 ${activeSlide === idx
                ? "w-2.5 h-2.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                : "w-2 h-2 bg-zinc-600"
              }`}
          />
        ))}
      </div>

      {/* CTA Buttons */}
      <div className="w-full max-w-[348px] mx-auto space-y-4">
        <button
          onClick={onContinue}
          className="w-full h-12 rounded-2xl font-semibold text-lg text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
          style={{ backgroundColor: brandPink, letterSpacing: "-0.54px" }}
        >
          Continue
        </button>
        <button
          onClick={onStartBrowsing}
          className="w-full py-2 text-[#B4B4B4] text-lg font-semibold hover:text-white transition-colors flex items-center justify-center gap-2"
          style={{ letterSpacing: "-0.54px" }}
        >
          Start browsing
          <svg width="7" height="11" viewBox="0 0 7 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5.99987e-08 0.686304C0.000207031 0.868786 0.0937613 1.04373 0.260095 1.17269L4.7952 4.69302C4.93247 4.79954 5.04136 4.92602 5.11565 5.06521C5.18994 5.20441 5.22818 5.3536 5.22818 5.50427C5.22818 5.65494 5.18994 5.80413 5.11565 5.94333C5.04136 6.08253 4.93247 6.209 4.7952 6.31553L0.266007 9.83356C0.10449 9.96337 0.0151166 10.1372 0.0171369 10.3177C0.0191572 10.4982 0.112409 10.6708 0.276808 10.7984C0.441207 10.926 0.663599 10.9984 0.896085 11C1.12857 11.0015 1.35255 10.9322 1.51978 10.8068L6.04898 7.29151C6.65797 6.81785 7 6.17599 7 5.50679C7 4.8376 6.65797 4.19574 6.04898 3.72208L1.51387 0.201753C1.39004 0.105569 1.23228 0.0400129 1.0605 0.0133567C0.888726 -0.0133004 0.710625 0.000136925 0.548675 0.051973C0.386725 0.103809 0.248184 0.191721 0.150535 0.304615C0.0528855 0.417508 0.000503862 0.550324 5.99987e-08 0.686304Z"
              fill="#B4B4B4"
            />
          </svg>
        </button>
      </div>
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SLIDE 0 – Mockup Image Background
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function MockupSlide(props: SlideProps) {
  return (
    <motion.div
      className="min-h-screen flex flex-col relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={mockupBg} alt="" className="w-full h-full object-cover object-center" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-6 pt-12 pb-10 text-white">
        <SlideHeader />
        <div className="flex-1" />
        <SlideFooter {...props} />
      </div>
    </motion.div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SLIDE 1 – 3-Column Scrolling Welcome Grid
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function WelcomeGridSlide(props: SlideProps) {
  return (
    <motion.div
      className="min-h-screen flex flex-col bg-[#1a1a1a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col items-center min-h-screen px-6 pt-12 pb-10 text-white">
        <SlideHeader />

        {/* Masonry grid */}
        <div className="flex-1 w-full relative overflow-hidden">
          <div className="absolute inset-0 flex gap-2 px-0">
            {/* Column 1 – scrolls DOWN */}
            <div className="flex-1 overflow-hidden">
              <motion.div
                className="flex flex-col gap-2"
                animate={{ y: [0, -600] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                {[...Array(tileCount), ...Array(tileCount)].map((_, i) => (
                  <div
                    key={`c1-${i}`}
                    className="rounded-xl border border-[#ff4d6d]/50 bg-[#2a2a2a]"
                    style={{ height: i % 3 === 0 ? "160px" : i % 3 === 1 ? "200px" : "140px" }}
                  />
                ))}
              </motion.div>
            </div>

            {/* Column 2 – scrolls UP */}
            <div className="flex-1 overflow-hidden">
              <motion.div
                className="flex flex-col gap-2"
                initial={{ y: -600 }}
                animate={{ y: [-600, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              >
                {[...Array(tileCount), ...Array(tileCount)].map((_, i) => (
                  <div
                    key={`c2-${i}`}
                    className="rounded-xl border border-[#ff4d6d]/50 bg-[#2a2a2a]"
                    style={{ height: i % 3 === 0 ? "200px" : i % 3 === 1 ? "140px" : "180px" }}
                  />
                ))}
              </motion.div>
            </div>

            {/* Column 3 – scrolls DOWN */}
            <div className="flex-1 overflow-hidden">
              <motion.div
                className="flex flex-col gap-2"
                animate={{ y: [0, -550] }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              >
                {[...Array(tileCount), ...Array(tileCount)].map((_, i) => (
                  <div
                    key={`c3-${i}`}
                    className="rounded-xl border border-[#ff4d6d]/50 bg-[#2a2a2a]"
                    style={{ height: i % 3 === 0 ? "140px" : i % 3 === 1 ? "180px" : "200px" }}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* Gradient overlays */}
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none z-10"
            style={{ background: "linear-gradient(180deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-10"
            style={{ background: "linear-gradient(0deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)" }}
          />
        </div>

        <SlideFooter {...props} />
      </div>
    </motion.div>
  );
}
