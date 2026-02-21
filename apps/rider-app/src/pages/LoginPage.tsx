/**
 * Login Page
 * 
 * Rider authentication page
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export function LoginPage() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await signIn(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err?.message || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            {/* Header with logo */}
            <header className="flex items-center justify-center pt-12 pb-8">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-3"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white text-xl font-bold">Q</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Qikwil Rider</h1>
                        <p className="text-xs text-zinc-500">Delivery Partner</p>
                    </div>
                </motion.div>
            </header>

            {/* Form */}
            <main className="flex-1 px-6">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="max-w-sm mx-auto"
                >
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                        <p className="text-zinc-400 mt-1">Login to continue delivering</p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm"
                        >
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email input */}
                        <div className="space-y-1.5">
                            <label className="text-sm text-zinc-400">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className={clsx(
                                        "w-full h-12 pl-10 pr-4 rounded-xl",
                                        "bg-zinc-900 border border-zinc-800",
                                        "text-white placeholder:text-zinc-600",
                                        "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30",
                                        "transition-colors"
                                    )}
                                />
                            </div>
                        </div>

                        {/* Password input */}
                        <div className="space-y-1.5">
                            <label className="text-sm text-zinc-400">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    className={clsx(
                                        "w-full h-12 pl-10 pr-12 rounded-xl",
                                        "bg-zinc-900 border border-zinc-800",
                                        "text-white placeholder:text-zinc-600",
                                        "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30",
                                        "transition-colors"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Forgot password */}
                        <div className="text-right">
                            <Link
                                to="/forgot-password"
                                className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit button */}
                        <motion.button
                            type="submit"
                            disabled={isLoading}
                            whileTap={{ scale: 0.98 }}
                            className={clsx(
                                "w-full h-12 rounded-xl font-semibold",
                                "bg-gradient-to-r from-blue-500 to-blue-600",
                                "text-white shadow-lg shadow-blue-500/25",
                                "hover:shadow-blue-500/40 transition-shadow",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "flex items-center justify-center gap-2"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Logging in...</span>
                                </>
                            ) : (
                                <span>Login</span>
                            )}
                        </motion.button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-8">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-sm text-zinc-500">or</span>
                        <div className="flex-1 h-px bg-zinc-800" />
                    </div>

                    {/* Sign up link */}
                    <p className="text-center text-zinc-400">
                        New to Qikwil?{' '}
                        <Link to="/signup" className="text-blue-500 font-medium hover:text-blue-400 transition-colors">
                            Sign up as a rider
                        </Link>
                    </p>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-xs text-zinc-600">
                <p>By logging in, you agree to our Terms of Service</p>
            </footer>
        </div>
    );
}

export default LoginPage;
