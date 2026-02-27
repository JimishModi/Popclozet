import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Sparkles, Upload, Camera, Check, Loader2, Shirt, User } from "lucide-react";
import { fadeInUp, staggerContainer, staggerItem } from "@/utils/animations";

// Mock Data
const MODELS = [
    { id: "m1", name: "Priya", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop" },
    { id: "m2", name: "Rahul", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop" },
    { id: "m3", name: "Ananya", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop" },
    { id: "m4", name: "Arjun", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop" },
];

const OUTFITS = [
    { id: "o1", name: "Floral Summer Dress", category: "Casual", image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400" },
    { id: "o2", name: "Classic Black Suit", category: "Formal", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400" },
    { id: "o3", name: "Red Evening Gown", category: "Party", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400" },
    { id: "o4", name: "Denim Jacket Look", category: "Streetwear", image: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400" },
    { id: "o5", name: "Wedding Sherwani", category: "Traditional", image: "https://images.unsplash.com/photo-1583391733952-4c3102554433?w=400" },
    { id: "o6", name: "Boho Chic Top", category: "Casual", image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400" },
];

const VirtualTryOnPage = () => {
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [selectedOutfit, setSelectedOutfit] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    // Simulate generation process
    useEffect(() => {
        if (selectedModel && selectedOutfit) {
            setIsGenerating(true);
            setGeneratedImage(null);

            // Mock API call delay
            const timer = setTimeout(() => {
                setIsGenerating(false);
                // For mock purposes, we'll just use the outfit image or a placeholder combination
                // In a real app, this would be the result from the AI model
                setGeneratedImage(OUTFITS.find(o => o.id === selectedOutfit)?.image || null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [selectedModel, selectedOutfit]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
                setSelectedModel("uploaded");
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-white">
            <Navigation />

            <main className="pt-24 pb-20">
                <div className="container-custom">
                    {/* Header */}
                    <motion.div className="text-center mb-12" {...fadeInUp}>
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full mb-6">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-bold">AI Magic Studio</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold mb-4">
                            Virtual <span className="text-gradient">Try-On</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Experience fashion like never before. Mix and match styles on our AI models or upload your own photo.
                        </p>
                    </motion.div>

                    <div className="grid lg:grid-cols-12 gap-8">
                        {/* Left Sidebar - Controls */}
                        <div className="lg:col-span-4 space-y-8">

                            {/* Step 1: Choose Model */}
                            <motion.div
                                className="card-glass p-6"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">1</div>
                                    Choose a Model
                                </h3>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {MODELS.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                setSelectedModel(model.id);
                                                setUploadedImage(null);
                                            }}
                                            className={`relative rounded-xl overflow-hidden aspect-[3/4] group transition-all ${selectedModel === model.id ? "ring-4 ring-primary scale-95" : "hover:opacity-90"
                                                }`}
                                        >
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 text-center">
                                                {model.name}
                                            </div>
                                            {selectedModel === model.id && (
                                                <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-border"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">Or upload your own</span>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors ${selectedModel === "uploaded" ? "border-primary bg-primary/5" : "border-border"
                                        }`}>
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            {uploadedImage ? (
                                                <img src={uploadedImage} alt="Uploaded" className="h-20 w-20 object-cover rounded-full mb-2" />
                                            ) : (
                                                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                            )}
                                            <p className="text-sm text-muted-foreground">
                                                {uploadedImage ? "Click to change" : "Upload Photo"}
                                            </p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            </motion.div>

                            {/* Step 2: Choose Outfit */}
                            <motion.div
                                className="card-glass p-6"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center text-sm">2</div>
                                    Select Outfit
                                </h3>

                                <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {OUTFITS.map((outfit) => (
                                        <button
                                            key={outfit.id}
                                            onClick={() => setSelectedOutfit(outfit.id)}
                                            className={`relative rounded-xl overflow-hidden aspect-square group transition-all ${selectedOutfit === outfit.id ? "ring-4 ring-secondary scale-95" : "hover:opacity-90"
                                                }`}
                                        >
                                            <img src={outfit.image} alt={outfit.name} className="w-full h-full object-cover" />
                                            {selectedOutfit === outfit.id && (
                                                <div className="absolute top-1 right-1 bg-secondary text-white rounded-full p-0.5">
                                                    <Check className="w-2 h-2" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        </div>

                        {/* Right Side - Preview */}
                        <div className="lg:col-span-8">
                            <motion.div
                                className="h-full min-h-[600px] card-glass p-4 md:p-8 flex flex-col items-center justify-center relative overflow-hidden"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                {/* Background Effects */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
                                </div>

                                {/* Main Preview Area */}
                                <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden bg-secondary/20 shadow-2xl border border-white/20">
                                    <AnimatePresence mode="wait">
                                        {isGenerating ? (
                                            <motion.div
                                                key="generating"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md z-20"
                                            >
                                                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                                <p className="text-lg font-semibold animate-pulse">Weaving AI Magic...</p>
                                                <p className="text-sm text-muted-foreground">Fitting the outfit perfectly</p>
                                            </motion.div>
                                        ) : generatedImage && selectedModel ? (
                                            <motion.div
                                                key="result"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="relative w-full h-full"
                                            >
                                                {/* In a real app, this would be the composited image. 
                            For mock, we show the model with an overlay or just the outfit image creatively */}
                                                <img
                                                    src={selectedModel === "uploaded" ? uploadedImage! : MODELS.find(m => m.id === selectedModel)?.image}
                                                    alt="Model"
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                />
                                                {/* Overlaying the outfit image to simulate try-on (simple mock visualization) */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <img
                                                        src={generatedImage}
                                                        alt="Outfit"
                                                        className="w-3/4 h-auto object-contain drop-shadow-2xl"
                                                    />
                                                </div>

                                                <div className="absolute bottom-4 left-4 right-4 glass-strong p-4 rounded-xl">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-bold text-sm">AI Match Confidence</p>
                                                            <div className="flex items-center gap-1">
                                                                <div className="h-2 w-24 bg-secondary/30 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-green-500 w-[94%]" />
                                                                </div>
                                                                <span className="text-xs font-bold text-green-600">94%</span>
                                                            </div>
                                                        </div>
                                                        <button className="btn-primary px-4 py-2 text-xs">
                                                            Add to Cart
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="placeholder"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-8 text-center"
                                            >
                                                <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                                                    <Shirt className="w-10 h-10 opacity-50" />
                                                </div>
                                                <h3 className="text-xl font-bold mb-2">Ready to Try On?</h3>
                                                <p>Select a model and an outfit from the left to see the magic happen.</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Instructions */}
                                {!generatedImage && !isGenerating && (
                                    <div className="mt-8 flex gap-8 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4" /> Select Model
                                        </div>
                                        <div className="w-8 h-px bg-border" />
                                        <div className="flex items-center gap-2">
                                            <Shirt className="w-4 h-4" /> Pick Outfit
                                        </div>
                                        <div className="w-8 h-px bg-border" />
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" /> View Result
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default VirtualTryOnPage;
