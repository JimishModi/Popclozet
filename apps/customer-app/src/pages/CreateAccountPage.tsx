import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@popclozet/api-client';
import { Loader2, LogIn } from 'lucide-react';

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const { user, profile, loading, updateProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth/login', { replace: true }); return; }
    // If already fully onboarded — skip straight to home
    if (profile?.onboarding_completed) {
      navigate('/home', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError('Please enter your name'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email address'); return; }

    setIsLoading(true);
    setError('');
    setEmailAlreadyExists(false);

    try {
      // Check if email already exists in customer_profiles
      const { data: existing } = await supabase
        .from('customer_profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        setEmailAlreadyExists(true);
        setError('An account with this email already exists.');
        setIsLoading(false);
        return;
      }

      // Save profile
      await updateProfile({
        full_name: fullName,
        email: email.trim(),
        gender: undefined,
        onboarding_completed: true,
        email_verified: false,
      });

      // Send verification email silently (non-blocking)
      supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify-email-callback`,
          shouldCreateUser: false,
        },
      }).catch(() => {});

    } catch (err) {
      console.error(err);
      alert((err as any)?.message || "Could not create account.");
      setIsLoading(false);
    }
  };

  const handleSignInInstead = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#f2546d] animate-spin" />
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
            <div className={`bg-zinc-900/80 backdrop-blur-sm rounded-2xl border px-4 py-3.5 ${emailAlreadyExists ? 'border-orange-500/60' : 'border-zinc-800'}`}>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailAlreadyExists(false);
                  setError('');
                }}
                className="w-full bg-transparent text-white outline-none text-sm"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

          {/* "Sign in instead" — shown when email is already registered */}
          {emailAlreadyExists && (
            <button
              onClick={handleSignInInstead}
              className="w-full py-4 rounded-2xl bg-zinc-800 border border-zinc-700 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <LogIn className="w-5 h-5 text-[#f2546d]" />
              Sign in with your phone instead
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || !fullName.trim() || !email.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#f2546d]/30 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Get Started'}
          </button>

          {/* Always-visible fallback sign-in link */}
          <p className="text-center text-xs text-zinc-500 pb-6">
            Already have an account?{' '}
            <button onClick={handleSignInInstead} className="text-[#f2546d] font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
