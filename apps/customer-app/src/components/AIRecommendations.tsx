// src/components/AIRecommendations.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart, TrendingUp, Shirt, PartyPopper, Wine, Briefcase, Footprints, Palmtree, ChevronRight, ChevronDown, Star } from "lucide-react";
import { fadeInUp, staggerContainer, staggerItem } from "@/utils/animations";
import SignupModal from "@/components/SignupModal";

// Mood board imports
import casualMoodboard from "@/moodboards/casuals.jpg";
import partyMoodboard from "@/moodboards/party.jpg";
import cocktailMoodboard from "@/moodboards/cocktail.jpg";
import formalMoodboard from "@/moodboards/formal.jpg";
import streetwearMoodboard from "@/moodboards/streetwear.jpg";
import vacationMoodboard from "@/moodboards/vacation.jpg";

// Outfit images
import casualImg1 from "@/images/casual/casual.jpg";
import casualImg2 from "@/images/casual/casual1.jpg";
import casualImg3 from "@/images/casual/casual2.jpg";
import partyImg1 from "@/images/party/party.jpg";
import partyImg2 from "@/images/party/party1.jpg";
import partyImg3 from "@/images/party/party2.jpg";
import cocktailImg1 from "@/images/cocktail/cocktail.jpg";
import cocktailImg2 from "@/images/cocktail/cocktail2.jpg";
import cocktailImg3 from "@/images/cocktail/cocktail3.jpg";
import formalImg1 from "@/images/formal/formal.jpg";
import formalImg2 from "@/images/formal/formal2.jpg";
import formalImg3 from "@/images/formal/formal3.jpg";
import streetImg1 from "@/images/street/street.jpg";
import streetImg2 from "@/images/street/street1.jpg";
import streetImg3 from "@/images/street/street2.jpg";
import vacationImg1 from "@/images/vacation/vacation.jpg";
import vacationImg2 from "@/images/vacation/vacation1.jpg";
import vacationImg3 from "@/images/vacation/vacation2.jpg";

interface Recommendation {
    id: string;
    title: string;
    image: string;
    occasion: string;
    confidence: number;
    price: string;
    rentalPrice: string;
}

interface OccasionData {
    id: string;
    label: string;
    icon: React.ReactNode;
    moodboard: string;
}

