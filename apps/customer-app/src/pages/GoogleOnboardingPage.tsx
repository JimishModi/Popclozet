import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@popclozet/api-client';
import { loadAndInitMsg91, sendOtp, verifyOtp, resendOtp } from '@/services/msg91OtpService';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function GoogleOnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading, updateProfile } = useAuth();

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);

  useEffect(() => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    if (name) setFullName(name);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth/login', { replace: true });
    if (!loading && user && profile?.onboarding_completed) {
      navigate('/home', { replace: true });
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!fullName.trim()) { setError('Please enter your name'); return; }
    if (phoneNumber.length < 10) { setError('Enter a valid 10-digit number'); return; }

    setIsLoading(true);
    setError('');
    try {
      // Step 0: Check if phone already exists in customer_profiles
      const { data: existing, error: checkError } = await supabase
        .from('customer_profiles')
        .select('id')
        .or(`phone.eq.+91${phoneNumber},phone.eq.91${phoneNumber}`)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing && existing.id !== user?.id) {
        setError('This phone number is already linked to another account.');
        setIsLoading(false);
        return;
      }

      const identifier = `91${phoneNumber}`;
      await loadAndInitMsg91(identifier);
      setStep('otp');
      setResendTimer(30);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      await resendOtp();
      setResendTimer(30);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Please enter the 6-digit code'); return; }

    setIsLoading(true);
    setError('');
    try {
      // Step 1: Verify MSG91 OTP — must be STRING
      const msg91Data = await verifyOtp(String(otp));
      const accessToken = msg91Data?.message;
      if (!accessToken) throw new Error('No token received.');

      // Step 2: Call edge function to confirm phone is real
      // NOTE: Do NOT call supabase.auth.setSession — Google session already active
      await fetch(
        'https://hfcdvcpgpkdgmcakgiuy.supabase.co/functions/v1/verify-otp-token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ accessToken, mobile: phoneNumber }),
        }
      );

      // Step 3: Save profile
      await updateProfile({
        full_name: fullName.trim(),
        phone: `+91${phoneNumber}`,
        email: user?.email || '',
        onboarding_completed: true,
        email_verified: true, // Google email is already verified
      });

      navigate('/home', { replace: true });
    } catch (err: any) {
      if (err.code === '23505') {
        setError('This phone number is already linked to another account.');
        setStep('details');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
      <div className="flex flex-col min-h-screen px-6 pt-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Almost there!</h1>
          <p className="text-zinc-400">Confirm your details to complete setup</p>
        </div>

        <div className="space-y-6">
          {step === 'details' ? (
            <>
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
                <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5 flex items-center gap-3">
                  <span className="text-zinc-400 text-sm font-medium">+91</span>
                  <div className="w-px h-5 bg-zinc-700" />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 bg-transparent text-white outline-none text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
              <Button
                onClick={handleSendOtp}
                disabled={isLoading || !fullName.trim() || phoneNumber.length < 10}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              <p className="text-zinc-400 text-sm text-center">OTP sent to +91 {phoneNumber}</p>

              <div className="flex justify-center">
                {/* ✅ Added index prop, removed {..slot} spread — InputOTPSlot reads from context */}
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#ff4d6d]" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#ff4d6d]" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#ff4d6d]" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#ff4d6d]" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#ff4d6d]" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#ff4d6d]" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

              <div className="space-y-4">
                <Button
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Enter App'}
                </Button>
                <button
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0}
                  className="w-full py-2 text-zinc-500 text-sm font-medium disabled:opacity-50"
                >
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="w-full py-2 text-zinc-400 text-xs hover:underline"
                >
                  Edit Phone Number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}