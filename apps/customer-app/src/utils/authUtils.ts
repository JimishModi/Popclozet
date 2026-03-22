import { User } from '@supabase/supabase-js';

// NOTE: Do NOT import useNavigate here — navigate is passed as a parameter

export const checkAndRoute = (
  user: User | null,
  profile: any | null,
  navigate: (path: string, options?: any) => void
) => {
  if (!user) {
    navigate('/auth/login');
    return;
  }

  if (!profile || !profile.onboarding_completed) {
    // Google users go to google-onboarding, phone users go to create-account
    const isGoogleUser = user.app_metadata?.provider === 'google';
    if (isGoogleUser) {
      navigate('/auth/google-onboarding', { replace: true });
    } else {
      navigate('/auth/create-account', { replace: true });
    }
    return;
  }

  // Fully onboarded — go home
  navigate('/home', { replace: true });
};
