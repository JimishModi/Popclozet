/**
 * Delivery Navigation Page
 * Production-safe Mapbox navigation for rider
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
import { motion } from 'framer-motion';

interface DeliveryOrder {
  id: string;
  status: string;
  otp_delivery?: string;
  delivery_address_snapshot: {
    full_address: string;
    lat: number;
    lng: number;
  };
}

export const DeliveryNavigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [riderLocation, setRiderLocation] =
    useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  /* ---------- FETCH ORDER (NO FK JOIN) ---------- */
  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id,status,otp_delivery,delivery_address_snapshot')
          .eq('id', id)
          .single();

        if (error || !data) throw error;
        setOrder(data);
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

  /* ---------- USER-ACTION GPS (Fast-First) ---------- */
  const startNavigation = () => {
    if (!navigator.geolocation) {
      showToast('GPS not supported', 'error');
      return;
    }

    // Step 1: FAST fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        setRiderLocation(coords);

        // Step 2: ACCURATE fix in background
        navigator.geolocation.getCurrentPosition(
          (highPos) => {
            setRiderLocation([highPos.coords.longitude, highPos.coords.latitude]);
          },
          () => { }, // Silent fail for high accuracy upgrade
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
    if (!isMapboxAvailable()) return;
    if (mapInstance.current) return;

    const { lat, lng } = order.delivery_address_snapshot;

    const map = initializeMap(mapRef.current, riderLocation, 15);
    mapInstance.current = map;

    map.on('load', async () => {
      await drawRoute(map, riderLocation, [lng, lat]);
      setMapReady(true);
    });
  }, [order, riderLocation]);

  /* ---------- COMPLETE DELIVERY ---------- */
  const handleMarkDelivered = async () => {
    if (!id || !user?.id) return;

    try {
      const result = await transitionOrderState(
        id,
        'delivered',
        'rider',
        user.id
      );

      if (!result.success) throw new Error(result.message);
      showToast('Delivery completed', 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.message || 'Failed to complete delivery', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader size="lg" text="Loading delivery..." />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div ref={mapRef} className="flex-1" />

      {!riderLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <Button onClick={startNavigation} size="lg">
            Start Navigation
          </Button>
        </div>
      )}

      <motion.div
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        className="absolute bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-3xl p-6"
      >
        <p className="text-white mb-4">
          {order.delivery_address_snapshot.full_address}
        </p>
        <Button onClick={handleMarkDelivered} className="w-full">
          Mark as Delivered
        </Button>
      </motion.div>

      {!mapReady && riderLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <Loader size="lg" text="Loading navigation..." />
        </div>
      )}
    </div>
  );
};
