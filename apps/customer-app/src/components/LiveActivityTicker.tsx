import { motion } from "framer-motion";
import { ShoppingBag, Eye, Zap } from "lucide-react";

const activities = [
    { type: "rent", text: "Sarah in Mumbai just rented the Emerald Silk Gown", time: "2m ago" },
    { type: "view", text: "12 people are viewing the Sequin Mini", time: "Live" },
    { type: "rent", text: "Priya in Delhi reserved the Dior Saddle Bag", time: "5m ago" },
    { type: "trend", text: "Trending: Velvet Blazers are booking fast for weekends", time: "Hot" },
    { type: "rent", text: "Ananya just unboxed the Gucci Belt", time: "1m ago" },
];

const LiveActivityTicker = () => {
    return (
        <div className="w-full bg-background/60 backdrop-blur-md border-b border-border/40 overflow-hidden py-2.5 z-40 relative">
            <div className="flex select-none">
                <motion.div
                    className="flex items-center gap-16 whitespace-nowrap"
                    animate={{ x: "-50%" }}
                    transition={{
                        repeat: Infinity,
                        duration: 30,
                        ease: "linear",
                    }}
                >
                    {[...activities, ...activities, ...activities, ...activities].map((activity, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                            <div className={`p-1 rounded-full ${activity.type === "rent" ? "bg-primary/10 text-primary" :
                                    activity.type === "view" ? "bg-blue-500/10 text-blue-500" :
                                        "bg-orange-500/10 text-orange-500"
                                }`}>
                                {activity.type === "rent" ? (
                                    <ShoppingBag className="w-3 h-3" />
                                ) : activity.type === "view" ? (
                                    <Eye className="w-3 h-3" />
                                ) : (
                                    <Zap className="w-3 h-3" />
                                )}
                            </div>
                            <span className="font-medium text-foreground/90">{activity.text}</span>
                            <span className="text-xs text-muted-foreground font-medium">• {activity.time}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

export default LiveActivityTicker;
