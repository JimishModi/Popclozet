/**
 * Orders Service
 * Handles order creation, retrieval, and payment flow
 *
 * SECURITY NOTES:
 * - Order creation uses atomic DB function (no partial inserts)
 * - All mutations verify user ownership via DB RPCs
 * - State transitions go through the state machine — never direct updates
 */

import { supabase } from "@popclozet/api-client";

export interface Order {
  id: string;
  user_id: string;
  delivery_address_id?: string;
  rental_start_date: string;
  rental_end_date: string;
  total_amount: number;
  status?: string;
  lifecycle_state?: string;
  delivery_eta?: string;
  rider_id?: string | null;
  otp_delivery?: string | null;
  otp_return?: string | null;
  return_pickup_date?: string | null;
  return_time_slot?: string | null;
  created_at: string;
  delivery_address?: SavedAddressRecord | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  size?: string;
  rental_price: number;
  rental_duration_days?: number;
  created_at?: string;
  product?: {
    id: string;
    name: string;
    images?: string[] | null;
    rental_price?: number | null;
    deposit_amount?: number | null;
  } | null;
}

export interface SavedAddressRecord {
  id: string;
  label?: string | null;
  full_address: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean | null;
}

/**
 * Get all orders for current user
 */
export async function getMyOrders(): Promise<Order[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyOrders error:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Get order by ID with items — enforces user ownership
 */
export async function getOrderById(orderId: string): Promise<(Order & { items?: OrderItem[] }) | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      delivery_address:delivery_address_id (
        id,
        label,
        full_address,
        latitude,
        longitude,
        is_default
      ),
      order_items (
        id,
        order_id,
        product_id,
        size,
        individual_id,
        rental_price,
        rental_duration_days
      )
    `
    )
    .eq("id", orderId)
    .eq("user_id", user.id)  // FIX: enforce ownership
    .maybeSingle();

  if (error) {
    console.error("getOrderById error:", error);
    throw error;
  }

  return data || null;
}

/**
 * Items to include in an order — only IDs, sizes, plans, and quantities.
 * Prices are NEVER sent from the client; the server resolves them from the DB.
 */
export interface PlaceOrderItem {
  product_id: string;
  size: string;
  plan: string;      // '1d' | '2d' | '3d' | 'buy'
  quantity: number;
}

export interface PlaceOrderParams {
  idempotencyKey: string;
  addressId: string;
  startDate: string;         // ISO string
  endDate: string;           // ISO string
  paymentMethod: string;     // 'cod' | 'upi' | 'razorpay'
  deliveryFee: number;
  routeDistanceKm: number;
  deliveryEta: string | null;
  returnPickupDate: string | null;
  returnTimeSlot: string | null;
  items: PlaceOrderItem[];
}

export interface PlaceOrderResult {
  success: boolean;
  order_id?: string;
  status?: string;
  subtotal?: number;
  delivery_fee?: number;
  total?: number;
  item_count?: number;
  idempotent?: boolean;
  code?: string;
  message?: string;
}

/**
 * Place an order atomically via server-side RPC.
 *
 * - Order + items created in a single DB transaction
 * - Prices fetched from the products table server-side (never from client)
 * - Idempotency key prevents duplicate orders on double-click / retry
 * - On ANY failure the entire transaction rolls back (no partial data)
 */
export async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
  const { data, error } = await supabase.rpc("place_order", {
    p_idempotency_key: params.idempotencyKey,
    p_address_id: params.addressId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_payment_method: params.paymentMethod,
    p_delivery_fee: params.deliveryFee,
    p_route_distance_km: params.routeDistanceKm,
    p_delivery_eta: params.deliveryEta,
    p_return_pickup_date: params.returnPickupDate,
    p_return_time_slot: params.returnTimeSlot,
    p_items: params.items,
  });

  if (error) {
    console.error("placeOrder RPC error:", error);
    throw new Error(error.message || "Failed to place order");
  }

  const result = data as PlaceOrderResult;
  if (!result.success) {
    throw new Error(result.message || `Order failed: ${result.code}`);
  }

  return result;
}

/**
 * Confirm payment via secure DB function (validates ownership + state via auth.uid())
 */
export async function confirmOrderPayment(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc("confirm_order_payment", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("confirmOrderPayment RPC error:", error);
    throw error;
  }

  const result = data as { success: boolean; code?: string; message?: string };
  if (!result.success) {
    throw new Error(result.message || `Payment confirmation failed: ${result.code}`);
  }
}

/**
 * Get order with delivery info — enforces user ownership
 */
export async function getOrderWithDelivery(orderId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      deliveries:deliveries (
        id,
        rental_id,
        warehouse_id,
        delivery_type,
        status,
        assigned_rider,
        scheduled_date,
        completed_at
      ),
      order_items (
        id,
        product_id,
        size,
        rental_price,
        rental_duration_days
      )
    `
    )
    .eq("id", orderId)
    .eq("user_id", user.id)  // FIX: enforce ownership
    .maybeSingle();

  if (error) {
    console.error("getOrderWithDelivery error:", error);
    throw error;
  }

  return data || null;
}

