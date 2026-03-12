import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useToast } from '@/contexts/ToastContext';
import type { Order, Address } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { motion } from 'framer-motion';

export const ReturnPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [order, setOrder] = useState<Order | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [returnForm, setReturnForm] = useState({
        reason: '',
        pickup_address_id: '',
        pickup_slot: '',
    });

    useEffect(() => {
        if (id) {
            fetchOrder();
            fetchAddresses();
        }
    }, [id]);

    const fetchOrder = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
          *,
          items:order_items(
            *,
            product:products(*)
          )
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setOrder(data);
        } catch (error) {
            console.error('Error fetching order:', error);
            showToast('Failed to load order', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchAddresses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('addresses')
                .select('*')
                .eq('id', user.id)
                .order('is_default', { ascending: false });

            if (error) throw error;
            setAddresses(data || []);

            // Set default address
            const defaultAddr = data?.find((addr) => addr.is_default);
            if (defaultAddr) {
                setReturnForm((prev) => ({ ...prev, pickup_address_id: defaultAddr.id }));
            }
        } catch (error) {
            console.error('Error fetching addresses:', error);
        }
    };

    const handleSubmitReturn = async () => {
        if (!returnForm.reason || !returnForm.pickup_address_id || !returnForm.pickup_slot) {
            showToast('Please fill all fields', 'warning');
            return;
        }

        setSubmitting(true);

        try {
            const { error } = await supabase.from('return_requests').insert({
                order_id: id,
                reason: returnForm.reason,
                pickup_address_id: returnForm.pickup_address_id,
                pickup_slot: returnForm.pickup_slot,
                status: 'requested',
            });

            if (error) throw error;

            // Update order status
            await supabase
                .from('orders')
                .update({ status: 'return_requested' })
                .eq('id', id);

            showToast('Return request submitted successfully', 'success');
            navigate(`/orders/${id}`);
        } catch (error: any) {
            console.error('Error submitting return:', error);
            showToast(error.message || 'Failed to submit return request', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader size="lg" text="Loading..." />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Order not found</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container-custom max-w-2xl">
                <h1 className="text-3xl font-display font-bold text-gray-900 mb-8">Request Return</h1>

                <div className="space-y-6">
                    {/* Order Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card"
                    >
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
                        <p className="text-sm text-gray-600">Order #{order.id.slice(0, 8)}</p>
                        <div className="mt-4 space-y-2">
                            {order.items?.map((item: any) => (
                                <div key={item.id} className="flex gap-3">
                                    <div className="w-16 h-20 bg-gray-100 rounded overflow-hidden">
                                        {item.product?.images?.[0] && (
                                            <img
                                                src={item.product.images[0]}
                                                alt={item.product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{item.product?.name}</p>
                                        <p className="text-sm text-gray-600">Size: {item.size}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Return Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="card"
                    >
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">Return Information</h2>

                        <div className="space-y-4">
                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason for Return
                                </label>
                                <select
                                    className="input-field"
                                    value={returnForm.reason}
                                    onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                                >
                                    <option value="">Select reason</option>
                                    <option value="wrong_size">Wrong Size</option>
                                    <option value="damaged">Damaged Item</option>
                                    <option value="not_as_described">Not as Described</option>
                                    <option value="changed_mind">Changed Mind</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            {/* Pickup Address */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pickup Address
                                </label>
                                <select
                                    className="input-field"
                                    value={returnForm.pickup_address_id}
                                    onChange={(e) =>
                                        setReturnForm({ ...returnForm, pickup_address_id: e.target.value })
                                    }
                                >
                                    <option value="">Select address</option>
                                    {addresses.map((address) => (
                                        <option key={address.id} value={address.id}>
                                            {address.label} - {address.full_address}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Pickup Slot */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Preferred Pickup Time
                                </label>
                                <input
                                    type="datetime-local"
                                    className="input-field"
                                    value={returnForm.pickup_slot}
                                    onChange={(e) => setReturnForm({ ...returnForm, pickup_slot: e.target.value })}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>

                            <Button
                                onClick={handleSubmitReturn}
                                className="w-full"
                                size="lg"
                                loading={submitting}
                            >
                                Submit Return Request
                            </Button>
                        </div>
                    </motion.div>

                    {/* Info */}
                    <div className="card bg-blue-50 border-blue-200">
                        <h3 className="font-semibold text-blue-900 mb-2">Return Process</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Our rider will pick up the items at your chosen time</li>
                            <li>• You'll receive an OTP to confirm the pickup</li>
                            <li>• Refund will be processed within 3-5 business days</li>
                            <li>• Deposit will be refunded after quality check</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
