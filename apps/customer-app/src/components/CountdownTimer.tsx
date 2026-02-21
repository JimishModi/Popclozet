import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

export const CountdownTimer = () => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        // Set target to next hour or specific time
        const calculateTimeLeft = () => {
            const now = new Date();
            const target = new Date();
            target.setHours(18, 0, 0, 0); // 6 PM delivery cutoff

            if (now > target) {
                target.setDate(target.getDate() + 1);
            }

            const diff = target.getTime() - now.getTime();
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            return `${hours}h ${minutes}m`;
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    return (
        <motion.div
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-background/50 px-3 py-1 rounded-md border border-border/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <Timer className="w-4 h-4 text-accent" />
            <span>Order within <span className="text-foreground font-bold">{timeLeft}</span> for same-day delivery</span>
        </motion.div>
    );
};
