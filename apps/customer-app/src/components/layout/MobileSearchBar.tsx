import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import SmartSearchOverlay from '@/components/SmartSearchOverlay';

interface MobileSearchBarProps {
    className?: string;
    placeholder?: string;
}

/**
 * Mobile search bar that opens the SmartSearchOverlay when clicked.
 */
export const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
    className,
    placeholder = "Search for outfits, styles..."
}) => {
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const handleSearch = (query: string) => {
        console.log('Search query:', query);
        // TODO: Implement search navigation
        setIsSearchOpen(false);
    };

    return (
        <>
            <div className={cn("px-4 py-2", className)}>
                <button
                    onClick={() => setIsSearchOpen(true)}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3",
                        "bg-muted/50 dark:bg-white/5",
                        "border border-border/20 dark:border-white/10",
                        "rounded-full",
                        "text-muted-foreground text-sm text-left",
                        "hover:bg-muted dark:hover:bg-white/10 transition-colors"
                    )}
                >
                    <span className="flex-1 truncate">{placeholder}</span>
                    <div className="p-1.5 rounded-full bg-primary/10 dark:bg-primary/20">
                        <Search className="w-4 h-4 text-primary" />
                    </div>
                </button>
            </div>

            <SmartSearchOverlay
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSearch={handleSearch}
            />
        </>
    );
};

export default MobileSearchBar;
