import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Heart, Star, Shirt } from "lucide-react";
import { Link } from "react-router-dom";

const BentoGrid = () => {
    return (
        <section className="pt-20 md:pt-24 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Gradient Mesh */}
                <div className="absolute inset-0 bg-gradient-mesh opacity-30" />

                {/* Floating Orbs */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-float" />
                <div className="absolute top-40 right-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
                <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "-4s" }} />
            </div>

            {/* Hero Section */}
            <div className="min-h-[85vh] flex items-center relative">
                <div className="container-custom py-16 md:py-24">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left Content */}
                        <div className="relative z-10">
                            {/* Main Headline */}
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="mb-6 leading-tight"
                            >
                                <span className="block text-headline">Rent Designer Fashion,</span>
                                <span className="block text-gradient">Every Occasion</span>
                            </motion.h1>

                            {/* Subheadline */}
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-xl"
                            >
                                Designer outfits for weddings, parties & special events.
                                No commitment, just pure style.
                            </motion.p>

                            {/* CTAs */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="flex flex-col sm:flex-row gap-4"
                            >
                                <Link
                                    to="/collections"
                                    className="btn-primary group relative overflow-hidden inline-flex items-center justify-center"
                                    aria-label="Browse fashion collections and start renting"
                                >
                                    <Sparkles className="inline-block mr-2 w-5 h-5" aria-hidden="true" />
                                    Start Browsing
                                    <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                </Link>
                                <Link
                                    to="/collections"
                                    className="btn-outline inline-flex items-center justify-center"
                                    aria-label="View all fashion collections"
                                >
                                    View Collections
                                </Link>
                            </motion.div>

                            {/* Trust Indicators */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="flex items-center gap-6 mt-10 pt-8 border-t border-border/50"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                        <Shirt className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">Designer Brands</p>
                                        <p className="text-xs text-muted-foreground">Curated collection</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                                        <Heart className="w-5 h-5 text-accent" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">Easy Returns</p>
                                        <p className="text-xs text-muted-foreground">Hassle-free process</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Right Side - Floating Product Cards */}
                        <div className="relative hidden lg:block h-[600px]">
                            {/* Main Card */}
                            <motion.div
                                className="absolute top-0 right-0 w-72 card-glass overflow-hidden"
                                initial={{ opacity: 0, x: 50, rotate: -5 }}
                                animate={{ opacity: 1, x: 0, rotate: -5 }}
                                transition={{ delay: 0.3 }}
                                whileHover={{ scale: 1.05, rotate: 0 }}
                            >
                                <img
                                    src="https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=800&auto=format&fit=crop"
                                    alt="Elegant black evening dress available for rent"
                                    className="w-full h-96 object-cover rounded-2xl"
                                />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="glass-strong px-4 py-3 rounded-xl">
                                        <p className="font-bold">Midnight Gala Gown</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                            <span className="text-sm font-medium">Top Pick</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Secondary Card */}
                            <motion.div
                                className="absolute bottom-0 left-0 w-64 card-glass overflow-hidden p-2"
                                initial={{ opacity: 0, x: -50, rotate: 5 }}
                                animate={{ opacity: 1, x: 0, rotate: 5 }}
                                transition={{ delay: 0.5 }}
                                whileHover={{ scale: 1.05, rotate: 0 }}
                            >
                                <img
                                    src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop"
                                    alt="Stylish formal blazer available for immediate rental"
                                    className="w-full h-80 object-cover rounded-xl"
                                />
                                <div className="absolute top-4 right-4">
                                    <div className="bg-accent text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1">
                                        <Sparkles className="w-4 h-4" />
                                        New Arrival
                                    </div>
                                </div>
                            </motion.div>

                            {/* Center Glow */}
                            <motion.div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-r from-primary via-secondary to-accent rounded-full opacity-50 blur-xl"
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 180, 360],
                                }}
                                transition={{
                                    duration: 10,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />

                            {/* Floating Category Pills */}
                            <motion.div
                                className="absolute top-1/3 left-0 glass-strong px-4 py-2 rounded-full"
                                initial={{ opacity: 0, x: -30 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <span className="text-sm font-semibold">👗 Party Wear</span>
                            </motion.div>

                            <motion.div
                                className="absolute bottom-1/3 right-0 glass-strong px-4 py-2 rounded-full"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.8 }}
                            >
                                <span className="text-sm font-semibold">💍 Wedding</span>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                <div className="glass-strong px-4 py-2 rounded-full text-sm font-semibold">
                    Scroll to explore ↓
                </div>
            </motion.div>
        </section>
    );
};

export default BentoGrid;
