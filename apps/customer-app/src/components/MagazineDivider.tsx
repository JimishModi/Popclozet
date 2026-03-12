// src/components/MagazineDivider.tsx
import { motion } from "framer-motion";

interface MagazineDividerProps {
    badgeText?: string;
    heading: string;
    headingHighlight?: string;
    subText?: string;
    decorativeText?: string;
}

const MagazineDivider = ({
    badgeText = "Our Philosophy",
    heading = "Curated Moments",
    headingHighlight = "For Every Mood",
    subText = "We don't just rent clothes. We curate vibes.",
    decorativeText = "AESTHETIC",
}: MagazineDividerProps) => {
    return (
        <section className="py-24 md:py-32 text-center bg-gradient-to-b from-secondary/10 to-background relative overflow-hidden">
            {/* Decorative big text background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                <span className="decorative-text-overlay font-serif text-foreground">
                    {decorativeText}
                </span>
            </div>

            <motion.div
                className="relative z-10 container-custom"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                {/* Badge */}
                <span className="inline-block px-5 py-2 border border-border rounded-full bg-card shadow-md mb-8">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {badgeText}
                    </span>
                </span>

                {/* Main Heading */}
                <h2 className="text-5xl md:text-7xl lg:text-8xl font-playfair font-bold mb-8 leading-[0.95]">
                    {heading}
                    <br />
                    <span className="italic text-secondary">{headingHighlight}</span>
                </h2>

                {/* Subtext */}
                <p className="text-lg md:text-xl max-w-2xl mx-auto px-4 font-medium text-muted-foreground leading-relaxed">
                    {subText}
                </p>
            </motion.div>

            {/* Decorative gradients */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-secondary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
        </section>
    );
};

export default MagazineDivider;
