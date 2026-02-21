import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Zap } from "lucide-react";
import { QuickCheckoutModal } from "./QuickCheckoutModal";

export const FloatingQuickAction = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <motion.button
                className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                whileHover={{ rotate: 15 }}
                onClick={() => setIsModalOpen(true)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: "spring" }}
            >
                <ShoppingBag className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-xs font-bold rounded-full flex items-center justify-center border-2 border-background">
                    3
                </span>
            </motion.button>

            <QuickCheckoutModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};
