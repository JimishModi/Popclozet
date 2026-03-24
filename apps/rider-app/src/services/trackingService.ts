// Rider-side delivery tracking service
// Manages delivery_tracking and rider_locations tables during active delivery

import { supabase } from '@popclozet/api-client';

/**
 * Create (or reactivate) a delivery_tracking row when the rider starts navigation.
 * Deactivates any previous active row for the same order first.
 */
export async function startDeliveryTracking(
  orderId: string,
  startLat: number,
  startLng: number,
  driverName?: string | null,
  vehicleNumber?: string | null,
  riderPhone?: string | null
): Promise<boolean> {
  const { error } = await supabase.from('delivery_tracking').upsert(
    {
      order_id: orderId,
      driver_name: driverName ?? null,
      vehicle_number: vehicleNumber ?? null,
      rider_phone: riderPhone ?? null,
      current_lat: startLat,
      current_lng: startLng,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' }
  );

  if (error) {
    console.error('startDeliveryTracking failed:', error);
    return false;
  }
  return true;
}

/**
 * Push a new GPS position to both delivery_tracking and rider_locations.
 * Called on every watchPosition callback.
 */
export async function pushLocationUpdate(
  riderId: string,
  orderId: string,
  lat: number,
  lng: number,
  heading?: number | null,
  speed?: number | null
): Promise<void> {
  // Update delivery_tracking position (customer sees this)
  await supabase
    .from('delivery_tracking')
    .update({
      current_lat: lat,
      current_lng: lng,
      heading: heading ?? null,
      speed: speed ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('is_active', true);

  // Upsert rider_locations (proximity detection uses this)
  await supabase
    .from('rider_locations')
    .upsert(
      {
        rider_id: riderId,
        lat,
        lng,
        heading: heading ?? null,
        speed: speed ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'rider_id' }
    );
}

/**
 * Mark the delivery_tracking row as inactive when delivery is complete.
 */
export async function stopDeliveryTracking(orderId: string): Promise<void> {
  await supabase
    .from('delivery_tracking')
    .update({ is_active: false })
    .eq('order_id', orderId)
    .eq('is_active', true);
}
