/**
 * Delivery Navigation Page
 * 
 * Phase 4 Finalization: Turn-by-turn navigation for active delivery
 * 
 * Uses Mapbox delivery service (navigation-focused)
 * Submits rider location telemetry
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { useToast } from '@/contexts/ToastContext';
import { transitionOrderState } from '@/services/orderStateMachine';
import { initDeliveryNavigationMap, addRiderMarker, updateRiderLocation } from '@/services/mapbox/delivery';
import { isMapboxAvailable } from '@/services/mapbox/core';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';

interface DeliveryOrder {
    id: string;
    status: string;
    delivery_address: {
        full_address: string;
        latitude: number;
        longitude: number;
    };
    otp_delivery?: string;
}

export const DeliveryNavigationPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const mapContainer = useRef<HTMLDivElement>(null);
    const [order, setOrder] = useState<DeliveryOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const locationWatchId = useRef<number | null>(null);

    // Fetch order details
    useEffect(() => {
        if (!id) return;

        const fetchOrder = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select(`
                        id, status, otp_delivery,
                        delivery_address:addresses(full_address, latitude, longitude)
                    `)
                    .eq('id', id)
                    .single();

                if (error) throw error;

                setOrder({
                    ...data,
                    delivery_address: Array.isArray(data.delivery_address)
                        ? data.delivery_address[0]
                        : data.delivery_address
                });
            } catch (error) {
                console.error('Error fetching order:', error);
                showToast('Order not found', 'error');
                navigate('/rider');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id, navigate, showToast]);

    // Start location tracking
    useEffect(() => {
        if (!navigator.geolocation) return;

        // Get initial location
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setRiderLocation([pos.coords.longitude, pos.coords.latitude]);
            },
            (err) => console.error('Geolocation error:', err),
            { enableHighAccuracy: true }
        );

        // Watch location
        locationWatchId.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setRiderLocation(coords);
                updateRiderLocation(coords);

                // Submit telemetry to backend
                if (user?.id) {
                    await supabase.from('rider_locations').insert({
                        rider_id: user.id,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy_meters: pos.coords.accuracy,
                        confidence: pos.coords.accuracy < 20 ? 1.0 : pos.coords.accuracy < 50 ? 0.8 : 0.5,
                        source: 'foreground',
                    });
                }
            },
            (err) => console.error('Geolocation watch error:', err),
            { enableHighAccuracy: true, maximumAge: 5000 }
        );

        return () => {
            if (locationWatchId.current) {
                navigator.geolocation.clearWatch(locationWatchId.current);
            }
        };
    }, [user?.id]);

    // Initialize map when data is ready
    useEffect(() => {
        if (!order?.delivery_address || !riderLocation || !mapContainer.current) return;
        if (!isMapboxAvailable()) return;

        const initMap = async () => {
            const map = await initDeliveryNavigationMap(
                mapContainer.current!,
                riderLocation,
                [order.delivery_address.longitude, order.delivery_address.latitude]
            );

            if (map) {
                addRiderMarker(map, riderLocation);
                setMapReady(true);
            }
        };

        initMap();
    }, [order?.delivery_address, riderLocation]);

    const handleMarkDelivered = async () => {
        if (!id || !user?.id) return;

        // If OTP is required, show input
        if (order?.otp_delivery && !showOtpInput) {
            setShowOtpInput(true);
            return;
        }

        // Verify OTP if provided
        if (order?.otp_delivery && otpInput !== order.otp_delivery) {
            showToast('Incorrect OTP', 'error');
            return;
        }

        try {
            const result = await transitionOrderState(id, 'delivered', 'rider', user.id);

            if (!result.success) {
                throw new Error(result.message || 'Failed to complete delivery');
            }

            showToast('Delivery completed!', 'success');
            navigate('/rider');
        } catch (error: any) {
            showToast(error.message || 'Failed to complete delivery', 'error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading delivery..." />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <p className="text-zinc-400">Order not found</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black via-black/80 to-transparent p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/rider')}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white">Delivery Navigation</h1>
                        <p className="text-xs text-zinc-400">#{id?.slice(0, 8)}</p>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div ref={mapContainer} className="flex-1">
                {!mapReady && !isMapboxAvailable() && (
                    <div className="h-full flex flex-col items-center justify-center bg-zinc-900 p-6">
                        <span className="text-4xl mb-4">🗺️</span>
                        <p className="text-zinc-400 text-center">Map not available</p>
                        <p className="text-zinc-500 text-sm text-center mt-1">
                            Navigate to the address manually
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Panel */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-3xl border-t border-white/10 p-6"
            >
                <div className="mb-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Destination</p>
                    <p className="text-white font-medium line-clamp-2">
                        {order.delivery_address?.full_address || 'Address not available'}
                    </p>
                </div>

                {showOtpInput ? (
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            placeholder="Enter delivery OTP"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-widest placeholder:text-zinc-500 focus:border-[#ff4d6d]/50 focus:outline-none"
                            maxLength={6}
                        />
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setShowOtpInput(false)}
                                variant="outline"
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleMarkDelivered}
                                className="flex-1"
                            >
                                Verify & Complete
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button
                        onClick={handleMarkDelivered}
                        className="w-full"
                        size="lg"
                    >
                        {order.otp_delivery ? 'Enter OTP & Complete' : 'Mark as Delivered'}
                    </Button>
                )}
            </motion.div>

            {/* Loading overlay */}
            {!mapReady && isMapboxAvailable() && (
                <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
                    <Loader size="lg" text="Loading navigation..." />
                </div>
            )}
        </div>
    );
};
