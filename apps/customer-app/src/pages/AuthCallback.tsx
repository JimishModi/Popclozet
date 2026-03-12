/**
 * AuthCallback — Handles OAuth redirect from Supabase (Google sign-in).
 * 
 * Supabase redirects here after Google auth. The SupabaseAuthContext
 * picks up the session automatically. This page just shows a loading
 * state while the AuthGate decides where to send the user.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/SupabaseAuthContext';
import { MobileShell } from '@/components/layout/MobileShell';

export default function AuthCallback() {
    const navigate = useNavigate();
    const { user, loading, needsOnboarding } = useAuth();

    useEffect(() => {
        if (loading) return;

        if (user && needsOnboarding) {
            navigate('/auth/create-account', { replace: true });
        } else if (user) {
            navigate('/home', { replace: true });
        } else {
            // No session found — back to login
            navigate('/auth/login', { replace: true });
        }
    }, [user, loading, needsOnboarding, navigate]);

    return (
        <MobileShell className="bg-black text-white">
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <div className="w-10 h-10 border-3 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">Signing you in...</p>
            </div>
        </MobileShell>
    );
}
