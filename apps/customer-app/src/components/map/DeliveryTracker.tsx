// src/components/map/DeliveryTracker.tsx
// Real-time delivery tracking with live vehicle position

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock, MapPin, Phone, CheckCircle, Truck, Warehouse } from 'lucide-react';
import { InteractiveMap } from './InteractiveMap';
import { supabase } from '@popclozet/api-client';
import { getOrderById, DeliveryOrder, OrderStatus } from '@/services/deliveryService';
import { getHubById, RentalHub } from '@/services/hubService';
import { getTrackingRecord, TrackingRecord } from '@/services/trackingService';
import { calculateHaversineDistance as calculateDistance } from '@/lib/locationUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface DeliveryTrackerProps {
    orderId: string;
    className?: string;
    onOrderLoad?: (order: DeliveryOrder) => void;
    onTrackingUpdate?: (tracking: TrackingData) => void;
}

export interface TrackingData {
    current_lat: number;
    current_lng: number;
    driver_name?: string;
    vehicle_number?: string;
    rider_phone?: string;
    eta_minutes?: number;
}

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
    { status: 'confirmed', label: 'Order Confirmed', icon: <CheckCircle className="w-4 h-4" /> },
    { status: 'packed', label: 'Packed & Ready', icon: <Package className="w-4 h-4" /> },
    { status: 'rider_assigned', label: 'Rider Assigned', icon: <Truck className="w-4 h-4" /> },
    { status: 'order_picked_up', label: 'Picked Up from Hub', icon: <Warehouse className="w-4 h-4" /> },
    { status: 'out_for_delivery', label: 'On the Way', icon: <MapPin className="w-4 h-4" /> },
    { status: 'delivered', label: 'Delivered', icon: <CheckCircle className="w-4 h-4" /> },
];

// Map intermediate statuses to their display step
const STATUS_TO_STEP: Record<string, OrderStatus> = {
    pending: 'confirmed',
    confirmed: 'confirmed',
    preparing: 'packed',
    packed: 'packed',
    ready_for_pickup: 'packed',
    rider_assigned: 'rider_assigned',
    driver_arrived_warehouse: 'rider_assigned',
    order_picked_up: 'order_picked_up',
    dispatched: 'out_for_delivery',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
};

export function DeliveryTracker({ orderId, className, onOrderLoad, onTrackingUpdate }: DeliveryTrackerProps) {
    const [order, setOrder] = useState<DeliveryOrder | null>(null);
    const [hub, setHub] = useState<RentalHub | null>(null);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const channelNameRef = useRef(`tracking:${orderId}_${Math.random().toString(36).slice(2, 9)}`);

    useEffect(() => {
        if (order && onOrderLoad) onOrderLoad(order);
    }, [order]);

    useEffect(() => {
        if (tracking && onTrackingUpdate) onTrackingUpdate(tracking);
    }, [tracking]);

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

    // Subscribe to real-time tracking + order status updates
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
                    rider_phone: data.rider_phone || undefined,
                    eta_minutes: data.eta_minutes || undefined,
                });
            }
        });

        // Set up realtime subscription for both tracking and order status
        const channel = supabase
            .channel(channelNameRef.current)
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
                            rider_phone: data.rider_phone || undefined,
                            eta_minutes: data.eta_minutes || undefined,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`,
                },
                async () => {
                    // Re-fetch order so status steps update in real-time
                    const updated = await getOrderById(orderId);
                    if (updated) setOrder(updated);
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

    const mappedStatus = order?.status ? (STATUS_TO_STEP[order.status] || order.status) : undefined;
    const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === mappedStatus);
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

    const displayVehicle = tracking
        ? { lat: tracking.current_lat, lng: tracking.current_lng }
        : null;

    // Delayed if delivery address is outside 6km radius of warehouse (Hostel No 2, IIT Bombay)
    const distance = userLocation && hub
        ? calculateDistance(userLocation.lat, userLocation.lng, hub.lat, hub.lng)
        : null;
    const isDelayed = distance !== null ? distance > 6 : false;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
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
            {/* ETA Card - No Map */}
            {order.status === 'out_for_delivery' && (
                <div className="mb-6">
                    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
                        {/* Status badge */}
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 rounded-full bg-[#ff4d6d] animate-pulse" />
                            <span className="text-[#ff4d6d] text-[10px] font-black uppercase tracking-widest">
                                Live Tracking Active
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">
                                    {isDelayed ? "⚠️ Expected" : "⚡ Arriving in"}
                                </p>
                                <p className="text-4xl font-black text-white tracking-tighter">
                                    {isDelayed ? "Delayed Delivery" : "60 mins"}
                                </p>
                                {isDelayed && (
                                    <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-widest max-w-[200px]">
                                        Your address is {distance?.toFixed(1)}km from our warehouse. Delivery may take longer.
                                    </p>
                                )}
                            </div>
                            
                            <div className="w-16 h-16 rounded-2xl bg-[#ff4d6d]/10 flex items-center justify-center border border-[#ff4d6d]/20">
                                <Clock className="w-8 h-8 text-[#ff4d6d]" />
                            </div>
                        </div>

                        {/* Visual progress bar */}
                        <div className="mt-6 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: "0%" }}
                                animate={{ width: isDelayed ? "40%" : "75%" }}
                                className="h-full bg-gradient-to-r from-[#ff4d6d] to-[#ff8ba7]"
                            />
                        </div>
                    </div>
                </div>
            )}

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
                                            <span className="absolute inset-0 rounded-full bg-[#f2546d] animate-ping opacity-25" />
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
                        <MapPin className="w-5 h-5 text-[#f2546d] flex-shrink-0 mt-0.5" />
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
