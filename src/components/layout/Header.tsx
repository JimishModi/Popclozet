import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { motion } from 'framer-motion';

export const Header: React.FC = () => {
    const { user, signOut } = useAuth();
    const { getCartCount } = useCart();
    const navigate = useNavigate();
    const cartCount = getCartCount();

    const handleSignOut = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
            <div className="container-custom">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center">
                            <span className="text-white font-bold text-xl">P</span>
                        </div>
                        <span className="text-xl font-display font-bold text-gradient-red">PopClozet</span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link to="/products" className="text-gray-700 hover:text-primary-500 font-medium transition-colors">
                            Browse
                        </Link>
                        <Link to="/orders" className="text-gray-700 hover:text-primary-500 font-medium transition-colors">
                            My Orders
                        </Link>
                        <Link to="/profile" className="text-gray-700 hover:text-primary-500 font-medium transition-colors">
                            Profile
                        </Link>
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        {user ? (
                            <>
                                {/* Cart */}
                                <Link to="/cart" className="relative">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="p-2 text-gray-700 hover:text-primary-500 transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                            />
                                        </svg>
                                        {cartCount > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                {cartCount}
                                            </span>
                                        )}
                                    </motion.button>
                                </Link>

                                {/* Sign Out */}
                                <button
                                    onClick={handleSignOut}
                                    className="text-sm text-gray-700 hover:text-primary-500 font-medium transition-colors"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <Link to="/login">
                                <button className="btn-primary text-sm">Sign In</button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
