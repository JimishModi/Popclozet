import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, Product } from '@/types';
import { supabase } from '@/services/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { addMinutesToDate } from '@/utils/date';

interface CartContextType {
    items: CartItem[];
    loading: boolean;
    addToCart: (product: Product, size: string, rentalDays: number) => Promise<void>;
    removeFromCart: (itemId: string) => Promise<void>;
    clearCart: () => Promise<void>;
    getCartTotal: () => number;
    getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
};

const RESERVATION_MINUTES = parseInt(import.meta.env.VITE_CART_RESERVATION_MINUTES || '15');

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        if (user) {
            fetchCart();
        } else {
            setItems([]);
        }
    }, [user]);

    // Check for expired reservations
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            items.forEach((item) => {
                const expiryDate = new Date(item.reservation_expires_at);
                if (expiryDate <= now) {
                    removeFromCart(item.id);
                    showToast('Item reservation expired', 'warning');
                }
            });
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [items]);

    const fetchCart = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cart_items')
                .select(`
          *,
          product:products(*)
        `)
                .eq('id', user.id)

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching cart:', error);
            showToast('Failed to load cart', 'error');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = async (product: Product, size: string, rentalDays: number) => {
        if (!user) {
            showToast('Please login to add items to cart', 'warning');
            return;
        }

        try {
            const expiresAt = addMinutesToDate(new Date(), RESERVATION_MINUTES);

            const { error } = await supabase.from('cart_items').insert({
                user_id: user.id,
                product_id: product.id,
                size,
                rental_duration_days: rentalDays,
                reservation_expires_at: expiresAt.toISOString(),
            });

            if (error) throw error;

            showToast('Added to cart', 'success');
            await fetchCart();
        } catch (error: any) {
            console.error('Error adding to cart:', error);
            showToast(error.message || 'Failed to add to cart', 'error');
        }
    };

    const removeFromCart = async (itemId: string) => {
        try {
            const { error } = await supabase
                .from('cart_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;

            setItems((prev) => prev.filter((item) => item.id !== itemId));
            showToast('Removed from cart', 'info');
        } catch (error) {
            console.error('Error removing from cart:', error);
            showToast('Failed to remove item', 'error');
        }
    };

    const clearCart = async () => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('cart_items')
                .delete()
                .eq('id', user.id);

            if (error) throw error;

            setItems([]);
        } catch (error) {
            console.error('Error clearing cart:', error);
            showToast('Failed to clear cart', 'error');
        }
    };

    const getCartTotal = useCallback(() => {
        return items.reduce((total, item) => {
            return total + (item.product.rental_price * item.rental_duration_days);
        }, 0);
    }, [items]);

    const getCartCount = useCallback(() => {
        return items.length;
    }, [items]);

    return (
        <CartContext.Provider
            value={{
                items,
                loading,
                addToCart,
                removeFromCart,
                clearCart,
                getCartTotal,
                getCartCount,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};
