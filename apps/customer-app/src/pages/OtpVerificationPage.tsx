import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { useAuth } from '@/context/SupabaseAuthContext';
import { verifyOtp } from '@/services/msg91OtpService';
import { supabase } from '@popclozet/api-client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function OtpVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const phoneNumber = location.state?.phone || '';
  // FIX: Removed checkAndRoute — AuthGate handles all routing based on needsOnboarding.
  // Using needsOnboarding directly from context instead.
  const { user, needsOnboarding, loading } = useAuth();

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  useEffect(() => {
    if (!phoneNumber) {
      navigate('/auth/login');
      return;
    }

    // Ensure SDK is initialized with the correct formatted identifier
    const initSdk = async () => {
      try {
        const { loadAndInitMsg91 } = await import('@/services/msg91OtpService');
        // autoSend: false — only init, don't trigger a redundant SMS on page load
        await loadAndInitMsg91(`91${phoneNumber}`, false);
      } catch (err) {
        console.error('[OTP] Failed to init SDK:', err);
      }
    };
    initSdk();
  }, [phoneNumber, navigate]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // Step 1: MSG91 — OTP MUST be passed as STRING
      const msg91Data = await verifyOtp(String(otp));
      const accessToken = msg91Data?.message;
      if (!accessToken) throw new Error('OTP verification failed. No token received.');

      // Step 2: Edge function
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp-token`,
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
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.details ? `${result.error}: ${result.details}` : (result.error || 'Server verification failed.'));
      }

      // Step 3: Set session — guard against missing/incomplete session data
      if (!result.session?.access_token || !result.session?.refresh_token) {
        throw new Error('Verification succeeded but no session was returned. Please try again.');
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (sessionError) throw new Error(sessionError.message);

      setVerified(true);
    } catch (err: any) {
      if (err.message?.includes('expired')) {
        setError('OTP has expired. Please request a new one.');
      } else if (err.message?.toLowerCase().includes('invalid')) {
        setError('Invalid OTP. Please check and try again.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // FIX: Let AuthGate drive navigation. Once verified + auth context has settled,
  // nudge to the right place based on needsOnboarding from context.
  // Previously this used checkAndRoute which could conflict with AuthGate.
  useEffect(() => {
    if (!verified || loading) return;
    if (!user) return;

    if (needsOnboarding) {
      navigate('/auth/create-account', { replace: true });
    } else {
      navigate('/home', { replace: true });
    }
  }, [verified, user, loading, needsOnboarding, navigate]);

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      const { sendOtp } = await import('@/services/msg91OtpService');
      // FIX: Pass identifier in correct format — 91XXXXXXXXXX (no +)
      await sendOtp(`91${phoneNumber}`);
      setResendTimer(30);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  return (
    <MobileShell className="bg-black text-white" hideBottomNav hideGlow>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <button
          onClick={() => navigate('/auth/login')}
          className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </header>

      <div className="flex flex-col min-h-screen px-6 pt-12">

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Verify Phone</h1>
          <p className="text-zinc-400">Enter the 6-digit code sent to +91 {phoneNumber}</p>
        </div>

        <div className="space-y-8">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup className="gap-2">
                <InputOTPSlot index={0} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#f2546d]" />
                <InputOTPSlot index={1} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#f2546d]" />
                <InputOTPSlot index={2} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#f2546d]" />
                <InputOTPSlot index={3} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#f2546d]" />
                <InputOTPSlot index={4} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#f2546d]" />
                <InputOTPSlot index={5} className="w-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 rounded-xl focus:ring-1 focus:ring-[#f2546d]" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

          <div className="space-y-4">
            <Button
              onClick={handleVerify}
              disabled={isLoading || otp.length !== 6}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#f2546d]/30"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
            </Button>

            <button
              onClick={handleResend}
              disabled={resendTimer > 0}
              className="w-full py-2 text-zinc-500 text-sm font-medium disabled:opacity-50"
            >
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
