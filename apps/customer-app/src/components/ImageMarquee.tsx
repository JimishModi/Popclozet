// src/components/ImageMarquee.tsx
import { motion } from "framer-motion";

// Import existing images from moodboards and category images
import casualMoodboard from "@/moodboards/casuals.jpg";
import partyMoodboard from "@/moodboards/party.jpg";
import cocktailMoodboard from "@/moodboards/cocktail.jpg";
import formalMoodboard from "@/moodboards/formal.jpg";
import streetwearMoodboard from "@/moodboards/streetwear.jpg";
import vacationMoodboard from "@/moodboards/vacation.jpg";

// Category images
import casualImg from "@/images/casual/casual.jpg";
import partyImg from "@/images/party/party.jpg";
import cocktailImg from "@/images/cocktail/cocktail.jpg";
import formalImg from "@/images/formal/formal.jpg";
import streetImg from "@/images/street/street.jpg";
import vacationImg from "@/images/vacation/vacation.jpg";

const topRowImages = [
    casualMoodboard,
    partyImg,
    formalMoodboard,
    cocktailImg,
    streetwearMoodboard,
    vacationImg,
];

const bottomRowImages = [
    vacationMoodboard,
    formalImg,
    partyMoodboard,
    streetImg,
    cocktailMoodboard,
    casualImg,
];

const ImageMarquee = () => {
    return (
        <section className="py-16 md:py-24 bg-background overflow-hidden relative">
            {/* Decorative background text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 decorative-text-overlay font-serif text-foreground">
                STYLE
            </div>

            {/* Section Header */}
            <motion.div
                className="text-center mb-12 relative z-10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
            >
                <span className="inline-block px-5 py-2 border border-border rounded-full bg-card shadow-sm mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Spotted On
                    </span>
                </span>
                <h2 className="text-4xl md:text-6xl font-playfair font-bold">
                    The Streets of <span className="italic text-secondary">Fashion</span>
                </h2>
            </motion.div>

            {/* Top Row - Left to Right */}
            <div className="flex whitespace-nowrap mb-6 overflow-hidden relative">
                <div className="flex animate-marquee gap-6 min-w-full">
                    {[...topRowImages, ...topRowImages].map((img, i) => (
                        <div
                            key={`top-${i}`}
                            className="w-[280px] md:w-[320px] h-[380px] md:h-[420px] flex-shrink-0 border border-border rounded-xl overflow-hidden group bg-card shadow-lg"
                        >
                            <img
                                src={img}
                                alt="Fashion"
                                className="w-full h-full object-cover grayscale-hover"
                            />
                        </div>
                    ))}
                </div>
                {/* Duplicate for seamless loop */}
                <div className="flex animate-marquee gap-6 min-w-full absolute top-0 left-full">
                    {[...topRowImages, ...topRowImages].map((img, i) => (
                        <div
                            key={`top-dup-${i}`}
                            className="w-[280px] md:w-[320px] h-[380px] md:h-[420px] flex-shrink-0 border border-border rounded-xl overflow-hidden group bg-card shadow-lg"
                        >
                            <img
                                src={img}
                                alt="Fashion"
                                className="w-full h-full object-cover grayscale-hover"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Row - Right to Left */}
            <div className="flex whitespace-nowrap overflow-hidden relative">
                <div className="flex animate-marquee-reverse gap-6 min-w-full translate-x-[-50%]">
                    {[...bottomRowImages, ...bottomRowImages].map((img, i) => (
                        <div
                            key={`bottom-${i}`}
                            className="w-[280px] md:w-[320px] h-[380px] md:h-[420px] flex-shrink-0 border border-border rounded-xl overflow-hidden group bg-card shadow-lg"
                        >
                            <img
                                src={img}
                                alt="Fashion"
                                className="w-full h-full object-cover grayscale-hover"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Gradient fade edges */}
            <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        </section>
    );
};

export default ImageMarquee;
