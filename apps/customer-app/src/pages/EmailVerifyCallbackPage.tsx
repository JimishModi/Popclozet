import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { supabase } from '@popclozet/api-client';
import { Loader2 } from 'lucide-react';

export default function EmailVerifyCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Update email_verified in customer_profiles
          await supabase
            .from('customer_profiles')
            .update({ email_verified: true, updated_at: new Date().toISOString() })
            .eq('user_id', session.user.id);

          navigate('/home', { replace: true });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
      <div className="flex flex-col min-h-screen items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-[#ff4d6d] animate-spin" />
        <p className="text-zinc-400 text-sm">Verifying your email...</p>
      </div>
    </MobileShell>
  );
}