/**
 * Cancel an order via secure DB function (validates state + ownership)
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc("cancel_order_safe", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("cancelOrder RPC error:", error);
    throw error;
  }

  const result = data as { success: boolean; code?: string; message?: string };
  if (!result.success) {
    throw new Error(result.message || `Cancel failed: ${result.code}`);
  }
}

/**
 * Get active rentals for the Closet page.
 */
export async function getMyActiveRentals() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        product_id,
        size,
        individual_id,
        rental_price,
        rental_duration_days,
        item:products (
          id,
          name,
          images,
          rental_price
        )
      )
    `)
    .eq("user_id", user.id)
    .in("status", [
      "pending", "confirmed", "packed", "ready_for_pickup", "rider_assigned",
      "driver_arrived_warehouse", "order_picked_up",
      "dispatched", "out_for_delivery", "delivered", "in_use",
      "return_requested", "return_scheduled", "return_dispatched"
    ])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyActiveRentals error:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Load saved addresses for the current user.
 */
export async function getMySavedAddresses(): Promise<SavedAddressRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, full_address, latitude, longitude, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMySavedAddresses error:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Schedule a return for an order through the server-side RPC.
 */
export async function scheduleReturn(
  orderId: string,
  pickupAddressId: string,
  pickupSlotIso: string,
  reason: string = "scheduled_return"
) {
  const { data, error } = await supabase.rpc("schedule_order_return", {
    p_order_id: orderId,
    p_pickup_address_id: pickupAddressId,
    p_pickup_slot: pickupSlotIso,
    p_reason: reason,
  });

  if (error) {
    console.error("scheduleReturn error:", error);
    throw error;
  }

  return data;
}

/**
 * Request an immediate return (Return Now).
 */
export async function requestImmediateReturn(
  orderId: string,
  pickupAddressId?: string | null
) {
  const { data, error } = await supabase.rpc("request_immediate_return", {
    p_order_id: orderId,
    p_pickup_address_id: pickupAddressId ?? null,
  });

  if (error) {
    console.error("requestImmediateReturn error:", error);
    throw error;
  }

  return data;
}

/**
 * Assign a rider for a return pickup.
 */
export async function assignReturnRider(orderId: string, riderId: string) {
  const { data, error } = await supabase.rpc("assign_return_rider", {
    p_order_id: orderId,
    p_rider_id: riderId,
  });

  if (error) {
    console.error("assignReturnRider error:", error);
    throw error;
  }

  return data;
}

/**
 * Keep an item (buyout) via secure DB function (validates state + ownership)
 */
export async function keepItem(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc("keep_item_safe", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("keepItem RPC error:", error);
    throw error;
  }

  const result = data as { success: boolean; code?: string; message?: string };
  if (!result.success) {
    throw new Error(result.message || `Keep item failed: ${result.code}`);
  }
}