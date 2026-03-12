import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { realtimeService } from '@/services/realtime';
import { getStaticMapUrl, shouldUseStaticFallback } from '@/services/mapbox/customer';
import { useToast } from '@/contexts/ToastContext';
import type { Order, ProximityState } from '@/types';
import { Loader } from '@/components/ui/Loader';
import { OrderTimeline } from '@/components/features/orders/OrderTimeline';
import { ETADisplay } from '@/components/features/orders/ETADisplay';
import { ProximityMapView } from '@/components/features/orders/ProximityMapView';
import { OTPModal } from '@/components/features/orders/OTPModal';
import { formatCurrency } from '@/utils/helpers';
import { motion } from 'framer-motion';

export const OrderTrackingPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [proximityState, setProximityState] = useState<ProximityState>({
        distance: Infinity,
        status: 'far',
        showMap: false,
    });
    const [showOTPModal, setShowOTPModal] = useState(false);
    const [mapLoadFailed, setMapLoadFailed] = useState(false);
    const { showToast } = useToast();

    // Phase 2: Static map URL for fallback
    const staticMapUrl = useMemo(() => {
        if (!order?.delivery_address) return undefined;
        return getStaticMapUrl(
            [order.delivery_address.longitude, order.delivery_address.latitude],
            14,
            400,
            200
        );
    }, [order?.delivery_address]);

    // Phase 2: Determine if we should use static fallback
    const useStaticMap = mapLoadFailed || shouldUseStaticFallback();

    useEffect(() => {
        if (id) {
            fetchOrder();
            subscribeToUpdates();
        }

        return () => {
            realtimeService.unsubscribeAll();
        };
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
          ),
          delivery_address:addresses(*)
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

    const subscribeToUpdates = () => {
        // Subscribe to order status updates
        realtimeService.subscribeToOrderUpdates(id!, (payload) => {
            console.log('Order updated:', payload);
            fetchOrder();
        });

        // Subscribe to proximity updates (rider distance)
        realtimeService.subscribeToProximityUpdates(id!, (payload) => {
            const { distance } = payload.payload;

            console.log('Rider distance update:', distance);

            // CRITICAL: Zepto-style proximity logic
            let status: ProximityState['status'] = 'far';
            let showMap = false;

            if (distance <= 100) {
                status = 'arrived';
                showMap = true;
                setShowOTPModal(true); // Show OTP modal when rider arrives
            } else if (distance <= 1000) {
                status = 'near';
                showMap = true; // Activate map when within 1km
            } else {
                status = 'far';
                showMap = false; // Hide map when far
            }

            setProximityState({ distance, status, showMap });
        });
    };

    const handleCancelOrder = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to cancel this order?\n\n' +
            'This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;

            showToast('Order cancelled successfully', 'info');
            fetchOrder(); // Refresh order data
        } catch (error: any) {
            console.error('Error cancelling order:', error);
            showToast(error.message || 'Failed to cancel order', 'error');
        }
    };

    const canCancelOrder = (status: string) => {
        return !['delivered', 'cancelled', 'returned'].includes(status);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading order..." />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Order not found</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-6 px-4">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                        Order Tracking
                    </h1>
                    <p className="text-zinc-500 text-sm">Order #{order.id.slice(0, 8)}</p>
                </div>
                {canCancelOrder(order.status) && (
                    <button
                        onClick={handleCancelOrder}
                        className="px-4 py-2 text-sm font-medium text-red-400 hover:text-white hover:bg-red-600 border-2 border-red-600 rounded-xl transition-all"
                    >
                        Cancel Order
                    </button>
                )}
            </div>

            <div className="space-y-5">
                {/* 
            CRITICAL ZEPTO-STYLE LOGIC:
            - Default view: ETA Display + Order Timeline (NO MAP)
            - Map activates ONLY when rider distance ≤ 1km
            - Map shows "arriving soon" when distance ≤ 100m
            - Map auto-destroys after delivery
          */}

                {/* ETA Display - Always visible when order is in transit */}
                {(order.status === 'dispatched' || order.status === 'out_for_delivery') && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <ETADisplay
                            eta={order.delivery_eta}
                            proximityStatus={proximityState.status}
                        />
                    </motion.div>
                )}

                {/* Proximity-Based Map - ONLY shows when rider is within 1km */}
                {/* Phase 2: Static map fallback on error or slow connection */}
                {proximityState.showMap && order.rider_id && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        {useStaticMap && staticMapUrl ? (
                            <div className="relative rounded-2xl overflow-hidden">
                                <img
                                    src={staticMapUrl}
                                    alt="Delivery location"
                                    className="w-full h-48 object-cover"
                                />
                                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    Live tracking unavailable
                                </div>
                            </div>
                        ) : (
                            <ProximityMapView
                                orderId={order.id}
                                riderId={order.rider_id}
                                customerLocation={{
                                    latitude: order.delivery_address.latitude,
                                    longitude: order.delivery_address.longitude,
                                }}
                                proximityStatus={proximityState.status}
                                onError={() => setMapLoadFailed(true)}
                            />
                        )}
                    </motion.div>
                )}

                {/* Order Timeline - Always visible */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <OrderTimeline status={order.status} />
                </motion.div>

                {/* Order Details */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
                >
                    <h2 className="text-lg font-semibold text-white mb-4">Order Details</h2>

                    <div className="space-y-4">
                        {order.items?.map((item: any) => (
                            <div key={item.id} className="flex gap-4">
                                <div className="w-16 h-20 bg-zinc-800 rounded-xl overflow-hidden">
                                    {item.product?.images?.[0] && (
                                        <img
                                            src={item.product.images[0]}
                                            alt={item.product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-white">{item.product?.name}</h3>
                                    <p className="text-sm text-zinc-400">Size: {item.size}</p>
                                    <p className="text-sm font-medium text-[#ff4d6d] mt-1">
                                        {formatCurrency(item.rental_price)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-white/10 mt-6 pt-4">
                        <div className="flex justify-between text-lg font-bold text-white">
                            <span>Total</span>
                            <span>{formatCurrency(order.total_amount)}</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* OTP Modal - Shows when rider arrives */}
            <OTPModal
                isOpen={showOTPModal}
                onClose={() => setShowOTPModal(false)}
                orderId={order.id}
                type="delivery"
            />
        </div>
    );
};
