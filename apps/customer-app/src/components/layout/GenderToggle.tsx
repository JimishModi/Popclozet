import React from 'react';
import { cn } from '@/lib/utils';

type Gender = 'men' | 'women';

interface GenderToggleProps {
    value: Gender;
    onChange: (gender: Gender) => void;
    className?: string;
}

/**
 * Gender toggle component with MEN/WOMEN buttons.
 * Active state shows white pill background, inactive shows icon only.
 */
export const GenderToggle: React.FC<GenderToggleProps> = ({
    value,
    onChange,
    className
}) => {
    return (
        <div className={cn(
            "flex items-center justify-center gap-2 py-3",
            className
        )}>
            {/* Men Button */}
            <button
                onClick={() => onChange('men')}
                className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300",
                    value === 'men'
                        ? "bg-white dark:bg-white text-black shadow-lg"
                        : "bg-muted/30 dark:bg-white/10 text-muted-foreground hover:bg-muted/50 dark:hover:bg-white/20"
                )}
            >
                {/* Pants Icon */}
                <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M6 2h12v4l-2 16H8L6 6V2z" />
                    <path d="M12 6v16" />
                </svg>
                {value === 'men' && (
                    <span className="font-semibold text-sm">MEN</span>
                )}
            </button>

            {/* Women Button */}
            <button
                onClick={() => onChange('women')}
                className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300",
                    value === 'women'
                        ? "bg-white dark:bg-white text-black shadow-lg"
                        : "bg-muted/30 dark:bg-white/10 text-muted-foreground hover:bg-muted/50 dark:hover:bg-white/20"
                )}
            >
                {/* Dress Icon */}
                <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M12 2v4M8 6l4-4 4 4M6 10l2-4h8l2 4M6 10l-2 12h16l-2-12" />
                </svg>
                {value === 'women' && (
                    <span className="font-semibold text-sm">WOMEN</span>
                )}
            </button>
        </div>
    );
};

export default GenderToggle;
