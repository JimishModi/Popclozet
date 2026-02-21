// src/components/map/DeliveryTracker.tsx
// Real-time delivery tracking with live vehicle position

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock, MapPin, Phone, CheckCircle } from 'lucide-react';
import { InteractiveMap } from './InteractiveMap';
import { supabase } from '@popclozet/api-client';
import { getOrderById, DeliveryOrder, OrderStatus } from '@/services/deliveryService';
import { getHubById, RentalHub } from '@/services/hubService';
import { useDriverSimulation } from '@/hooks/useDriverSimulation';
import { getTrackingRecord, TrackingRecord } from '@/services/trackingService';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface DeliveryTrackerProps {
    orderId: string;
    className?: string;
}

interface TrackingData {
    current_lat: number;
    current_lng: number;
    driver_name?: string;
    vehicle_number?: string;
    eta_minutes?: number;
}

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
    { status: 'confirmed', label: 'Order Confirmed', icon: <CheckCircle className="w-4 h-4" /> },
    { status: 'preparing', label: 'Preparing', icon: <Package className="w-4 h-4" /> },
    { status: 'out_for_delivery', label: 'On the Way', icon: <MapPin className="w-4 h-4" /> },
    { status: 'delivered', label: 'Delivered', icon: <CheckCircle className="w-4 h-4" /> },
];

export function DeliveryTracker({ orderId, className }: DeliveryTrackerProps) {
    const [order, setOrder] = useState<DeliveryOrder | null>(null);
    const [hub, setHub] = useState<RentalHub | null>(null);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Fetch order and hub data
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            const orderData = await getOrderById(orderId);
            setOrder(orderData);

            if (orderData?.hub_id) {
                const hubData = await getHubById(orderData.hub_id);
                setHub(hubData);
            }
            setIsLoading(false);
        }

        loadData();
    }, [orderId]);

    // Subscribe to real-time tracking updates
    useEffect(() => {
        if (!supabase || !orderId) return;

        // Initial fetch using service
        getTrackingRecord(orderId).then((data) => {
            if (data) {
                setTracking({
                    current_lat: data.current_lat,
                    current_lng: data.current_lng,
                    driver_name: data.driver_name || undefined,
                    vehicle_number: data.vehicle_number || undefined,
                    eta_minutes: data.eta_minutes || undefined,
                });
            }
        });

        // Set up realtime subscription
        const channel = supabase
            .channel(`tracking:${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'delivery_tracking',
                    filter: `order_id=eq.${orderId}`,
                },
                async (payload) => {
                    const data = payload.new as TrackingRecord;
                    if (data.is_active) {
                        setTracking({
                            current_lat: data.current_lat,
                            current_lng: data.current_lng,
                            driver_name: data.driver_name || undefined,
                            vehicle_number: data.vehicle_number || undefined,
                            eta_minutes: data.eta_minutes || undefined,
                        });
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [orderId]);

    const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order?.status);
    const userLocation = order?.delivery_address_snapshot
        ? { lat: order.delivery_address_snapshot.lat, lng: order.delivery_address_snapshot.lng }
        : null;

    // Determine route direction based on order type
    // For delivery: hub -> user
    // For pickup/return: user -> hub
    const routeOrigin = order?.order_type === 'delivery'
        ? (hub ? { lat: hub.lat, lng: hub.lng } : null)
        : userLocation;
    const routeDestination = order?.order_type === 'delivery'
        ? userLocation
        : (hub ? { lat: hub.lat, lng: hub.lng } : null);

    // Simulation hook logic - only active when no real tracking data and order is in transit
    const shouldSimulate = !tracking && !!order && !!hub && !!routeOrigin && !!routeDestination;
    const isTransitStatus = ['preparing', 'out_for_delivery', 'pickup_scheduled'].includes(order.status || '');

    const { vehicleLocation: simulatedVehicle, routePath } = useDriverSimulation({
        origin: routeOrigin,
        destination: routeDestination,
        isActive: shouldSimulate && isTransitStatus
    });

    const displayVehicle = tracking
        ? { lat: tracking.current_lat, lng: tracking.current_lng }
        : simulatedVehicle;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[#ff4d6d] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-8">
                <p className="text-zinc-400">Order not found</p>
            </div>
        );
    }

    return (
        <div className={className}>
            {/* Map */}
            <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <InteractiveMap
                    center={displayVehicle || userLocation || undefined}
                    zoom={14}
                    darkMode
                    userLocation={userLocation}
                    hubs={hub ? [hub] : []}
                    routePath={routePath}
                    vehicleLocation={displayVehicle}
                    trackerMode={!!displayVehicle && order.status === 'out_for_delivery'}
                />

                {/* Live ETA overlay */}
                {(tracking?.eta_minutes || simulatedVehicle) && order.status === 'out_for_delivery' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-4 left-4 right-4"
                    >
                        <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-zinc-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-400">Arriving in</p>
                                    <p className="text-2xl font-bold text-white">
                                        {tracking?.eta_minutes || 15} mins
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="text-sm text-white font-medium">
                                            {tracking?.driver_name || 'Ravi Kumar'}
                                        </p>
                                        <p className="text-xs text-zinc-400">
                                            {tracking?.vehicle_number || 'MH-02-AB-1234'}
                                        </p>
                                    </div>
                                    <button className="p-2 rounded-full bg-[#ff4d6d]">
                                        <Phone className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Status timeline */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-4">Order Status</h3>
                <div className="relative">
                    {/* Progress line */}
                    <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-zinc-800" />
                    <motion.div
                        className="absolute left-[18px] top-6 w-0.5 bg-[#ff4d6d]"
                        initial={{ height: 0 }}
                        animate={{
                            height: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%`,
                        }}
                        transition={{ duration: 0.5 }}
                    />

                    {/* Steps */}
                    <div className="space-y-6">
                        {STATUS_STEPS.map((step, index) => {
                            const isActive = index <= currentStepIndex;
                            const isCurrent = index === currentStepIndex;

                            return (
                                <div key={step.status} className="flex items-center gap-4">
                                    <div
                                        className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isActive
                                            ? 'bg-[#ff4d6d] text-white'
                                            : 'bg-zinc-800 text-zinc-500'
                                            }`}
                                    >
                                        {step.icon}
                                        {isCurrent && (
                                            <span className="absolute inset-0 rounded-full bg-[#ff4d6d] animate-ping opacity-25" />
                                        )}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                                            {step.label}
                                        </p>
                                        {isCurrent && order.estimated_delivery_at && (
                                            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                                                <Clock className="w-3 h-3" />
                                                ETA: {new Date(order.estimated_delivery_at).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Delivery address */}
            {order.delivery_address_snapshot && (
                <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-[#ff4d6d] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-white">Delivery Address</p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                {order.delivery_address_snapshot.full_address}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DeliveryTracker;
