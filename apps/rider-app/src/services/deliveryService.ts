// src/services/deliveryService.ts
// Rider-side delivery helpers (READ / UPDATE only)

import { supabase } from '@popclozet/api-client';
import type { OrderStatus } from '@popclozet/domain-contracts';

// ==========================================
// TYPES
// ==========================================

export interface DeliveryOrder {
  id: string;
  user_id: string;
  rider_id: string | null;
  order_type: 'delivery' | 'pickup' | 'return';
  status: OrderStatus;

  delivery_address_snapshot: {
    full_address: string;
    lat: number;
    lng: number;
  };

  route_distance_km: number | null;
  route_polyline: string | null;

  delivery_fee: number;
  is_free_delivery: boolean;

  estimated_delivery_at: string | null;
  actual_delivery_at: string | null;

  created_at: string;
  updated_at: string;
}

// ==========================================
// FETCH ORDERS
// ==========================================

export async function getRiderOrders(
  riderId: string
): Promise<DeliveryOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getRiderOrders failed:', error);
    return [];
  }

  return data ?? [];
}

export async function getOrderById(
  orderId: string
): Promise<DeliveryOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    console.error('getOrderById failed:', error);
    return null;
  }

  return data;
}

// ==========================================
// STATUS UPDATE
// ==========================================

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<boolean> {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (['delivered', 'picked_up', 'return_completed'].includes(status)) {
    updates.actual_delivery_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId);

  if (error) {
    console.error('updateOrderStatus failed:', error);
    return false;
  }

  return true;
}
