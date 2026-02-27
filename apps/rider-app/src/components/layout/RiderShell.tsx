import React from 'react';
import { clsx } from 'clsx';

interface RiderShellProps {
    children: React.ReactNode;
    className?: string;
    hideBottomNav?: boolean;
}

/**
 * RiderShell wraps the app content in a mobile-sized container.
 * Matches Customer App's MobileShell for consistent branding.
 */
export const RiderShell: React.FC<RiderShellProps> = ({
    children,
    className,
    hideBottomNav = false
}) => {
    return (
        <div className="min-h-screen bg-black flex justify-center">
            {/* Mobile container */}
            <div
                className={clsx(
                    "w-full max-w-[430px] min-h-screen relative",
                    "bg-[#0a0a0a]", // Dark theme background
                    "shadow-2xl shadow-black/50",
                    className
                )}
            >
                {/* Main content area */}
                <div className={clsx(
                    "flex flex-col min-h-screen",
                    !hideBottomNav && "pb-20"
                )}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default RiderShell;
