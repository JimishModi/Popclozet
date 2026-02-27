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
  total_amount: number;
  deposit_amount?: number;
  status?: string;
  lifecycle_state?: string;
  delivery_eta?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  size?: string;
  rental_price: number;
  deposit_amount?: number;
  rental_duration_days?: number;
  created_at?: string;
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
      order_items (
        id,
        order_id,
        product_id,
        size,
        rental_price,
        deposit_amount,
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
  depositAmount: number,
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
      deposit_amount: depositAmount,
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
    deposit_amount: item.item?.deposit_amount || 0,
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
    .update({ lifecycle_state: "confirmed" })
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
    .update({ lifecycle_state: "cancelled" })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error("cancelOrder error:", error);
    throw error;
  }

  return data;
}
