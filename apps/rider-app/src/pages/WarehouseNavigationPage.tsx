/**
 * Warehouse Navigation Page
 * 
 * Multi-step flow:
 * 1. Navigate to warehouse using map
 * 2. Confirm arrival at warehouse
 * 3. Confirm order pickup
 * 4. Send message to customer
 * 5. Proceed to delivery navigation
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { supabase, transitionOrderState } from '@popclozet/api-client';
import { Loader } from '@popclozet/ui';
import {
    isMapboxAvailable,
    initializeMap,
    drawRoute,
} from '@popclozet/mapbox-core';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    markArrivedAtWarehouse,
    markOrderPickedUp,
    markAsDispatched,
    markAsOutForDelivery,
    sendMessageToCustomer,
    PREDEFINED_MESSAGES,
} from '@/services/riderOrderService';
import { MapPin, Navigation, Package, CheckCircle, MessageCircle, Truck, ChevronRight, X } from 'lucide-react';

// Warehouse location (PopClozet HQ)
const WAREHOUSE_LOCATION: [number, number] = [72.8567, 19.1234];
const WAREHOUSE_ADDRESS = 'PopClozet Warehouse, Near IIT Main Gate, Powai, Mumbai';

type PickupStep = 'navigating' | 'arrived' | 'picked_up' | 'dispatched' | 'out_for_delivery';

interface WarehouseOrder {
    id: string;
    status: string;
    user_id: string;
    total_amount?: number;
    addresses?: {
        full_address: string;
        latitude: number;
        longitude: number;
    }[];
    order_items?: Array<{ id: string; product_id: string; size?: string; rental_price?: number }>;
}

export const WarehouseNavigationPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    const [order, setOrder] = useState<WarehouseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [step, setStep] = useState<PickupStep>('navigating');
    const [actionLoading, setActionLoading] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageSent, setMessageSent] = useState(false);

    /* ---------- FETCH ORDER ---------- */
    useEffect(() => {
        if (!id) return;

        const fetchOrder = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, status, user_id, total_amount, addresses:delivery_address_id(full_address, latitude, longitude), order_items(*)')
                    .eq('id', id)
                    .single();

                if (error || !data) throw error;
                setOrder(data as unknown as WarehouseOrder);

                // Set step based on current status
                if (data.status === 'driver_arrived_warehouse') {
                    setStep('arrived');
                } else if (data.status === 'order_picked_up') {
                    setStep('picked_up');
                } else if (data.status === 'dispatched' || data.status === 'out_for_delivery') {
                    setStep('dispatched');
                }
            } catch (err) {
                console.error(err);
                showToast('Order not found', 'error');
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id, navigate, showToast]);

    /* ---------- GPS ---------- */
    const startNavigation = () => {
        if (!navigator.geolocation) {
            showToast('GPS not supported', 'error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setRiderLocation(coords);

                // High accuracy follow-up
                navigator.geolocation.getCurrentPosition(
                    (highPos) => {
                        setRiderLocation([highPos.coords.longitude, highPos.coords.latitude]);
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 15000 }
                );
            },
            () => showToast('Failed to get location', 'error'),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
    };

    /* ---------- INIT MAP ---------- */
    useEffect(() => {
        if (!order || !riderLocation || !mapRef.current) return;
        if (!isMapboxAvailable() || !import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) return;
        if (mapInstance.current) return;

        const map = initializeMap(
            mapRef.current, 
            riderLocation, 
            13
        );
        mapInstance.current = map;

        map.on('load', async () => {
            await drawRoute(map, riderLocation, WAREHOUSE_LOCATION);
            setMapReady(true);
        });
    }, [order?.id, riderLocation?.[0], riderLocation?.[1]]);

    /* ---------- ACTIONS ---------- */
    const handleConfirmArrival = async () => {
        console.log("👉 handleConfirmArrival clicked", { id, userId: user?.id });
        if (!id || !user?.id) return;
        setActionLoading(true);

        try {
            console.log("Calling markArrivedAtWarehouse...");
            const result = await markArrivedAtWarehouse(id, user.id);
            console.log("Result:", result);
            if (!result.success) throw new Error(result.message);

            setStep('arrived');
            showToast('Arrival confirmed! Proceed to pickup.', 'success');
        } catch (err: any) {
            console.error("❌ Error in handleConfirmArrival:", err);
            showToast(err.message || 'Failed to confirm arrival', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmPickup = async () => {
        if (!id || !user?.id) return;
        setActionLoading(true);

        try {
            const result = await markOrderPickedUp(id, user.id);
            if (!result.success) throw new Error(result.message);

            setStep('picked_up');
            showToast('Order picked up! Ready for dispatch.', 'success');

            // Notify customer
            if (order?.user_id) {
                const riderName = (profile as any)?.full_name || 'Your rider';
                const message = `${riderName} has collected your package and will deliver it shortly.`;
                await supabase.from('notifications').insert({
                    user_id: order.user_id,
                    type: 'order_picked_up',
                    title: '✅ Package picked up!',
                    body: message,
                    order_id: id,
                    is_read: false,
                });
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to confirm pickup', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartDelivery = async () => {
        if (!id || !user?.id) return;
        setActionLoading(true);

        try {
            const result = await markAsDispatched(id, user.id);
            if (!result.success) throw new Error(result.message);

            // Notify customer of dispatch
            if (order?.user_id) {
                const riderName = (profile as any)?.full_name || 'Your rider';
                const message = `${riderName} has picked up your package from the warehouse and is on the way.`;
                await supabase.from('notifications').insert({
                    user_id: order.user_id,
                    type: 'order_dispatched',
                    title: '📦 Your package has been dispatched!',
                    body: message,
                    order_id: id,
                    is_read: false,
                });
            }

            showToast('Dispatched! Waiting to start delivery.', 'success');
            setStep('dispatched');
        } catch (err: any) {
            showToast(err.message || 'Failed to dispatch', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOutForDelivery = async () => {
        if (!id || !user?.id) return;
        setActionLoading(true);

        try {
            const result = await markAsOutForDelivery(id, user.id);
            if (!result.success) throw new Error(result.message);

            // Notify customer of final delivery leg
            if (order?.user_id) {
                const riderName = (profile as any)?.full_name || 'Your rider';
                const message = `${riderName} is heading to your location with your package.`;
                await supabase.from('notifications').insert({
                    user_id: order.user_id,
                    type: 'out_for_delivery',
                    title: '🚗 Your package is on the way!',
                    body: message,
                    order_id: id,
                    is_read: false,
                });
            }

            showToast('Out for delivery! Heading to customer.', 'success');
            navigate(`/delivery/${id}`);
        } catch (err: any) {
            showToast(err.message || 'Failed to start delivery', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendMessage = async (message: string) => {
        if (!id || !order?.user_id) return;
        setActionLoading(true);

        try {
            const riderName = (profile as any)?.full_name;
            await sendMessageToCustomer(id, order.user_id, message, riderName);
            showToast('Message sent to customer!', 'success');
            setMessageSent(true);
            setShowMessageModal(false);
        } catch (err: any) {
            showToast('Failed to send message', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    /* ---------- RENDER ---------- */
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader size="lg" text="Loading warehouse pickup..." />
            </div>
        );
    }

    if (!order) return null;

    const stepConfig = {
        navigating: {
            badge: 'Navigate to Warehouse',
            badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
            icon: Navigation,
        },
        arrived: {
            badge: 'Arrived at Warehouse',
            badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            icon: MapPin,
        },
        picked_up: {
            badge: 'Order Picked Up',
            badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
            icon: Package,
        },
        dispatched: {
            badge: 'Package Dispatched',
            badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
            icon: Truck,
        },
        out_for_delivery: {
            badge: 'Out for Delivery',
            badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
            icon: Navigation,
        },
    };

    const currentStep = stepConfig[step];

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {/* Map */}
            <div ref={mapRef} className="flex-1" />

            {/* Start Navigation overlay */}
            {!riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                    <div className="text-center space-y-4 px-6">
                        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                            <Navigation size={36} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Navigate to Warehouse</h2>
                        <p className="text-zinc-400 text-sm">{WAREHOUSE_ADDRESS}</p>
                        <Button onClick={startNavigation} size="lg" className="w-full">
                            Start Navigation
                        </Button>
                    </div>
                </div>
            )}

            {/* Map Loading overlay */}
            {!mapReady && riderLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                    <Loader size="lg" text="Loading map..." />
                </div>
            )}

            {/* Bottom Action Panel */}
            <motion.div
                initial={{ y: 200 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute bottom-6 left-4 right-4 bg-[#0f0f0f] rounded-3xl border border-zinc-800/80 shadow-2xl z-20"
            >
                {/* Step Progress */}
                <div className="px-6 pt-5 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${currentStep.badgeColor}`}>
                            {currentStep.badge}
                        </span>
                        {order.total_amount && (
                            <span className="text-[10px] text-zinc-500 ml-auto">₹{order.total_amount}</span>
                        )}
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-1 mb-4">
                        {(['navigating', 'arrived', 'picked_up', 'dispatched', 'out_for_delivery'] as PickupStep[]).map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                                    ['navigating', 'arrived', 'picked_up', 'dispatched', 'out_for_delivery'].indexOf(step) >= i
                                        ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                                        : 'bg-zinc-800'
                                }`} />
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Warehouse Address */}
                    <div className="flex items-start gap-2 mb-4">
                        <MapPin size={14} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-zinc-400">{WAREHOUSE_ADDRESS}</p>
                    </div>

                    {/* Order ID */}
                    <p className="text-[10px] text-zinc-600 mb-3">Order #{order.id.slice(0, 8)}</p>
                </div>

                {/* Action Buttons */}
                <div className="px-6 pb-6 space-y-2.5">
                    <AnimatePresence mode="wait">
                        {step === 'navigating' && (
                            <motion.div key="arrive" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                <button
                                    onClick={handleConfirmArrival}
                                    disabled={actionLoading}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {actionLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            I've Arrived at Warehouse
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}

                        {step === 'arrived' && (
                            <motion.div key="pickup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
                                <button
                                    onClick={handleConfirmPickup}
                                    disabled={actionLoading}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {actionLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Package size={18} />
                                            Confirm Order Pickup
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}

                        {step === 'picked_up' && (
                            <motion.div key="dispatch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
                                <button
                                    onClick={handleStartDelivery}
                                    disabled={actionLoading}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {actionLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Truck size={18} />
                                            Start Delivery
                                            <ChevronRight size={16} />
                                        </>
                                    )}
                                </button>

                                {/* Send Message to Customer */}
                                <button
                                    onClick={() => setShowMessageModal(true)}
                                    disabled={messageSent}
                                    className={`w-full py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                                        messageSent
                                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                            : 'border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800'
                                    }`}
                                >
                                    <MessageCircle size={16} />
                                    {messageSent ? 'Message Sent ✓' : 'Send Message to Customer'}
                                </button>
                            </motion.div>
                        )}

                        {step === 'dispatched' && (
                            <motion.div key="out-for-delivery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
                                <button
                                    onClick={handleOutForDelivery}
                                    disabled={actionLoading}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {actionLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Navigation size={18} />
                                            Mark as Out for Delivery
                                            <ChevronRight size={16} />
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setShowMessageModal(true)}
                                    disabled={messageSent}
                                    className={`w-full py-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                                        messageSent
                                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                            : 'border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800'
                                    }`}
                                >
                                    <MessageCircle size={16} />
                                    {messageSent ? 'Message Sent ✓' : 'Send Message to Customer'}
                                </button>
                            </motion.div>
                        )}

                        {step === 'out_for_delivery' && (
                            <motion.div key="delivery-nav" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2.5">
                                <button
                                    onClick={() => navigate(`/delivery/${id}`)}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                >
                                    <Truck size={18} />
                                    Continue Delivery Navigation
                                    <ChevronRight size={16} />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Message Modal */}
            <AnimatePresence>
                {showMessageModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 z-50 flex items-end"
                        onClick={() => setShowMessageModal(false)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full bg-[#0f0f0f] rounded-t-3xl border-t border-zinc-800/50 p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-bold text-base">Send to Customer</h3>
                                <button
                                    onClick={() => setShowMessageModal(false)}
                                    className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center"
                                >
                                    <X size={16} className="text-zinc-400" />
                                </button>
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {PREDEFINED_MESSAGES.map((msg, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSendMessage(msg)}
                                        disabled={actionLoading}
                                        className="w-full text-left py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {msg}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WarehouseNavigationPage;
