import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { motion } from 'framer-motion';
import { MobileShell } from '@/components/layout/MobileShell';
import logo from '@/logo/logo.png';

export const SignupPage: React.FC = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (formData.password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        setLoading(true);

        try {
            await signUp(formData.email, formData.password, formData.fullName, formData.phone);
            showToast('Account created successfully!', 'success');
            navigate('/');
        } catch (error: any) {
            showToast(error.message || 'Failed to create account', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MobileShell hideBottomNav className="bg-black">
            <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-y-auto">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff4d6d]/20 via-black to-purple-900/20 pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm relative z-10"
                >
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 mb-4">
                            <img src={logo} alt="popclozet" className="h-10 w-auto" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
                        <p className="text-zinc-400 text-sm">Join popclozet and start renting</p>
                    </div>

                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="text"
                                name="fullName"
                                label="Full Name"
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                            />

                            <Input
                                type="email"
                                name="email"
                                label="Email Address"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />

                            <Input
                                type="tel"
                                name="phone"
                                label="Phone Number"
                                placeholder="+91 98765 43210"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />

                            <Input
                                type="password"
                                name="password"
                                label="Password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                helperText="At least 6 characters"
                                required
                            />

                            <Input
                                type="password"
                                name="confirmPassword"
                                label="Confirm Password"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />

                            <Button type="submit" className="w-full" loading={loading}>
                                Create Account
                            </Button>
                        </form>

                        <div className="mt-5 text-center">
                            <p className="text-sm text-zinc-400">
                                Already have an account?{' '}
                                <Link to="/login" className="text-[#ff4d6d] hover:text-[#ff6b8a] font-medium">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </MobileShell>
    );
};
