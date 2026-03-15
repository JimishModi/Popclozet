import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { motion } from 'framer-motion';
import { MobileShell } from '@/components/layout/MobileShell';
import logo from '@/logo/logo.png';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as any)?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await signIn(email, password);
            showToast('Welcome back!', 'success');
            navigate(from, { replace: true });
        } catch (error: any) {
            showToast(error.message || 'Failed to sign in', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MobileShell hideBottomNav className="bg-black">
            <div className="flex-1 flex items-center justify-center px-4 py-12">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff4d6d]/20 via-black to-purple-900/20 pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm relative z-10"
                >
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 mb-6">
                            <img src={logo} alt="PopClozet" className="h-10 w-auto" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                        <p className="text-zinc-400">Sign in to continue your fashion journey</p>
                    </div>

                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Input
                                type="email"
                                label="Email Address"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <Input
                                type="password"
                                label="Password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            <Button type="submit" className="w-full" loading={loading}>
                                Sign In
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-zinc-400">
                                Don't have an account?{' '}
                                <Link to="/signup" className="text-[#ff4d6d] hover:text-[#ff6b8a] font-medium">
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </MobileShell>
    );
};