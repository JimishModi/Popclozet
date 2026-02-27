/**
 * Admin Route Guard
 * 
 * Phase 3: Protects admin routes from unauthorized access
 * 
 * Behavior:
 * - If not authenticated: redirect to login
 * - If authenticated but not admin: redirect to home with message
 * - If admin: render children
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from '@/components/ui/Loader';

interface AdminRouteProps {
    children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const { user, profile, loading } = useAuth();

    // Show loader while checking auth state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Checking permissions..." />
            </div>
        );
    }

    // Not authenticated: redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Authenticated but not admin: redirect to home
    // Note: Profile role check, not modifiable by client
    if (profile?.role !== 'admin') {
        // Could show toast here, but we'll keep it simple
        return <Navigate to="/" replace />;
    }

    // Admin verified: render children
    return <>{children}</>;
};
