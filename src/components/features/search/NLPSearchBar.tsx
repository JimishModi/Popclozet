import React, { useState } from 'react';
import { debounce } from '@/utils/helpers';
import { motion } from 'framer-motion';

interface NLPSearchBarProps {
    onSearch: (query: string) => void;
}

export const NLPSearchBar: React.FC<NLPSearchBarProps> = ({ onSearch }) => {
    const [query, setQuery] = useState('');
    const [suggestions] = useState([
        'Elegant dress for wedding',
        'Casual outfit for party',
        'Formal wear for interview',
        'Traditional attire for festival',
    ]);

    const handleSearch = debounce((value: string) => {
        onSearch(value);
    }, 500);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        handleSearch(value);
    };

    return (
        <div className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder="Search by occasion, style, or describe what you need..."
                    className="w-full px-5 py-4 pr-12 text-base bg-white/5 border-2 border-white/10 rounded-2xl text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-[#ff4d6d]/20 focus:border-[#ff4d6d]/50 outline-none transition-all"
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ff4d6d]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </button>
            </div>

            {/* Search Suggestions */}
            {!query && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4"
                >
                    <p className="text-sm text-zinc-500 mb-2">Try searching:</p>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setQuery(suggestion);
                                    onSearch(suggestion);
                                }}
                                className="px-3 py-1.5 bg-[#ff4d6d]/10 text-[#ff4d6d] rounded-full text-sm hover:bg-[#ff4d6d]/20 transition-colors border border-[#ff4d6d]/20"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};
