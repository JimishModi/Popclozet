import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Users, Sparkles } from "lucide-react";

interface GenderOption {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    hoverGradient: string;
}

const GENDER_OPTIONS: GenderOption[] = [
    {
        id: "mens",
        label: "Men's Collection",
        description: "Suits, Sherwanis & More",
        icon: <User className="w-12 h-12" />,
        gradient: "from-blue-500 to-indigo-600",
        hoverGradient: "from-blue-600 to-indigo-700",
    },
    {
        id: "womens",
        label: "Women's Collection",
        description: "Dresses, Sarees & Lehengas",
        icon: <Sparkles className="w-12 h-12" />,
        gradient: "from-pink-500 to-rose-600",
        hoverGradient: "from-pink-600 to-rose-700",
    },
    {
        id: "unisex",
        label: "Unisex Collection",
        description: "Jackets, Streetwear & Casual",
        icon: <Users className="w-12 h-12" />,
        gradient: "from-purple-500 to-violet-600",
        hoverGradient: "from-purple-600 to-violet-700",
    },
];

export const GenderSelector = () => {
    const navigate = useNavigate();

    const handleGenderSelect = (genderId: string) => {
        navigate(`/shop/${genderId}`);
    };

    return (
        <section className="py-16 md:py-24 bg-gradient-to-b from-[#F6F0E0] to-white dark:from-[#1A1A1A] dark:to-[#0E0E0E]">
            <div className="container-custom">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12 md:mb-16"
                >
                    <div className="inline-flex items-center gap-2 bg-[#E3BBE6] dark:bg-[#302038] text-black dark:text-[#FAFAFA] px-6 py-2.5 rounded-full mb-6">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-bold text-sm tracking-wide uppercase">Shop by Gender</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-playfair font-bold mb-4 text-black dark:text-[#FAFAFA]">
                        Find Your Perfect <span className="text-[#EB76C2]">Style</span>
                    </h2>
                    <p className="text-black/60 dark:text-[#FAFAFA]/60 text-lg max-w-2xl mx-auto">
                        Browse our curated collections tailored for every style and occasion
                    </p>
                </motion.div>

                {/* Gender Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {GENDER_OPTIONS.map((option, index) => (
                        <motion.div
                            key={option.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ y: -8, scale: 1.02 }}
                            onClick={() => handleGenderSelect(option.id)}
                            className="group cursor-pointer"
                        >
                            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#282828] shadow-xl hover:shadow-2xl transition-all duration-500">
                                {/* Gradient Background */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-500`} />

                                {/* Content */}
                                <div className="relative p-8 md:p-10 flex flex-col items-center text-center">
                                    {/* Icon */}
                                    <motion.div
                                        whileHover={{ rotate: 360, scale: 1.1 }}
                                        transition={{ duration: 0.6 }}
                                        className={`w-24 h-24 rounded-full bg-gradient-to-br ${option.gradient} flex items-center justify-center text-white mb-6 shadow-lg`}
                                    >
                                        {option.icon}
                                    </motion.div>

                                    {/* Label */}
                                    <h3 className="text-2xl md:text-3xl font-playfair font-bold mb-2 text-black dark:text-[#FAFAFA]">
                                        {option.label}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-black/60 dark:text-[#FAFAFA]/60 mb-6">
                                        {option.description}
                                    </p>

                                    {/* CTA Button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`px-8 py-3 bg-gradient-to-r ${option.gradient} group-hover:bg-gradient-to-r group-hover:${option.hoverGradient} text-white font-bold rounded-full shadow-md hover:shadow-xl transition-all duration-300 flex items-center gap-2`}
                                    >
                                        Shop Now
                                        <motion.span
                                            animate={{ x: [0, 4, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        >
                                            →
                                        </motion.span>
                                    </motion.button>
                                </div>

                                {/* Decorative Elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-3xl" />
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-white/10 to-transparent rounded-full blur-2xl" />
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="text-center mt-12"
                >
                    <p className="text-black/50 dark:text-[#FAFAFA]/50 text-sm">
                        Not sure? Browse all collections →{" "}
                        <button
                            onClick={() => navigate("/collections")}
                            className="text-[#EB76C2] hover:underline font-semibold"
                        >
                            View All
                        </button>
                    </p>
                </motion.div>
            </div>
        </section>
    );
};
