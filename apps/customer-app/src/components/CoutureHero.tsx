// src/components/CoutureHero.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import heroImg from "@/images/formal/formal.jpg";

const CoutureHero = () => {
    return (
        <section className="min-h-screen bg-[#F9F8F6] border-b border-black pt-20 overflow-hidden relative">

            {/* Background radial gradient for subtle depth */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-4 h-full flex flex-col lg:flex-row">

                {/* Left Content */}
                <div className="lg:w-3/5 flex flex-col justify-center py-12 lg:py-20 relative z-10 pl-4 md:pl-8 lg:pl-12">

                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 border border-pink-500 px-4 py-1.5 rounded-full bg-pink-50 w-fit mb-8 shadow-sm"
                    >
                        <Star className="w-3 h-3 fill-pink-500 text-pink-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-pink-600">Now in Beta — Join Early Testers</span>
                    </motion.div>

                    {/* Main Title */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-7xl lg:text-8xl font-playfair text-black leading-tight tracking-tight mb-6"
                    >
                        New Outfit Everyday! <br />
                        <span className="text-5xl md:text-6xl lg:text-7xl text-purple-600 block mt-2">Delivered in 60 Minutes!</span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg md:text-xl font-medium max-w-2xl mb-12 leading-relaxed text-gray-700"
                    >
                        Why own it when you can rent it? Get the perfect outfit for dates, parties, and trips from your endless closet—on demand, no commitment necessary.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-5"
                    >
                        <Button
                            size="lg"
                            className="bg-black text-white hover:bg-zinc-800 rounded-none h-14 px-10 text-base uppercase font-bold tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(192,132,252,1)] hover:translate-x-1 hover:shadow-none"
                        >
                            Start Renting
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-2 border-black bg-transparent text-black hover:bg-purple-50 rounded-none h-14 px-10 text-base uppercase font-bold tracking-widest transition-all"
                        >
                            Get Started <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </motion.div>

                    {/* Social Proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-16 flex items-center gap-6"
                    >
                        <div className="flex -space-x-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="User" />
                                </div>
                            ))}
                            <div className="w-10 h-10 rounded-full border-2 border-white bg-black text-white flex items-center justify-center text-xs font-bold">
                                +2k
                            </div>
                        </div>
                        <p className="text-sm font-bold text-gray-600">Join 2,000+ fashion insiders</p>
                    </motion.div>
                </div>

                {/* Right Image Area */}
                <div className="lg:w-2/5 relative h-[50vh] lg:h-auto border-t lg:border-t-0 lg:border-l border-black overflow-hidden group">
                    <div className="absolute inset-0 bg-purple-900/10 mix-blend-multiply z-10 pointer-events-none" />
                    <motion.img
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 1.5 }}
                        src={heroImg}
                        alt="Model"
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                </div>
            </div>
        </section>
    );
};

export default CoutureHero;
