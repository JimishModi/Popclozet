
import { useAuth as useContextAuth } from '../context/SupabaseAuthContext';

// Re-export the hook from the context for cleaner imports
export const useAuth = useContextAuth;
