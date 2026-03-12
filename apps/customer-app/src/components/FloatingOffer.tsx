// src/components/FloatingOffer.tsx
import { motion } from "framer-motion";
import { Gift } from "lucide-react";

const FloatingOffer = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="fixed top-[82px] md:top-[86px] left-0 right-0 z-30 pointer-events-none"
        >
            <div className="container-custom flex justify-center">
                <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="pointer-events-auto inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 text-white rounded-full shadow-2xl hover:shadow-yellow-500/50 transition-all cursor-pointer"
                >
                    <Gift className="w-5 h-5 animate-bounce" />
                    <span className="font-bold text-sm md:text-base uppercase tracking-wide">
                        Join now for a FREE outfit! 🎉
                    </span>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default FloatingOffer;
