import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { cn } from '@/lib/utils';
import { usePersistentGender } from '@/hooks/usePersistentGender';

// Inline SVG icons
const ArrowRight = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
);

const Sparkles = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
    </svg>
);

const Briefcase = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

const Palmtree = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4M13 8c0-2.76 2.46-5 5.5-5S24 5.24 24 8h-2l-1-1-1 1h-4M13 17v-5c0-2.2-1.8-4-4-4M13 17v-5c0-2.2 1.8-4 4-4M13 21l-2-4h4l-2 4" />
    </svg>
);

const Coffee = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
);

// Types
type Gender = 'women' | 'men';

interface Category {
    id: string;
    name: string;
    icon: React.ElementType;
    description: string;
    image: string;
    color: string;
}

const categories: Category[] = [
    {
        id: 'party',
        name: 'Party & Night Out',
        icon: Sparkles,
        description: 'Dazzle the night',
        image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&q=80',
        color: 'from-pink-500/30 to-purple-500/30'
    },
    {
        id: 'formal',
        name: 'Formal & Office',
        icon: Briefcase,
        description: 'Professional style',
        image: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&q=80',
        color: 'from-blue-500/30 to-slate-500/30'
    },
    {
        id: 'vacation',
        name: 'Vacation & Beach',
        icon: Palmtree,
        description: 'Breezy getaway',
        image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80',
        color: 'from-orange-500/30 to-yellow-500/30'
    },
    {
        id: 'casual',
        name: 'Casual & Brunch',
        icon: Coffee,
        description: 'Effortless everyday',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80',
        color: 'from-green-500/30 to-teal-500/30'
    }
];

const GenderCategoryPage: React.FC = () => {
    const [activeGender, setActiveGender] = usePersistentGender('womens');
    const navigate = useNavigate();

    const handleCategoryClick = (categoryId: string) => {
        navigate(`/collections/${categoryId}?gender=${activeGender}`);
    };

    return (
        <MobileShell>
            <MobileHeader />

            <main className="flex-1 overflow-y-auto bg-background dark:bg-[#0a0a0a]">
                {/* Header */}
                <div className="px-4 py-4">
                    <h1 className="text-2xl font-bold text-foreground dark:text-white mb-1">
                        Shop by <span className="text-primary">Occasion</span>
                    </h1>
                    <p className="text-sm text-muted-foreground dark:text-white/60">
                        Find the perfect outfit for any event
                    </p>
                </div>

                {/* Gender Toggle */}
                <div className="flex justify-center px-4 pb-4">
                    <div className={cn(
                        "p-1 rounded-full flex gap-1",
                        "bg-muted/50 dark:bg-white/10"
                    )}>
                        {(['womens', 'mens'] as const).map((gender) => (
                            <button
                                key={gender}
                                onClick={() => setActiveGender(gender)}
                                className={cn(
                                    "px-6 py-2 rounded-full text-sm font-medium transition-all duration-300",
                                    activeGender === gender
                                        ? "bg-white dark:bg-white text-black shadow-sm"
                                        : "text-muted-foreground dark:text-white/60 hover:text-foreground dark:hover:text-white"
                                )}
                            >
                                {gender === 'womens' ? 'Women' : 'Men'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Category Grid */}
                <div className="px-4 pb-6 grid grid-cols-2 gap-3">
                    {categories.map((category, index) => (
                        <motion.div
                            key={category.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => handleCategoryClick(category.id)}
                            className="cursor-pointer"
                        >
                            <div className={cn(
                                "relative overflow-hidden rounded-2xl h-40",
                                "border border-border/20 dark:border-white/10"
                            )}>
                                {/* Background Image */}
                                <div className="absolute inset-0">
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50" />
                                    <div className={`absolute inset-0 bg-gradient-to-br ${category.color} mix-blend-overlay`} />
                                </div>

                                {/* Content */}
                                <div className="relative z-10 h-full flex flex-col justify-end p-3 text-white">
                                    <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg w-fit mb-2">
                                        <category.icon className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-sm font-bold leading-tight">{category.name}</h3>
                                    <p className="text-xs text-white/70 mt-0.5">{category.description}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* AI Styling CTA */}
                <div className="px-4 pb-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={cn(
                            "p-4 rounded-2xl text-center",
                            "bg-gradient-to-br from-primary/10 to-purple-500/10",
                            "dark:from-primary/20 dark:to-purple-500/20",
                            "border border-primary/20 dark:border-primary/30"
                        )}
                    >
                        <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                        <h3 className="text-base font-bold text-foreground dark:text-white mb-1">
                            Can't find what you need?
                        </h3>
                        <p className="text-xs text-muted-foreground dark:text-white/60 mb-3">
                            Let our AI stylist help you find the perfect outfit
                        </p>
                        <button
                            onClick={() => navigate('/chromatic')}
                            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 mx-auto"
                        >
                            <Sparkles className="w-4 h-4" />
                            Try AI Styling
                        </button>
                    </motion.div>
                </div>
            </main>
        </MobileShell>
    );
};

export default GenderCategoryPage;

