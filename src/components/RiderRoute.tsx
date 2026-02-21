/**
 * Rider Route Guard
 * 
 * Phase 4 Finalization: Protects rider routes from unauthorized access
 * 
 * Behavior:
 * - If not authenticated: redirect to login
 * - If authenticated but not rider: redirect to home
 * - If rider: render children
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from '@/components/ui/Loader';

interface RiderRouteProps {
    children: React.ReactNode;
}

export const RiderRoute: React.FC<RiderRouteProps> = ({ children }) => {
    const { user, profile, loading } = useAuth();

    // Show loader while checking auth state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading..." />
            </div>
        );
    }

    // Not authenticated: redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Authenticated but not rider: redirect to home
    if (profile?.role !== 'rider') {
        return <Navigate to="/" replace />;
    }

    // Rider verified: render children
    return <>{children}</>;
};
