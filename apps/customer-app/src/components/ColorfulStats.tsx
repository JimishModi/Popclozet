import { motion } from "framer-motion";
import { Sparkles, Shirt, Clock, Leaf } from "lucide-react";

const ColorfulStats = () => {
    return (
        <section className="py-16 md:py-24 bg-[#faf8f5]">
            <div className="container-custom">
                {/* Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-playfair font-bold mb-4">
                        Your Endless Closet, <span className="text-gradient-brand">Explained.</span>
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Everything you need to know about the new way to dress.
                    </p>
                </motion.div>

                {/* Bento Grid Features */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    {/* Card 1 - Pop Looks */}
                    <motion.div
                        className="rounded-3xl p-8 md:p-10 relative overflow-hidden flex flex-col justify-between min-h-[320px]"
                        style={{ backgroundColor: "#ffb4bd" }} // Soft Pink/Rose
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
                            <Sparkles className="w-7 h-7 text-rose-900" />
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-rose-950 mb-3">
                                Event-Ready 'Pop Looks'
                            </h3>
                            <p className="text-rose-900 leading-relaxed font-medium">
                                Got a date, party, or fest? Rent a complete, stylist-approved outfit with one tap. Your 'go-to' look for any event.
                            </p>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full" />
                    </motion.div>

                    {/* Card 2 - Mix & Match */}
                    <motion.div
                        className="rounded-3xl p-8 md:p-10 relative overflow-hidden flex flex-col justify-between min-h-[320px]"
                        style={{ backgroundColor: "#fcd34d" }} // Vibrant Amber/Yellow
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
                            <Shirt className="w-7 h-7 text-amber-900" />
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-amber-950 mb-3">
                                The 'Mix & Match' Closet
                            </h3>
                            <p className="text-amber-900 leading-relaxed font-medium">
                                Just need a new top? Browse thousands of individual pieces to complete the look you already have. Total creative freedom.
                            </p>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-tl-full" />
                    </motion.div>

                    {/* Card 3 - Rent It ASAP */}
                    <motion.div
                        className="rounded-3xl p-8 md:p-10 relative overflow-hidden flex flex-col justify-between min-h-[320px]"
                        style={{ backgroundColor: "#c4b5fd" }} // Soft Violet/Purple
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
                            <Clock className="w-7 h-7 text-violet-900" />
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-violet-950 mb-3">
                                Rent It ASAP
                            </h3>
                            <p className="text-violet-900 leading-relaxed font-medium mb-2">
                                Your plans are spontaneous, so we are too.
                            </p>
                            <p className="text-violet-950/80 text-sm font-bold bg-white/20 inline-block px-3 py-1 rounded-full">
                                ⚡ Arrives in 60 minutes
                            </p>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    </motion.div>

                    {/* Card 4 - Sustainable */}
                    <motion.div
                        className="rounded-3xl p-8 md:p-10 relative overflow-hidden flex flex-col justify-between min-h-[320px]"
                        style={{ backgroundColor: "#6ee7b7" }} // Vibrant Emerald/Mint
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
                            <Leaf className="w-7 h-7 text-emerald-900" />
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-emerald-950 mb-3">
                                Smart, Simple, Sustainable
                            </h3>
                            <p className="text-emerald-900 leading-relaxed font-medium">
                                Look amazing for <span className="font-bold underline decoration-2">10-15% of retail price</span>. When done, use the free return bag. We handle the dry cleaning.
                            </p>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-tr-full" />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default ColorfulStats;
