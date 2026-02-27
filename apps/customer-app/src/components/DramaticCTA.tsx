// src/components/DramaticCTA.tsx
import { motion } from "framer-motion";
import { useState } from "react";
import SignupModal from "@/components/SignupModal";

const DramaticCTA = () => {
    const [isSignupOpen, setIsSignupOpen] = useState(false);

    return (
        <>
            <section
                className="bg-gradient-to-br from-primary via-secondary to-accent py-32 md:py-40 text-center px-4 relative overflow-hidden group cursor-pointer"
                onClick={() => setIsSignupOpen(true)}
            >
                {/* Radial glow on hover */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/30 to-transparent pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity duration-700" />

                {/* Decorative floating circles */}
                <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float" />
                <div
                    className="absolute bottom-10 right-20 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "-3s" }}
                />

                <motion.div
                    className="relative z-10 transform transition-transform duration-500 group-hover:scale-105"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    {/* Tagline */}
                    <p className="text-sm md:text-base font-bold uppercase tracking-[0.3em] mb-6 text-white/80">
                        Don't wait for the occasion
                    </p>

                    {/* Main headline */}
                    <h2 className="text-6xl md:text-8xl lg:text-[10rem] font-playfair font-bold mb-12 leading-[0.85] text-white">
                        Ready to
                        <br />
                        <span className="italic text-stroke-white text-transparent">
                            Pop?
                        </span>
                    </h2>

                    {/* CTA Button */}
                    <motion.button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSignupOpen(true);
                        }}
                        whileHover={{ scale: 1.05, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-white text-gray-900 text-lg md:text-xl font-bold uppercase tracking-widest px-12 md:px-16 py-6 md:py-8 rounded-full hover:bg-yellow-300 transition-all shadow-2xl hover:shadow-yellow-500/30"
                    >
                        Start Your Free Trial
                    </motion.button>
                </motion.div>
            </section>

            <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
        </>
    );
};

export default DramaticCTA;
