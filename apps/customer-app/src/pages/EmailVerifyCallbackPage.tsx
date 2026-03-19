import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@popclozet/api-client';
import { useAuth } from '@/context/SupabaseAuthContext';
import { MobileShell } from '@/components/layout/MobileShell';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function EmailVerifyCallbackPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleVerification = async () => {
      // Supabase handles the actual session establishment from the magic link URL automatically.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        // If no session yet, wait a bit or listen for auth change
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession?.user) {
            subscription.unsubscribe();
            completeVerification(newSession.user.id);
          }
        });

        // Set a timeout for verification
        const timer = setTimeout(() => {
          subscription.unsubscribe();
          if (status === 'loading') {
            setStatus('error');
            setMessage('Verification timed out. Please try clicking the link in your email again.');
          }
        }, 10000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } else {
        await completeVerification(session.user.id);
      }
    };

    const completeVerification = async (userId: string) => {
      try {
        // Update both local DB for UI tracking
        const { error: dbError } = await supabase
          .from('customer_profiles')
          .update({ 
            email_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (dbError) throw dbError;

        // Refresh profile in context so UI updates immediately
        await refreshProfile();
        
        setStatus('success');
        setMessage('Your email has been successfully verified! Redirecting to home...');
        
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 2000);
      } catch (err: any) {
        console.error('[VerifyEmail] Error updating profile:', err);
        setStatus('error');
        setMessage('Your account was verified but we failed to update your profile. Please contact support.');
      }
    };

    handleVerification();
  }, [navigate, refreshProfile]);

  return (
    <MobileShell hideBottomNav hideGlow className="bg-[#1a1a1a] text-white">
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-[#ff4d6d] animate-spin mb-4" />
            <h1 className="text-xl font-bold mb-2">Verifying...</h1>
            <p className="text-zinc-400">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
            <h1 className="text-2xl font-bold mb-2">Email Verified</h1>
            <p className="text-zinc-400 mb-8">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mb-6" />
            <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="text-zinc-400 mb-8">{message}</p>
            <button 
              onClick={() => navigate('/auth/login')}
              className="px-6 py-2 bg-zinc-800 rounded-full text-white font-medium"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </MobileShell>
  );
}
