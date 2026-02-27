import { motion } from "framer-motion";
import { Star } from "lucide-react";

const REVIEWS = [
    {
        id: 1,
        name: "Sarah J.",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
        text: "Saved my date night! Delivered in 45 mins.",
        rating: 5
    },
    {
        id: 2,
        name: "Mike T.",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
        text: "The fit was perfect thanks to AI sizing.",
        rating: 5
    },
    {
        id: 3,
        name: "Emily R.",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
        text: "Love the sustainable packaging!",
        rating: 5
    },
    {
        id: 4,
        name: "Jessica L.",
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
        text: "Best rental service I've used.",
        rating: 4
    }
];

export const SocialProofStrip = () => {
    return (
        <div className="w-full overflow-hidden py-6 border-y border-border/40 bg-background/50 backdrop-blur-sm">
            <div className="container-custom">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 text-center">Trusted by 10,000+ Fashionistas</p>
                <div className="relative flex overflow-x-hidden group">
                    <motion.div
                        className="flex gap-8 animate-scroll hover:pause"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                        {[...REVIEWS, ...REVIEWS, ...REVIEWS].map((review, idx) => (
                            <div key={`${review.id}-${idx}`} className="flex items-center gap-3 min-w-[300px] bg-secondary/5 p-3 rounded-xl border border-border/50">
                                <img src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                                <div>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-sm font-bold text-foreground">{review.name}</span>
                                        <div className="flex">
                                            {[...Array(review.rating)].map((_, i) => (
                                                <Star key={i} className="w-3 h-3 fill-accent text-accent" />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{review.text}</p>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};
