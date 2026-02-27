import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Camera, Sparkles, ArrowLeftRight } from "lucide-react";
import { fadeInUp } from "@/utils/animations";

const VirtualTryOn = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showComparison, setShowComparison] = useState(false);

    const beforeImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400";
    const afterImage = "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400";

    return (
        <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/10 to-background relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "-2s" }} />
            </div>

            <div className="container-custom relative">
                <motion.div className="text-center mb-12" {...fadeInUp}>
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-2 rounded-full mb-6">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-bold">AR Technology</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                        <span className="text-gradient">Virtual Try-On</span>
                        <span className="text-headline"> Experience</span>
                    </h2>
                    <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
                        See how outfits look on you before renting
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-12 items-center">
                    {/* Upload Section */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <div className="card-glass p-8">
                            <h3 className="text-2xl font-bold mb-6">How It Works</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">Upload Your Photo</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Take or upload a clear front-facing photo
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">Choose an Outfit</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Browse our collection and select items
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">See the Magic</h4>
                                        <p className="text-sm text-muted-foreground">
                                            AI shows you how the outfit looks instantly
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Upload Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <motion.button
                                className="card-glass flex flex-col items-center justify-center p-8 hover:scale-105 transition-all"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Upload className="w-8 h-8 text-primary mb-3" />
                                <span className="font-semibold">Upload Photo</span>
                            </motion.button>
                            <motion.button
                                className="card-glass flex flex-col items-center justify-center p-8 hover:scale-105 transition-all"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Camera className="w-8 h-8 text-primary mb-3" />
                                <span className="font-semibold">Take Photo</span>
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* Preview Section */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="relative">
                            {/* Before/After Comparison */}
                            <div className="card-glass p-4 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-semibold">Preview</span>
                                    <motion.button
                                        className="flex items-center gap-2 text-primary font-semibold"
                                        onClick={() => setShowComparison(!showComparison)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <ArrowLeftRight className="w-4 h-4" />
                                        Compare
                                    </motion.button>
                                </div>

                                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                                    {showComparison ? (
                                        <div className="grid grid-cols-2 h-full gap-2">
                                            <div className="relative">
                                                <img
                                                    src={beforeImage}
                                                    alt="Before"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                                    Before
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <img
                                                    src={afterImage}
                                                    alt="After"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-2 right-2 bg-gradient-to-r from-primary to-secondary text-white px-3 py-1 rounded-full text-sm font-semibold">
                                                    With Outfit
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative h-full">
                                            <img
                                                src={beforeImage}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <motion.div
                                                    className="glass-strong px-6 py-4 rounded-full flex items-center gap-3"
                                                    animate={{ scale: [1, 1.05, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                >
                                                    <Sparkles className="w-5 h-5 text-primary" />
                                                    <span className="font-semibold">Upload to Preview</span>
                                                </motion.div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Size Guide */}
                                <div className="mt-4 p-4 bg-secondary rounded-xl">
                                    <h4 className="font-semibold mb-2">Perfect Fit Guarantee</h4>
                                    <p className="text-sm text-muted-foreground">
                                        95% of users found their recommended size to be accurate
                                    </p>
                                </div>
                            </div>

                            {/* Decorative Elements */}
                            <div className="absolute -top-8 -right-8 w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full blur-xl opacity-50 animate-pulse-glow" />
                            <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse-glow" style={{ animationDelay: "-1s" }} />
                        </div>
                    </motion.div>
                </div>

                {/* User Testimonial */}
                <motion.div
                    className="mt-12 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-4 glass-strong px-8 py-4 rounded-2xl">
                        <img
                            src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100"
                            alt="User"
                            className="w-12 h-12 rounded-full"
                        />
                        <div className="text-left">
                            <p className="font-semibold mb-1">"Game changer! Helped me find the perfect fit"</p>
                            <p className="text-sm text-muted-foreground">- Priya M., Mumbai</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default VirtualTryOn;
