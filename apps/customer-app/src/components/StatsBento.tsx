import { motion } from "framer-motion";
import { Sparkles, Users, Clock, Leaf, Star, ShoppingBag } from "lucide-react";

const StatsBento = () => {
    return (
        <section className="py-16 md:py-24 bg-background">
            <div className="container-custom">
                {/* Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-3xl md:text-4xl font-playfair font-bold mb-3">
                        Why Choose <span className="text-gradient-brand">PopClozet</span>
                    </h2>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                        Join thousands who've discovered a smarter way to dress
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
                    {/* Large Card - Users */}
                    <motion.div
                        className="col-span-2 row-span-2 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-8 text-white relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                        <div className="absolute bottom-4 left-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="relative z-10">
                            <Users className="w-10 h-10 mb-4 opacity-80" />
                            <h3 className="text-5xl md:text-6xl font-bold mb-2">500+</h3>
                            <p className="text-xl font-medium opacity-90">Happy Customers</p>
                            <p className="text-sm opacity-70 mt-2">and counting...</p>
                        </div>
                    </motion.div>

                    {/* Small Card - Rating */}
                    <motion.div
                        className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                    >
                        <Star className="w-6 h-6 mb-2 opacity-80" />
                        <h3 className="text-3xl font-bold">4.9</h3>
                        <p className="text-sm opacity-90 font-medium">Rating</p>
                    </motion.div>

                    {/* Small Card - Items */}
                    <motion.div
                        className="rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        <ShoppingBag className="w-6 h-6 mb-2 opacity-80" />
                        <h3 className="text-3xl font-bold">1000+</h3>
                        <p className="text-sm opacity-90 font-medium">Items</p>
                    </motion.div>

                    {/* Medium Card - Delivery */}
                    <motion.div
                        className="col-span-2 rounded-3xl bg-gradient-to-br from-rose-400 to-pink-500 p-6 text-white relative overflow-hidden flex items-center gap-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="flex-shrink-0">
                            <Clock className="w-10 h-10 opacity-80" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold">60 min</h3>
                            <p className="text-sm opacity-90 font-medium">Delivery Promise</p>
                        </div>
                    </motion.div>

                    {/* Medium Card - Sustainability */}
                    <motion.div
                        className="col-span-2 rounded-3xl bg-gradient-to-br from-teal-400 to-cyan-500 p-6 text-white relative overflow-hidden flex items-center gap-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="flex-shrink-0">
                            <Leaf className="w-10 h-10 opacity-80" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold">5.2 kg</h3>
                            <p className="text-sm opacity-90 font-medium">CO₂ saved per rental</p>
                        </div>
                    </motion.div>

                    {/* Small Card - Free */}
                    <motion.div
                        className="rounded-3xl bg-gradient-to-br from-blue-400 to-indigo-500 p-6 text-white relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                    >
                        <Sparkles className="w-6 h-6 mb-2 opacity-80" />
                        <h3 className="text-2xl font-bold">Free</h3>
                        <p className="text-sm opacity-90 font-medium">Returns</p>
                    </motion.div>

                    {/* Small Card - Sizes */}
                    <motion.div
                        className="rounded-3xl bg-gradient-to-br from-fuchsia-400 to-pink-600 p-6 text-white relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.6 }}
                    >
                        <h3 className="text-2xl font-bold mb-1">XS-5XL</h3>
                        <p className="text-sm opacity-90 font-medium">All Sizes</p>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default StatsBento;
