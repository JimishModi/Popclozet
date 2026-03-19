import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { useAuth } from '@/context/SupabaseAuthContext';
import { loadAndInitMsg91, sendOtp } from '@/services/msg91OtpService';
import logoImage from '@/logo/logo.png';
import { Loader2, ChevronRight, Phone } from 'lucide-react';

function BackgroundGrid() {
  const cols = 7;
  const rows = 10;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: '100%',
            aspectRatio: '1 / 1.2',
            borderRadius: '10px',
            background: '#2a2a2a',
            border: '1px solid rgba(255,77,109,0.12)',
          }}
        />
      );
    }
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '6px', padding: '8px', width: '100%', height: '100%' }}>
      {tiles}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FIX: Removed signInWithGoogle — it was never in AuthContextType and was undefined
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) navigate('/home');
  }, [user, authLoading, navigate]);

  const handlePhoneLogin = useCallback(async () => {
    if (phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const identifier = `91${phoneNumber}`;
      await sendOtp(identifier);
      navigate('/auth/otp', { state: { phone: phoneNumber } });
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff4d6d] animate-spin" />
      </div>
    );
  }

  return (
    <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
      <div className="flex flex-col min-h-screen">
        <div className="relative h-[40vh] overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <img src={logoImage} alt="PopClozet" className="h-12" />
          </div>
          <div className="absolute inset-0 z-10 overflow-hidden opacity-40">
            <BackgroundGrid />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none z-10" style={{ background: 'linear-gradient(0deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)' }} />
        </div>

        <div className="relative z-30 px-6 flex-1 flex flex-col justify-end pb-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome</h1>
            <p className="text-zinc-400">Sign in to start your closet journey</p>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800 px-4 py-3.5 flex items-center gap-3">
              <Phone className="w-5 h-5 text-zinc-500" />
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

            {error && <p className="text-red-500 text-sm px-1 font-medium">{error}</p>}

            <button
              onClick={handlePhoneLogin}
              disabled={isLoading || phoneNumber.length < 10}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#ff4d6d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#ff4d6d]/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span className="text-white">Continue</span><ChevronRight className="w-5 h-5 text-white" /></>}
            </button>
          </div>

          <p className="text-center text-[10px] text-zinc-500 mt-10 leading-relaxed">
            By signing in, you agree to our <button className="text-zinc-300 font-medium hover:underline">Terms of Service</button> and <button className="text-zinc-300 font-medium hover:underline">Privacy Policy</button>
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
