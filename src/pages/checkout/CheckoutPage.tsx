import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/services/supabase';
import type { Address } from '@/types';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { formatCurrency } from '@/utils/helpers';
import { motion } from 'framer-motion';

export const CheckoutPage: React.FC = () => {
    const { items, getCartTotal, clearCart } = useCart();
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddress, setSelectedAddress] = useState<string>('');
    const [rentalStartDate, setRentalStartDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [placing, setPlacing] = useState(false);

    useEffect(() => {
        if (items.length === 0) {
            navigate('/cart');
            return;
        }
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('id', user.id)
                .order('is_default', { ascending: false });

            if (error) throw error;
            setAddresses(data || []);

            // Select default address
            const defaultAddr = data?.find((addr) => addr.is_default);
            if (defaultAddr) {
                setSelectedAddress(defaultAddr.id);
            }
        } catch (error) {
            console.error('Error fetching addresses:', error);
            showToast('Failed to load addresses', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceOrder = async () => {
        if (!selectedAddress) {
            showToast('Please select a delivery address', 'warning');
            return;
        }

        if (!rentalStartDate) {
            showToast('Please select rental start date', 'warning');
            return;
        }

        setPlacing(true);

        try {
            const address = addresses.find((a) => a.id === selectedAddress);
            if (!address) throw new Error('Address not found');

            // Calculate totals
            const rentalTotal = getCartTotal();
            const depositTotal = items.reduce((sum, item) => sum + item.product.deposit_amount, 0);
            const totalAmount = rentalTotal + depositTotal;

            // Create order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user!.id,
                    delivery_address_id: selectedAddress,
                    rental_start_date: rentalStartDate,
                    total_amount: rentalTotal,
                    deposit_amount: depositTotal,
                    status: 'pending',
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Create order items
            const orderItems = items.map((item) => ({
                order_id: order.id,
                product_id: item.product_id,
                size: item.size,
                rental_price: item.product.rental_price,
                deposit_amount: item.product.deposit_amount,
                rental_duration_days: item.rental_duration_days,
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Clear cart
            await clearCart();

            showToast('Order placed successfully!', 'success');
            navigate(`/orders/${order.id}`);
        } catch (error: any) {
            console.error('Error placing order:', error);
            showToast(error.message || 'Failed to place order', 'error');
        } finally {
            setPlacing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading checkout..." />
            </div>
        );
    }

    const subtotal = getCartTotal();
    const deposit = items.reduce((sum, item) => sum + item.product.deposit_amount, 0);
    const total = subtotal + deposit;

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
            <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>

            <div className="space-y-5">
                {/* Delivery Address */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Delivery Address</h2>

                    {addresses.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-zinc-400 mb-4">No addresses found</p>
                            <Button onClick={() => navigate('/profile')}>Add Address</Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {addresses.map((address) => (
                                <label
                                    key={address.id}
                                    className={`
                                        block p-4 border-2 rounded-xl cursor-pointer transition-all
                                        ${selectedAddress === address.id
                                            ? 'border-[#ff4d6d] bg-[#ff4d6d]/10'
                                            : 'border-white/10 hover:border-white/20'
                                        }
                                    `}
                                >
                                    <input
                                        type="radio"
                                        name="address"
                                        value={address.id}
                                        checked={selectedAddress === address.id}
                                        onChange={(e) => setSelectedAddress(e.target.value)}
                                        className="sr-only"
                                    />
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-white">{address.label}</p>
                                            <p className="text-sm text-zinc-400 mt-1">{address.full_address}</p>
                                        </div>
                                        {address.is_default && (
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">Default</span>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Rental Period */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Rental Period</h2>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={rentalStartDate}
                            onChange={(e) => setRentalStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-[#ff4d6d]/50 focus:outline-none focus:ring-2 focus:ring-[#ff4d6d]/20 transition-all"
                            required
                        />
                    </div>
                </motion.div>

                {/* Order Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>

                    <div className="space-y-3 mb-6">
                        {items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-zinc-300">
                                    {item.product.name} ({item.size}) × {item.rental_duration_days} days
                                </span>
                                <span className="font-medium text-white">
                                    {formatCurrency(item.product.rental_price * item.rental_duration_days)}
                                </span>
                            </div>
                        ))}

                        <div className="border-t border-white/10 pt-3 space-y-2">
                            <div className="flex justify-between text-zinc-300">
                                <span>Rental Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                                <span>Refundable Deposit</span>
                                <span>{formatCurrency(deposit)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                                <span>Delivery</span>
                                <span className="text-green-400">FREE</span>
                            </div>
                            <div className="border-t border-white/10 pt-3">
                                <div className="flex justify-between text-lg font-bold text-white">
                                    <span>Total</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handlePlaceOrder}
                        className="w-full"
                        size="lg"
                        loading={placing}
                        disabled={!selectedAddress || !rentalStartDate}
                    >
                        Place Order
                    </Button>

                    <p className="text-xs text-zinc-500 text-center mt-4">
                        Deposit will be refunded after successful return
                    </p>
                </motion.div>
            </div>
        </div>
    );
};
