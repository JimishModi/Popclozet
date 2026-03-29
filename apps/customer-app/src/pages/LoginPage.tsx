import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MobileShell } from '@/components/layout/MobileShell';
import { useAuth } from '@/context/SupabaseAuthContext';
import { loadAndInitMsg91, sendOtp } from '@/services/msg91OtpService';
import logoImage from '@/logo/logo.png';
import { Loader2, ChevronRight, Phone } from 'lucide-react';

import imgCasuals from '@/moodboards/casuals.jpg';
import imgCocktail from '@/moodboards/cocktail.jpg';
import imgFormal from '@/moodboards/formal.jpg';
import imgParty from '@/moodboards/party.jpg';
import imgStreetwear from '@/moodboards/streetwear.jpg';
import imgVacation from '@/moodboards/vacation.jpg';
import imgBusiness from '@/assets/hero-business.png';
import imgWedding from '@/assets/hero-wedding.png';
import imgHeroParty from '@/assets/hero-party.png';
import imgHeroVacation from '@/assets/hero-vacation.png';
import imgTrendy from '@/assets/trendy-outfits.webp';
import imgStoryChoice from '@/assets/story-choice.png';

const columns = [
  [imgCasuals, imgCocktail, imgFormal, imgParty, imgStreetwear, imgVacation],
  [imgBusiness, imgWedding, imgHeroParty, imgHeroVacation, imgTrendy, imgStoryChoice],
  [imgParty, imgFormal, imgVacation, imgCasuals, imgCocktail, imgStreetwear],
  [imgHeroVacation, imgTrendy, imgBusiness, imgStoryChoice, imgWedding, imgHeroParty],
];

function ScrollingPhotoGrid() {
  return (
    <div className="absolute inset-0 flex gap-1.5 px-1.5 overflow-hidden">
      {columns.map((imgs, colIdx) => {
        const isUp = colIdx % 2 === 0;
        const durations = ['28s', '32s', '26s', '34s'];
        return (
          <div key={colIdx} className="flex-1 overflow-hidden relative">
            <div
              className="flex flex-col gap-1.5"
              style={{
                animation: `${isUp ? 'scrollUp' : 'scrollDown'} ${durations[colIdx]} linear infinite`,
              }}
            >
              {[...imgs, ...imgs].map((src, i) => (
                <div
                  key={i}
                  className="w-full rounded-lg overflow-hidden flex-shrink-0"
                  style={{ aspectRatio: '3 / 4' }}
                >
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes scrollDown {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
      `}</style>
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
        <Loader2 className="w-8 h-8 text-[#f2546d] animate-spin" />
      </div>
    );
  }

  return (
    <MobileShell className="bg-[#1a1a1a] text-white" hideBottomNav hideGlow>
      <div className="flex flex-col min-h-screen">
        <div className="relative h-[45vh] overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <img src={logoImage} alt="Popclozet" className="h-14 drop-shadow-2xl" style={{ filter: 'drop-shadow(0 0 20px rgba(242,84,109,0.4))' }} />
          </div>
          <div className="absolute inset-0 z-10 overflow-hidden opacity-50">
            <ScrollingPhotoGrid />
          </div>
          <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(ellipse at center 40%, transparent 0%, rgba(26,26,26,0.6) 70%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-48 pointer-events-none z-10" style={{ background: 'linear-gradient(0deg, #1a1a1a 0%, rgba(26,26,26,0.8) 50%, rgba(26,26,26,0) 100%)' }} />
          <div className="absolute inset-x-0 top-0 h-20 pointer-events-none z-10" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, rgba(26,26,26,0) 100%)' }} />
        </div>

        <div className="relative z-30 px-6 flex-1 flex flex-col justify-end pb-12">
          <div className="mb-8">
            <p className="text-sm font-medium text-[#f2546d] tracking-widest uppercase mb-2">Welcome to</p>
            <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">Popclozet</h1>
            <p className="text-zinc-400 text-[15px]">Rent stunning outfits for every occasion</p>
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
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#f2546d] to-pink-500 text-white font-bold text-base shadow-lg shadow-[#f2546d]/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span className="text-white">Continue</span><ChevronRight className="w-5 h-5 text-white" /></>}
            </button>

            <button
              onClick={() => navigate('/home')}
              className="w-full py-2 text-zinc-400 text-sm font-semibold hover:text-white transition-colors"
            >
              Browse without sign in
            </button>
          </div>

          <p className="text-center text-[10px] text-zinc-500 mt-10 leading-relaxed">
            By signing in, you agree to our <Link to="/terms" className="text-zinc-300 font-medium hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-zinc-300 font-medium hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
