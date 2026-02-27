/**
 * Auth Package - Session & Role Resolution
 *
 * @popclozet/auth v1.0.0
 */
import React from 'react';
import { User, Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@popclozet/domain-contracts';
interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}
export declare const useAuth: () => AuthContextType;
export declare const AuthProvider: React.FC<{
    children: React.ReactNode;
}>;
export declare const hasRole: (profile: UserProfile | null, expectedRole: UserRole) => boolean;
export declare const isWrongRole: (profile: UserProfile | null, expectedRole: UserRole) => boolean;
export {};
