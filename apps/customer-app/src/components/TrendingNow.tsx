import { motion } from "framer-motion";
import { Flame, Eye, Heart } from "lucide-react";
import { staggerContainer, staggerItem } from "@/utils/animations";
import { InstantAddButton } from "@/components/ui/instant-add-button";

interface TrendingItem {
    id: string;
    category: string;
    image: string;
    views: string;
    likes: string;
    trending: boolean;
}

const TrendingNow = () => {
    const trendingStories = [
        { id: "1", label: "Date Night", icon: "💝", color: "from-pink-500 to-rose-500" },
        { id: "2", label: "Wedding", icon: "💒", color: "from-purple-500 to-pink-500" },
        { id: "3", label: "Party", icon: "🎉", color: "from-blue-500 to-cyan-500" },
        { id: "4", label: "Office", icon: "💼", color: "from-gray-600 to-gray-800" },
        { id: "5", label: "Casual", icon: "👕", color: "from-green-500 to-emerald-500" },
    ];

    const trendingItems: TrendingItem[] = [
        {
            id: "1",
            category: "Most Rented This Week",
            image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=800&auto=format&fit=crop",
            views: "12.5K",
            likes: "2.3K",
            trending: true,
        },
        {
            id: "2",
            category: "#DateNightOutfit",
            image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=800&auto=format&fit=crop",
            views: "8.2K",
            likes: "1.8K",
            trending: true,
        },
        {
            id: "3",
            category: "#WeddingSeason",
            image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=800&auto=format&fit=crop",
            views: "15.7K",
            likes: "3.1K",
            trending: true,
        },
        {
            id: "4",
            category: "Celebrity Pick",
            image: "https://images.unsplash.com/photo-1617019114583-ca87326e3c44?q=80&w=800&auto=format&fit=crop",
            views: "20.1K",
            likes: "4.5K",
            trending: false,
        },
    ];

    return (
        <section className="py-20 md:py-28 bg-gradient-to-b from-background to-secondary/10 relative overflow-hidden">
            <div className="container-custom">
                {/* Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full mb-6">
                        <Flame className="w-5 h-5" />
                        <span className="font-bold">Trending Now</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                        <span className="text-gradient">What's Hot</span>
                        <span className="text-headline"> Right Now</span>
                    </h2>
                    <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                        Real-time trends from fashion lovers across Mumbai
                    </p>
                </motion.div>

                {/* Stories/Categories */}
                <motion.div
                    className="flex gap-4 overflow-x-auto pb-6 mb-12 scrollbar-hide"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                >
                    {trendingStories.map((story) => (
                        <motion.button
                            key={story.id}
                            className={`flex flex-col items-center gap-2 min-w-[100px] group`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${story.color} p-1 group-hover:shadow-glow transition-all duration-300`}>
                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
                                    {story.icon}
                                </div>
                            </div>
                            <span className="text-sm font-semibold">{story.label}</span>
                        </motion.button>
                    ))}
                </motion.div>

                {/* Trending Grid */}
                <motion.div
                    variants={staggerContainer}
                    initial="initial"
                    whileInView="animate"
                    viewport={{ once: true }}
                    className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    {trendingItems.map((item) => (
                        <motion.div
                            key={item.id}
                            variants={staggerItem}
                            className="product-card cursor-pointer group"
                        >
                            {/* Image */}
                            <div className="relative h-96 overflow-hidden">
                                <img
                                    src={item.image}
                                    alt={item.category}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    loading="lazy"
                                />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                                {/* Trending Badge */}
                                {item.trending && (
                                    <motion.div
                                        className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-glow"
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <Flame className="w-4 h-4" />
                                        <span className="text-xs font-bold">Trending</span>
                                    </motion.div>
                                )}

                                {/* Stats */}
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h3 className="text-white font-bold text-xl mb-3">{item.category}</h3>
                                    <div className="flex items-center justify-between gap-4 text-white/90">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-full backdrop-blur-md border-white/10">
                                                <Eye className="w-3.5 h-3.5" />
                                                <span className="text-xs font-semibold">{item.views}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-full backdrop-blur-md border-white/10">
                                                <Heart className="w-3.5 h-3.5" />
                                                <span className="text-xs font-semibold">{item.likes}</span>
                                            </div>
                                        </div>
                                        <InstantAddButton productId={item.id} imageSrc={item.image} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Hashtags */}
                <motion.div
                    className="mt-12 flex flex-wrap justify-center gap-3"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    {["#DateNightOutfit", "#WeddingSeason", "#PartyWear", "#CasualChic", "#WorkWear"].map((tag) => (
                        <motion.button
                            key={tag}
                            className="glass px-6 py-2 rounded-full font-semibold text-primary hover:glass-strong transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {tag}
                        </motion.button>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default TrendingNow;
