// src/components/CoutureMoodBoard.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Moodboard Images
import moodPower from "@/moodboards/casuals.jpg";
import moodArt from "@/moodboards/party.jpg";
import moodParty from "@/moodboards/cocktail.jpg";

// Product/Detail Images (using varied sources for demo)
import prod1 from "@/images/casual/casual.jpg";
import prod2 from "@/images/party/party.jpg";
import prod3 from "@/images/formal/formal.jpg";

interface CoutureMoodBoardProps {
    onRentClick?: () => void;
}

export default function CoutureMoodBoard({ onRentClick }: CoutureMoodBoardProps) {
    const [activeTab, setActiveTab] = useState(0);

    const moods = [
        {
            title: "The Power Lunch",
            subtitle: "Corporate Chic",
            description: "Command the room in sharp tailoring and structured silhouettes. For when you mean business.",
            image: moodPower,
            color: "bg-emerald-900/10",
            items: [
                { name: "Structured Blazer", price: 185, img: prod1 },
                { name: "Silk Bow Blouse", price: 120, img: prod2 },
                { name: "Leather Tote", price: 145, img: prod3 },
            ]
        },
        {
            title: "Gallery Opening",
            subtitle: "Avant Garde",
            description: "Sculptural pieces that double as art. Stand out in the sea of black dresses.",
            image: moodArt,
            color: "bg-purple-900/10",
            items: [
                { name: "Sculptural Dress", price: 210, img: prod2 },
                { name: "Gold Statement Ear", price: 65, img: prod3 },
                { name: "Architectural Heel", price: 95, img: prod1 },
            ]
        },
        {
            title: "Rooftop Cocktails",
            subtitle: "High Glamour",
            description: "Catch the city lights in sequins and satin. The night is yours.",
            image: moodParty,
            color: "bg-rose-900/10",
            items: [
                { name: "Sequin Gown", price: 250, img: prod3 },
                { name: "Metallic Sandals", price: 85, img: prod1 },
                { name: "Crystal Clutch", price: 110, img: prod2 },
            ]
        }
    ];

    return (
        <section className="py-12 bg-[#F9F8F6] text-black">
            {/* Tab Navigation */}
            <div className="container mx-auto px-4 mb-12 flex flex-wrap justify-center gap-4 md:gap-8">
                {moods.map((mood, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveTab(index)}
                        className={`text-lg md:text-xl font-serif tracking-wide pb-2 border-b-2 transition-all duration-300 ${activeTab === index
                                ? "border-black text-black"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        {mood.title}
                    </button>
                ))}
            </div>

            <div className="border-y border-black">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="grid grid-cols-1 lg:grid-cols-2 min-h-[700px]"
                    >
                        {/* Left Side: Scrapbook Collage */}
                        <div className="relative border-b lg:border-b-0 lg:border-r border-black overflow-hidden group bg-[#F0EEE6]">
                            {/* Background Tint */}
                            <div className={`absolute inset-0 ${moods[activeTab].color} mix-blend-multiply z-10 pointer-events-none`} />

                            {/* Main Image with Paper/Tape Effect */}
                            <div className="absolute inset-8 md:inset-16 rotate-1 hover:rotate-0 transition-transform duration-700 ease-out bg-white p-2 shadow-xl">
                                <img
                                    src={moods[activeTab].image}
                                    alt={moods[activeTab].title}
                                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                                />
                            </div>

                            {/* Text Overlay Box */}
                            <div className="absolute bottom-12 left-8 md:left-12 z-30 max-w-sm">
                                <div className="bg-white/90 backdrop-blur-md border border-black p-6 md:p-8 shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="inline-block w-8 h-[1px] bg-black"></span>
                                        <span className="text-xs font-bold uppercase tracking-widest">Iconic</span>
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-playfair mb-4 leading-[0.9] italic">
                                        {moods[activeTab].title}
                                    </h2>
                                    <p className="text-sm leading-relaxed mb-6 font-medium text-gray-600">
                                        {moods[activeTab].description}
                                    </p>
                                    <Button
                                        onClick={onRentClick}
                                        className="bg-black text-white rounded-none uppercase text-xs font-bold tracking-widest px-8 py-6 hover:bg-zinc-800 transition-colors"
                                    >
                                        Shop The Vibe
                                    </Button>
                                </div>
                            </div>

                            {/* Decorative elements */}
                            <div className="absolute top-10 right-10 z-20 mix-blend-multiply opacity-50 font-serif text-8xl text-black/5 pointer-events-none">
                                {activeTab + 1}
                            </div>
                        </div>

                        {/* Right Side: Product Grid */}
                        <div className="bg-white p-8 md:p-16 flex flex-col justify-center">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                                {/* Intro Text Block */}
                                <div className="flex flex-col justify-center">
                                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{moods[activeTab].subtitle}</span>
                                    <h3 className="text-3xl font-playfair mb-6">Curated Essentials</h3>
                                    <p className="text-gray-600 mb-8 leading-relaxed">
                                        Every piece is chosen to create a cohesive look that tells a story. Mix, match, and make it your own.
                                    </p>
                                    <div className="hidden md:block">
                                        <a href="#" className="inline-flex items-center text-sm font-bold uppercase tracking-widest border-b border-black pb-1 hover:text-gray-600 transition-colors">
                                            View Full Collection <ArrowRight className="ml-2 w-4 h-4" />
                                        </a>
                                    </div>
                                </div>

                                {/* Product Items */}
                                {moods[activeTab].items.map((item, j) => (
                                    <div key={j} className="group cursor-pointer">
                                        <div className="aspect-[3/4] bg-gray-50 border border-black/10 mb-4 overflow-hidden relative">
                                            <img
                                                src={item.img}
                                                alt={item.name}
                                                className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                                <div className="bg-white rounded-full p-3 opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all border border-black shadow-lg">
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-serif text-lg leading-tight group-hover:underline decoration-1 underline-offset-4">{item.name}</h4>
                                                <p className="text-sm text-gray-500 mt-1">${item.price} Rental</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </section>
    );
}
