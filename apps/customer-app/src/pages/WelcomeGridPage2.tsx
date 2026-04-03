import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logoImage from "@/logo/popclozet-logo.svg";
import heroBusiness from "@/assets/hero-business.png";
import heroParty from "@/assets/hero-party.png";
import heroVacation from "@/assets/hero-vacation.png";
import heroWedding from "@/assets/hero-wedding.png";
import storyChoice from "@/assets/story-choice.png";
import storyPanic from "@/assets/story-panic.png";
import storyPromise from "@/assets/story-promise.png";
import trendyOutfits from "@/assets/trendy-outfits.webp";

const brandPink = "#F2546D";
const TILE_IMAGES = [
    heroBusiness,
    heroParty,
    heroVacation,
    heroWedding,
    storyChoice,
    storyPanic,
    storyPromise,
    trendyOutfits,
];

/**
 * Welcome Grid Page 2 - Second onboarding screen
 * Different masonry grid layout, Continue → Login
 */
export default function WelcomeGridPage2() {
    const navigate = useNavigate();

    const handleContinue = () => navigate("/auth/login");
    const handleStartBrowsing = () => {
        localStorage.setItem("onboarding_completed", "true");
        navigate("/home");
    };

    // Different tile configuration for visual variety
    const tiles = [
        { height: 200, delay: 0 },
        { height: 160, delay: 0.05 },
        { height: 240, delay: 0.1 },
        { height: 220, delay: 0 },
        { height: 180, delay: 0.05 },
        { height: 200, delay: 0.1 },
        { height: 160, delay: 0.15 },
        { height: 240, delay: 0.2 },
        { height: 180, delay: 0.15 },
        { height: 220, delay: 0.2 },
        { height: 160, delay: 0.25 },
        { height: 200, delay: 0.25 },
    ];

    return (
        <div className="min-h-screen w-full max-w-[430px] mx-auto overflow-hidden relative flex flex-col bg-[#111]">
            {/* Background */}
            <div className="absolute inset-0 bg-[#111]" />

            <div className="relative z-10 flex flex-col items-center min-h-screen px-6 pt-12 pb-10 text-white">
                {/* WELCOME TO */}
                <div className="text-center mb-2">
                    <p className="text-white text-xl font-bold tracking-wide mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                        Welcome To
                    </p>
                </div>

                {/* Popclozet Logo */}
                <motion.div
                    className="flex items-center justify-center mb-10"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <img src={logoImage} alt="Popclozet" className="h-10 w-auto object-contain" />
                </motion.div>

                {/* Masonry Grid — different layout from Page 1 */}
                <div className="flex-1 w-full max-w-[380px] overflow-hidden relative mb-8">
                    <div className="grid grid-cols-3 gap-3 auto-rows-min">
                        {tiles.map((tile, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, delay: tile.delay }}
                                className="relative rounded-xl border-2 bg-[#2a2a2a] overflow-hidden"
                                style={{
                                    height: `${tile.height}px`,
                                    borderColor: brandPink,
                                    boxShadow: `0 0 20px ${brandPink}40`
                                }}
                            >
                                <img
                                    src={TILE_IMAGES[index % TILE_IMAGES.length]}
                                    alt=""
                                    className="w-full h-full object-cover opacity-70"
                                />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
                            </motion.div>
                        ))}
                    </div>

                    {/* Gradient overlay at bottom */}
                    <div
                        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                        style={{
                            background: 'linear-gradient(180deg, rgba(17, 17, 17, 0.00) 0%, #111 100%)'
                        }}
                    />
                </div>

                {/* Continue + Start browsing */}
                <div className="w-full max-w-[348px] mt-auto space-y-4">
                    <button
                        onClick={handleContinue}
                        className="w-full h-12 rounded-2xl font-semibold text-lg text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
                        style={{
                            backgroundColor: brandPink,
                            fontFamily: 'DM Sans, sans-serif',
                            letterSpacing: '-0.54px'
                        }}
                    >
                        Continue
                    </button>
                    <button
                        onClick={handleStartBrowsing}
                        className="w-full py-2 text-[#B4B4B4] text-lg font-semibold hover:text-white transition-colors flex items-center justify-center gap-2"
                        style={{
                            fontFamily: 'DM Sans, sans-serif',
                            letterSpacing: '-0.54px'
                        }}
                    >
                        Start browsing
                        <svg width="7" height="11" viewBox="0 0 7 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.99987e-08 0.686304C0.000207031 0.868786 0.0937613 1.04373 0.260095 1.17269L4.7952 4.69302C4.93247 4.79954 5.04136 4.92602 5.11565 5.06521C5.18994 5.20441 5.22818 5.3536 5.22818 5.50427C5.22818 5.65494 5.18994 5.80413 5.11565 5.94333C5.04136 6.08253 4.93247 6.209 4.7952 6.31553L0.266007 9.83356C0.10449 9.96337 0.0151166 10.1372 0.0171369 10.3177C0.0191572 10.4982 0.112409 10.6708 0.276808 10.7984C0.441207 10.926 0.663599 10.9984 0.896085 11C1.12857 11.0015 1.35255 10.9322 1.51978 10.8068L6.04898 7.29151C6.65797 6.81785 7 6.17599 7 5.50679C7 4.8376 6.65797 4.19574 6.04898 3.72208L1.51387 0.201753C1.39004 0.105569 1.23228 0.0400129 1.0605 0.0133567C0.888726 -0.0133004 0.710625 0.000136925 0.548675 0.051973C0.386725 0.103809 0.248184 0.191721 0.150535 0.304615C0.0528855 0.417508 0.000503862 0.550324 5.99987e-08 0.686304Z" fill="#B4B4B4" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
