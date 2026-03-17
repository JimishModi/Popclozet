import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@popclozet/api-client';
import { Loader2 } from 'lucide-react';

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const { user, profile, loading, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/auth/login', { replace: true });
    if (!loading && user && profile?.onboarding_completed) {
      navigate('/home', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Step 0: Check if email already exists
      const { data: existing, error: checkError } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        setError('This email is already associated with another account.');
        setIsLoading(false);
        return;
      }

      // Step 1: Save profile with onboarding_completed: true and email_verified: false
      await updateProfile({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: user?.phone || '',
        onboarding_completed: true,
        email_verified: false,
      });

      // Step 2: Send magic link SILENTLY — non-blocking, do NOT await
      supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify-email-callback`,
          shouldCreateUser: false,
        },
      }).catch((err) => console.error('[Auth] Silent magic link error:', err));

      // Step 3: Navigate immediately — do not wait for email
      navigate('/home', { replace: true });
    } catch (err: any) {
      if (err.code === '23505') {
        setError('This email is already associated with another account.');
      } else {
        setError(err.message || 'Failed to save profile. Please try again.');
      }
      setIsLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff4d6d] animate-spin" />
      </div>
    );
  }

  return (
    <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
      <div className="flex flex-col min-h-screen px-6 pt-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete your profile</h1>
          <p className="text-zinc-400">Just a few more details to get started</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5">
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-transparent text-white outline-none text-sm"
              />
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5">
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-white outline-none text-sm"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isLoading || !fullName.trim() || !email.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#ff4d6d]/30 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Get Started'}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}