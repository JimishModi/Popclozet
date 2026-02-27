import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, className, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                        {label}
                        {props.required && <span className="text-[#ff4d6d] ml-1">*</span>}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        'w-full px-4 py-3 rounded-xl outline-none transition-all duration-200',
                        'bg-white/5 border border-white/10 text-white placeholder:text-zinc-500',
                        'focus:border-[#ff4d6d]/50 focus:ring-2 focus:ring-[#ff4d6d]/20',
                        error && 'border-red-500 focus:ring-red-500/20',
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-400">{error}</p>
                )}
                {helperText && !error && (
                    <p className="mt-1 text-sm text-zinc-500">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
