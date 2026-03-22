import React from 'react';
import { cn } from '@/lib/utils';

interface MobileShellProps {
    children: React.ReactNode;
    className?: string;
    hideBottomNav?: boolean;
    hideGlow?: boolean;
}

/**
 * MobileShell wraps the app content in a mobile-sized container.
 * On desktop, it centers the content and constrains it to ~430px width.
 * On mobile, it takes full width.
 */
export const MobileShell: React.FC<MobileShellProps> = ({
    children,
    className,
    hideBottomNav = false,
    hideGlow = false,
}) => {
    return (
        <div className="min-h-screen bg-black flex justify-center">
            {/* Mobile container */}
            <div
                className={cn(
                    "w-full max-w-[430px] min-h-screen relative overflow-clip",
                    "bg-[#0a0a0a]",
                    "shadow-2xl shadow-black/50",
                    className
                )}
            >
                {/* ── Global red glow orb – top-left ── */}
                {!hideGlow && (
                    <div
                        className="absolute -top-10 -left-10 w-44 h-44 rounded-full pointer-events-none z-0"
                        style={{
                            background: "radial-gradient(circle, rgba(242,84,109,0.35) 0%, rgba(242,84,109,0.15) 40%, transparent 70%)",
                            filter: "blur(50px)",
                        }}
                    />
                )}

                {/* Main content area with bottom padding for nav */}
                <div className={cn(
                    "flex flex-col min-h-screen relative z-[1]",
                    !hideBottomNav && "pb-20"
                )}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default MobileShell;
