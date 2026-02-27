// src/components/AnnouncementTicker.tsx
import { motion } from "framer-motion";

const AnnouncementTicker = () => {
    const text = "JOIN NOW FOR A FREE OUTFIT";

    return (
        <div className="w-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-pink-500 text-white overflow-hidden fixed top-0 left-0 right-0 z-[60]">
            <div className="flex items-center h-10">
                {/* Scrolling ticker */}
                <motion.div
                    className="flex items-center gap-8 whitespace-nowrap"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{
                        x: {
                            repeat: Infinity,
                            repeatType: "loop",
                            duration: 25,
                            ease: "linear",
                        },
                    }}
                >
                    {/* Duplicate content for seamless loop */}
                    {Array(8).fill(text).map((item, i) => (
                        <div key={i} className="flex items-center gap-8">
                            <span className="font-bold text-sm tracking-wide uppercase">
                                {item}
                            </span>
                            <span className="text-white/70">•</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

export default AnnouncementTicker;