const AIRecommendations = () => {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOccasion, setSelectedOccasion] = useState("casual");
    const [isSignupOpen, setIsSignupOpen] = useState(false);
    const [showMoodboard, setShowMoodboard] = useState(true);

    const occasions: OccasionData[] = [
        { id: "casual", label: "Casual", icon: <Shirt className="w-5 h-5" />, moodboard: casualMoodboard },
        { id: "party", label: "Party", icon: <PartyPopper className="w-5 h-5" />, moodboard: partyMoodboard },
        { id: "cocktail", label: "Cocktail", icon: <Wine className="w-5 h-5" />, moodboard: cocktailMoodboard },
        { id: "formal", label: "Formal", icon: <Briefcase className="w-5 h-5" />, moodboard: formalMoodboard },
        { id: "street", label: "Streetwear", icon: <Footprints className="w-5 h-5" />, moodboard: streetwearMoodboard },
        { id: "vacation", label: "Vacation", icon: <Palmtree className="w-5 h-5" />, moodboard: vacationMoodboard },
    ];

    const currentOccasion = occasions.find(o => o.id === selectedOccasion);

    // Mock recommendations with rental prices
    const mockRecommendations: Record<string, Recommendation[]> = {
        casual: [
            { id: "1", title: "Cozy Cardigan Set", image: casualImg1, occasion: "Weekend vibes", confidence: 93, price: "₹5,999", rentalPrice: "₹899" },
            { id: "2", title: "Wide Leg Jeans Look", image: casualImg2, occasion: "Effortlessly cool", confidence: 91, price: "₹4,999", rentalPrice: "₹749" },
            { id: "3", title: "Knit & Denim Combo", image: casualImg3, occasion: "Coffee date ready", confidence: 87, price: "₹4,299", rentalPrice: "₹649" },
        ],
        party: [
            { id: "4", title: "Leather & Lace", image: partyImg1, occasion: "Night out glam", confidence: 94, price: "₹8,999", rentalPrice: "₹1,299" },
            { id: "5", title: "Bold Mini Set", image: partyImg2, occasion: "Party queen", confidence: 90, price: "₹9,999", rentalPrice: "₹1,499" },
            { id: "6", title: "Edgy Chic Look", image: partyImg3, occasion: "Club ready", confidence: 88, price: "₹7,999", rentalPrice: "₹1,199" },
        ],
        cocktail: [
            { id: "7", title: "Burgundy Corset Dress", image: cocktailImg1, occasion: "Elegant evening", confidence: 96, price: "₹12,999", rentalPrice: "₹1,899" },
            { id: "8", title: "Satin Midi Elegance", image: cocktailImg2, occasion: "Sophisticated charm", confidence: 92, price: "₹11,499", rentalPrice: "₹1,699" },
            { id: "9", title: "Classic LBD", image: cocktailImg3, occasion: "Timeless beauty", confidence: 89, price: "₹9,999", rentalPrice: "₹1,499" },
        ],
        formal: [
            { id: "10", title: "Power Blazer Set", image: formalImg1, occasion: "Boardroom boss", confidence: 97, price: "₹14,999", rentalPrice: "₹2,199" },
            { id: "11", title: "Wide Leg Suit", image: formalImg2, occasion: "Professional chic", confidence: 94, price: "₹13,499", rentalPrice: "₹1,999" },
            { id: "12", title: "Executive Look", image: formalImg3, occasion: "Meeting ready", confidence: 90, price: "₹11,999", rentalPrice: "₹1,799" },
        ],
        street: [
            { id: "13", title: "Vintage Leather Set", image: streetImg1, occasion: "Urban explorer", confidence: 95, price: "₹7,499", rentalPrice: "₹1,099" },
            { id: "14", title: "Baggy Denim Look", image: streetImg2, occasion: "Street style", confidence: 91, price: "₹5,999", rentalPrice: "₹899" },
            { id: "15", title: "Retro Vibes", image: streetImg3, occasion: "90s comeback", confidence: 88, price: "₹5,299", rentalPrice: "₹799" },
        ],
        vacation: [
            { id: "16", title: "Beach Resort Look", image: vacationImg1, occasion: "Tropical vibes", confidence: 95, price: "₹7,999", rentalPrice: "₹1,199" },
            { id: "17", title: "Linen Set", image: vacationImg2, occasion: "Island hopping", confidence: 92, price: "₹6,699", rentalPrice: "₹999" },
            { id: "18", title: "Poolside Chic", image: vacationImg3, occasion: "Resort ready", confidence: 89, price: "₹7,299", rentalPrice: "₹1,099" },
        ],
    };

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            setRecommendations(mockRecommendations[selectedOccasion] || []);
            setLoading(false);
        }, 400);
    }, [selectedOccasion]);

    return (
        <>
            <section id="collections-section" className="py-20 md:py-28 bg-[#F6F0E0] dark:bg-[#1A1A1A] relative overflow-hidden">
                {/* Subtle background elements */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-[#C0E2AD]/10 dark:bg-[#99C08D]/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#E3BBE6]/10 dark:bg-[#302038]/30 rounded-full blur-3xl" />
                </div>

                <div className="container-custom relative">
                    {/* Header */}
                    <motion.div className="text-center mb-14" {...fadeInUp}>
                        <div className="inline-flex items-center gap-2 bg-[#C0E2AD] dark:bg-[#99C08D] text-black px-6 py-2.5 rounded-full mb-6">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-bold text-sm tracking-wide">Curated Style Collections</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-playfair font-bold mb-3 sm:mb-4 px-4 text-black dark:text-[#FAFAFA]">
                            <span>Outfits for Every </span>
                            <span className="text-[#EB76C2]">Occasion</span>
                        </h2>
                        <p className="text-black/60 dark:text-[#FAFAFA]/60 text-base sm:text-lg max-w-2xl mx-auto px-4">
                            Curated, Complete Looks. Effortless Style.
                        </p>
                    </motion.div>

                    {/* Occasion Selector - Minimalist Pill Tabs */}
                    <motion.div
                        className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 mb-8 md:mb-12 px-2"
                        variants={staggerContainer}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                    >
                        {occasions.map((occasion) => (
                            <motion.button
                                key={occasion.id}
                                variants={staggerItem}
                                onClick={() => setSelectedOccasion(occasion.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`group relative px-4 py-3 sm:px-5 sm:py-3 md:px-6 md:py-3.5 rounded-full font-semibold transition-all duration-300 flex items-center gap-2 md:gap-3 touch-manipulation min-h-[48px] ${selectedOccasion === occasion.id
                                    ? "bg-[#E3BBE6] dark:bg-[#302038] text-black dark:text-[#FAFAFA] shadow-lg"
                                    : "bg-transparent text-black dark:text-[#FAFAFA] hover:border-[#C0E2AD] border border-black/10 dark:border-[#FAFAFA]/10"
                                    }`}
                            >
                                <span className={`transition-transform duration-300 ${selectedOccasion === occasion.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                                    {occasion.icon}
                                </span>
                                <span className="text-sm sm:text-base md:text-base">{occasion.label}</span>
                            </motion.button>
                        ))}
                    </motion.div>

                    {/* Mood Board Display - Minimalist Frame */}
                    {currentOccasion?.moodboard && (
                        <motion.div
                            className="mb-14"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={selectedOccasion}
                        >
                            <div className="relative max-w-5xl mx-auto">
                                {/* Card with soft shadow */}
                                <div className="relative bg-[#F6F0E0] dark:bg-[#282828] rounded-3xl overflow-hidden shadow-xl dark:shadow-2xl">
                                    {/* Header Bar */}
                                    <div className="flex items-center justify-between p-4 md:p-5 border-b border-black/10 dark:border-[#FAFAFA]/10">
                                        <div className="flex items-center gap-3 md:gap-4">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#EB76C2] flex items-center justify-center text-white shadow-lg">
                                                <Star className="w-5 h-5 md:w-6 md:h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-base md:text-xl font-bold text-black dark:text-[#FAFAFA]">{currentOccasion.label} Mood Board</h3>
                                                <p className="text-xs md:text-sm text-black/60 dark:text-[#FAFAFA]/50 hidden sm:block">Curated, Complete Looks. Effortless Style.</p>
                                            </div>
                                        </div>
                                        {/* Collapse Button - Green/Purple */}
                                        <motion.button
                                            onClick={() => setShowMoodboard(!showMoodboard)}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="flex items-center justify-center gap-2 p-3 md:px-5 md:py-2.5 bg-[#C0E2AD] dark:bg-[#99C08D] text-black rounded-xl text-sm font-bold shadow-md transition-all touch-manipulation min-w-[48px] min-h-[48px] md:min-w-0 md:min-h-0"
                                            aria-label={showMoodboard ? "Collapse mood board" : "Expand mood board"}
                                        >
                                            {showMoodboard ? (
                                                <ChevronDown className="w-6 h-6 md:w-4 md:h-4" />
                                            ) : (
                                                <ChevronRight className="w-6 h-6 md:w-4 md:h-4" />
                                            )}
                                            <span className="hidden md:inline">{showMoodboard ? "Collapse" : "Expand"}</span>
                                        </motion.button>
                                    </div>

                                    {/* Mood Board Image */}
                                    <motion.div
                                        className="overflow-hidden"
                                        animate={{ height: showMoodboard ? "auto" : 0, opacity: showMoodboard ? 1 : 0 }}
                                        transition={{ duration: 0.4, ease: "easeInOut" }}
                                    >
                                        <div className="p-4">
                                            <img
                                                src={currentOccasion.moodboard}
                                                alt={`${currentOccasion.label} mood board`}
                                                className="w-full h-auto max-h-[600px] object-contain rounded-2xl"
                                            />
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Recommendations Grid - Lightweight Cards */}
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-3 gap-8">
                                {[1, 2, 3].map((i) => (<div key={i} className="rounded-2xl bg-white/50 dark:bg-[#282828]/50 h-[420px] animate-pulse" />))}
                            </motion.div>
                        ) : (
                            <motion.div key={selectedOccasion} variants={staggerContainer} initial="initial" animate="animate" className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 px-4 sm:px-0">
                                {recommendations.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        variants={staggerItem}
                                        whileHover={{ y: -8, scale: 1.02 }}
                                        className="group bg-white dark:bg-[#282828] rounded-3xl border border-black/5 dark:border-[#FAFAFA]/5 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden"
                                    >
                                        <div className="relative h-80 overflow-hidden">
                                            <img src={item.image} alt={item.title} className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110" />

                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                            {/* Match Badge - Pink */}
                                            <div className="absolute top-4 right-4 bg-[#EB76C2] text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                {item.confidence}% Match
                                            </div>

                                            {/* Heart Button */}
                                            <motion.button
                                                className="absolute top-4 left-4 w-10 h-10 bg-white/90 dark:bg-[#282828]/90 backdrop-blur-sm rounded-full flex items-center justify-center text-black/50 dark:text-[#FAFAFA]/50 hover:text-[#EB76C2] hover:bg-white dark:hover:bg-[#282828] transition-all shadow-lg"
                                                whileHover={{ scale: 1.15 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <Heart className="w-5 h-5" />
                                            </motion.button>
                                        </div>

                                        <div className="p-5">
                                            <h3 className="text-lg font-bold mb-1 text-black dark:text-[#FAFAFA] font-playfair">{item.title}</h3>
                                            <p className="text-black/50 dark:text-[#FAFAFA]/50 text-sm mb-4">{item.occasion}</p>

                                            <div className="flex items-center justify-between gap-3">
                                                {/* Pricing - Clear Hierarchy */}
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-black/40 dark:text-[#FAFAFA]/40 line-through">{item.price}</span>
                                                    <span className="text-xl font-bold text-black dark:text-[#FAFAFA]">{item.rentalPrice}</span>
                                                </div>

                                                {/* Rent Now Button - Green */}
                                                <motion.button
                                                    onClick={() => setIsSignupOpen(true)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="flex-1 max-w-[140px] px-4 py-2.5 bg-[#C0E2AD] dark:bg-[#99C08D] text-black rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    Rent Now
                                                    <ChevronRight className="w-4 h-4" />
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

            <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} />
        </>
    );
};

export default AIRecommendations;


