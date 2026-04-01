/**
 * Orders Service
 * Handles order creation, retrieval, and payment flow
 */

import { supabase } from "@popclozet/api-client";

export interface Order {
  id: string;
  user_id: string;
  delivery_address_id?: string;
  rental_start_date: string;
  rental_end_date: string;
  total_amount: number,
  status?: string,
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
  rental_price: number,
  rental_duration_days?: number,
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
 * Get order by ID with items
 */
export async function getOrderById(orderId: string): Promise<(Order & { items?: OrderItem[] }) | null> {
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
    .maybeSingle();

  if (error) {
    console.error("getOrderById error:", error);
    throw error;
  }

  return data || null;
}

/**
 * Create an order from cart
 * This initiates the checkout flow
 */
export async function createOrder(
  deliveryAddressId: string,
  rentalStartDate: string,
  rentalEndDate: string,
  totalAmount: number,
  cartItems: any[]
): Promise<Order> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Start transaction - create order first
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      delivery_address_id: deliveryAddressId,
      rental_start_date: rentalStartDate,
      rental_end_date: rentalEndDate,
      total_amount: totalAmount,
      status: "pending",
      lifecycle_state: "placed",
    })
    .select()
    .single();

  if (orderError) {
    console.error("createOrder error:", orderError);
    throw orderError;
  }

  // Add items to order
  const orderItemsData = cartItems.map((item) => ({
    order_id: order.id,
    product_id: item.item_id,
    size: item.size || "One Size",
    rental_price: item.item?.rental_price_per_day || 0,
    rental_duration_days: item.days || 3,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsData);

  if (itemsError) {
    // Rollback order if items fail
    await supabase.from("orders").delete().eq("id", order.id);
    console.error("createOrder items error:", itemsError);
    throw itemsError;
  }

  return order;
}

/**
 * Confirm payment and transition order to processing
 * Updates order status directly (RPC may not be available)
 */
export async function confirmOrderPayment(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "confirmed", lifecycle_state: "confirmed" })
    .eq("id", orderId);

  if (error) {
    console.error("confirmOrderPayment error:", error);
    throw error;
  }
}

/**
 * Get order with delivery info
 */
export async function getOrderWithDelivery(orderId: string) {
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
    .maybeSingle();

  if (error) {
    console.error("getOrderWithDelivery error:", error);
    throw error;
  }

  return data || null;
}

/**
 * Cancel an order (only in certain states)
 */
export async function cancelOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error("cancelOrder error:", error);
    throw error;
  }

  return data;
}

/**
 * Get active rentals for the Closet page.
 * Returns orders that are currently active (placed, confirmed, delivered, in_use).
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
 * Auto-approves and transitions to return_scheduled so riders can claim it right away.
 * If no pickupAddressId is provided, the server falls back to the delivery address.
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
 * Atomically sets rider_id, transitions to return_dispatched, and generates OTP.
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
 * Keep an item (buy it out at the fixed price).
 */
export async function keepItem(orderId: string) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);

  if (error) {
    console.error("keepItem error:", error);
    throw error;
  }
}

