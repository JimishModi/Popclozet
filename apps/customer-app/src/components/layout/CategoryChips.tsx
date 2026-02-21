import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Category {
    id: string;
    name: string;
    image?: string;
}

const defaultCategories: Category[] = [
    { id: 'dresses', name: 'Dresses' },
    { id: 'tops', name: 'Tops' },
    { id: 'sarees', name: 'Sarees' },
    { id: 'lehengas', name: 'Lehengas' },
    { id: 'suits', name: 'Suits' },
    { id: 'kurtas', name: 'Kurtas' },
    { id: 'gowns', name: 'Gowns' },
    { id: 'jackets', name: 'Jackets' },
];

interface CategoryChipsProps {
    categories?: Category[];
    selectedCategory?: string;
    onSelect?: (categoryId: string) => void;
    className?: string;
}

/**
 * Horizontal scrollable category chips with "See all" link.
 */
export const CategoryChips: React.FC<CategoryChipsProps> = ({
    categories = defaultCategories,
    selectedCategory,
    onSelect,
    className
}) => {
    return (
        <div className={cn("space-y-3", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4">
                <h3 className="text-sm font-semibold text-foreground dark:text-white">Categories</h3>
                <Link
                    to="/collections"
                    className="text-xs font-medium text-primary hover:underline"
                >
                    See all
                </Link>
            </div>

            {/* Scrollable Chips */}
            <ScrollArea className="w-full">
                <div className="flex gap-3 px-4 pb-2">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => onSelect?.(category.id)}
                            className={cn(
                                "flex-shrink-0 min-w-[80px] aspect-square rounded-2xl",
                                "flex flex-col items-center justify-center gap-2",
                                "bg-muted/30 dark:bg-white/5",
                                "border border-border/20 dark:border-white/10",
                                "hover:bg-muted/50 dark:hover:bg-white/10",
                                "transition-all duration-200",
                                selectedCategory === category.id && "ring-2 ring-primary bg-primary/10"
                            )}
                        >
                            {category.image ? (
                                <img
                                    src={category.image}
                                    alt={category.name}
                                    className="w-10 h-10 object-contain"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-muted/50 dark:bg-white/10" />
                            )}
                            <span className="text-xs font-medium text-foreground/80 dark:text-white/80 text-center px-1">
                                {category.name}
                            </span>
                        </button>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="invisible" />
            </ScrollArea>
        </div>
    );
};

export default CategoryChips;
