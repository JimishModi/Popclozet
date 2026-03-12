import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    onClick,
    type = 'button',
}, ref) => {
    const baseClasses = 'font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

    const variantClasses = {
        primary: 'bg-gradient-to-r from-[#ff4d6d] to-pink-600 hover:from-[#ff3355] hover:to-pink-500 text-white shadow-[0_10px_30px_rgba(255,77,109,0.4)] hover:shadow-[0_15px_40px_rgba(255,77,109,0.5)]',
        secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/10',
        outline: 'border-2 border-[#ff4d6d] text-[#ff4d6d] hover:bg-[#ff4d6d]/10',
        ghost: 'text-zinc-400 hover:text-white hover:bg-white/5',
    };

    const sizeClasses = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    const isDisabled = disabled || loading;

    return (
        <motion.button
            ref={ref}
            whileHover={isDisabled ? undefined : { scale: 1.02 }}
            whileTap={isDisabled ? undefined : { scale: 0.97 }}
            transition={{
                type: 'spring',
                stiffness: 500,
                damping: 25,
            }}
            className={cn(
                baseClasses,
                variantClasses[variant],
                sizeClasses[size],
                className
            )}
            disabled={isDisabled}
            onClick={onClick}
            type={type}
        >
            {loading && (
                <motion.svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </motion.svg>
            )}
            {children}
        </motion.button>
    );
});

Button.displayName = 'Button';
