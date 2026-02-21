import React from 'react';
import { cn } from '@/lib/utils';

interface MobileShellProps {
    children: React.ReactNode;
    className?: string;
    hideBottomNav?: boolean;
}

/**
 * MobileShell wraps the app content in a mobile-sized container.
 * On desktop, it centers the content at a comfortable mobile width.
 * On mobile, it takes full width.
 */
export const MobileShell: React.FC<MobileShellProps> = ({
    children,
    className,
    hideBottomNav = false
}) => {
    return (
        <div className="min-h-screen bg-black flex justify-center">
            {/* Mobile container - larger width for better visibility */}
            <div
                className={cn(
                    "w-full max-w-[500px] min-h-screen relative",
                    "bg-[#0a0a0a]",
                    "lg:shadow-2xl lg:shadow-black/50",
                    className
                )}
            >
                {/* Main content area with bottom padding for nav */}
                <div className={cn(
                    "flex flex-col min-h-screen",
                    !hideBottomNav && "pb-20"
                )}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default MobileShell;
