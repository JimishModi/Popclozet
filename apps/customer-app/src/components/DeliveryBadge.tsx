import { motion } from "framer-motion";
import { Truck, Clock } from "lucide-react";

export const DeliveryBadge = () => {
    return (
        <motion.div
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 backdrop-blur-sm"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </div>
            <span className="text-sm font-semibold text-primary flex items-center gap-1">
                <Truck className="w-4 h-4" />
                Delivered in 60 minutes
            </span>
        </motion.div>
    );
};
