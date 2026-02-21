import { motion } from "framer-motion";
import { MapPin, Clock, Star } from "lucide-react";

interface RecentRental {
    id: string;
    customerName: string;
    item: string;
    avatar: string;
    location: string;
    rating: number;
}

const LiveActivity = () => {
    // Static recent rentals - realistic showcase
    const recentRentals: RecentRental[] = [
        {
            id: "1",
            customerName: "Priya S.",
            item: "Designer Lehenga",
            avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100",
            location: "Mumbai",
            rating: 5,
        },
        {
            id: "2",
            customerName: "Rahul K.",
            item: "Wedding Sherwani",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
            location: "Delhi",
            rating: 5,
        },
        {
            id: "3",
            customerName: "Ananya M.",
            item: "Party Gown",
            avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
            location: "Bangalore",
            rating: 4,
        },
    ];

    return (
        <section className="py-12 bg-gradient-to-r from-secondary/10 via-primary/10 to-accent/10 relative overflow-hidden">
            <div className="container-custom">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold">
                            Recent <span className="text-gradient">Rentals</span>
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 glass px-4 py-2 rounded-full">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-semibold">4.8 Average Rating</span>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    {recentRentals.map((rental, index) => (
                        <motion.div
                            key={rental.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="glass-strong rounded-2xl p-4 flex items-center gap-4"
                        >
                            <div className="relative">
                                <img
                                    src={rental.avatar}
                                    alt={`${rental.customerName} profile`}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white bg-green-500" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">
                                    {rental.customerName} rented {rental.item}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>{rental.location}</span>
                                    <span>•</span>
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: rental.rating }).map((_, i) => (
                                            <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default LiveActivity;
