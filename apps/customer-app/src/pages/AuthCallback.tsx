/**
 * AuthCallback — Handles OAuth redirect from Supabase (Google sign-in).
 *
 * Important on iOS/WebKit: avoid racing AuthGate with an extra navigate()
 * on the successful sign-in path. AuthGate owns the happy-path redirect.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/SupabaseAuthContext';
import { MobileShell } from '@/components/layout/MobileShell';

export default function AuthCallback() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading || user) return;

        const timer = setTimeout(() => {
            navigate('/auth/login', { replace: true });
        }, 1500);

        return () => clearTimeout(timer);
    }, [user, loading, navigate]);

    return (
        <MobileShell className="bg-black text-white">
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <div className="w-10 h-10 border-3 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">Signing you in...</p>
                {!loading && !user && (
                    <Link to="/auth/login" replace className="text-sm text-[#f2546d]">
                        Return to login
                    </Link>
                )}
            </div>
        </MobileShell>
    );
}
