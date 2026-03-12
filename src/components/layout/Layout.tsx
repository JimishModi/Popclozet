import React from 'react';
import { RoleBasedNavigation } from '@/components/RoleBasedNavigation';

interface LayoutProps {
    children: React.ReactNode;
    hideBottomNav?: boolean;
}

/**
 * Simple Layout wrapper that provides the mobile container and bottom navigation.
 * Centered mobile view with dark theme.
 */
export const Layout: React.FC<LayoutProps> = ({
    children,
    hideBottomNav = false
}) => {
    return (
        <div className="min-h-screen bg-black flex justify-center">
            <div className="w-full max-w-[500px] min-h-screen relative bg-[#0a0a0a] lg:shadow-2xl lg:shadow-black/50">
                <div className={`flex flex-col min-h-screen ${!hideBottomNav ? 'pb-20' : ''}`}>
                    {children}
                </div>
                {!hideBottomNav && <RoleBasedNavigation />}
            </div>
        </div>
    );
};
