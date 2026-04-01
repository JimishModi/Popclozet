import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logoImage from "@/logo/popclozet-logo.svg";

/**
 * Welcome Grid Page – 3-column masonry with scrolling animation
 * Left & right columns scroll DOWN, middle column scrolls UP
 */
export default function WelcomeGridPage() {
  const navigate = useNavigate();

  const handleContinue = () => navigate("/auth/login");
  const handleStartBrowsing = () => {
    localStorage.setItem("onboarding_completed", "true");
    navigate("/home");
  };

  // Each column has many tall rectangular tiles to enable infinite scroll effect
  const tileCount = 12;

  return (
    <div className="min-h-screen w-full max-w-[430px] mx-auto overflow-hidden relative flex flex-col bg-[#1a1a1a]">
      <div className="relative z-10 flex flex-col min-h-screen text-white">
        {/* WELCOME TO + Logo */}
        <div className="text-center pt-8 pb-3 relative z-20">
          <p
            className="text-white text-xl font-bold tracking-wide uppercase mb-1"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            WELCOME TO
          </p>
          <img src={logoImage} alt="Popclozet" className="h-9 mx-auto" />
        </div>

        {/* Animated Masonry Grid – 3 columns */}
        <div className="flex-1 relative overflow-hidden px-2">
          <div className="absolute inset-0 flex gap-2 px-2">
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
                    className="rounded-xl border border-[#f2546d]/50 bg-[#2a2a2a]"
                    style={{ height: i % 3 === 0 ? '160px' : i % 3 === 1 ? '200px' : '140px' }}
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
                    className="rounded-xl border border-[#f2546d]/50 bg-[#2a2a2a]"
                    style={{ height: i % 3 === 0 ? '200px' : i % 3 === 1 ? '140px' : '180px' }}
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
                    className="rounded-xl border border-[#f2546d]/50 bg-[#2a2a2a]"
                    style={{ height: i % 3 === 0 ? '140px' : i % 3 === 1 ? '180px' : '200px' }}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* Gradient overlays for smooth fade */}
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-10"
            style={{ background: 'linear-gradient(0deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)' }}
          />
        </div>

        {/* Continue + Start browsing */}
        <div className="relative z-20 px-6 pb-8 pt-2 bg-[#1a1a1a]">
          <button
            onClick={handleContinue}
            className="w-full h-12 rounded-full font-semibold text-lg text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
            style={{ backgroundColor: '#F2546D', fontFamily: 'DM Sans, sans-serif' }}
          >
            Continue
          </button>
          <button
            onClick={handleStartBrowsing}
            className="w-full py-3 text-[#B4B4B4] text-base font-medium hover:text-white transition-colors flex items-center justify-center gap-1"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Start browsing
            <span className="text-lg">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
