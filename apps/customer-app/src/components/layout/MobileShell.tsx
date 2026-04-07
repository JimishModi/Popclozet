import React from 'react';
import { cn } from '@/lib/utils';
import { BottomNavBar } from './BottomNavBar';

interface MobileShellProps {
    children: React.ReactNode;
    className?: string;
    hideBottomNav?: boolean;
    hideGlow?: boolean;
    isGlobalShell?: boolean;
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
    isGlobalShell = false,
}) => {
    return (
        <div className="min-h-dvh bg-black flex justify-center">
            {/* Responsive Container */}
            <div
                className={cn(
                    "w-full min-h-dvh relative overflow-clip",
                    // Mobile constraints
                    "max-w-[430px]",
                    // Tablet constraints (md+)
                    "md:max-w-full md:px-6",
                    // Desktop constraints (lg+)
                    "lg:max-w-7xl lg:px-8 lg:flex lg:flex-row items-start",
                    "bg-[#0a0a0a]",
                    "shadow-2xl shadow-black/50 md:shadow-none",
                    className
                )}
                style={{
                    // iOS safe area: ensure content never hides under notch / Dynamic Island / status bar
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                    paddingLeft: 'env(safe-area-inset-left, 0px)',
                    paddingRight: 'env(safe-area-inset-right, 0px)',
                }}
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

                {/* Navbar is properly inside the centered flex container, ONLY rendered by the Global layout to prevent duplicates */}
                {isGlobalShell && !hideBottomNav && <BottomNavBar />}

                {/* Main content area */}
                <div
                    className={cn(
                        "flex flex-col min-h-dvh relative z-[1] flex-1 min-w-0 w-full",
                        !hideBottomNav && "md:pb-0 md:pt-20 lg:pt-0"
                    )}
                    style={!hideBottomNav ? {
                        // iOS: add safe-area-inset-bottom on top of the 80px nav height so content clears the home indicator
                        paddingBottom: 'max(80px, calc(80px + env(safe-area-inset-bottom, 0px)))',
                    } : undefined}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

export default MobileShell;
