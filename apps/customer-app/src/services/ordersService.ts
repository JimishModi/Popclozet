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
  delivery_address_snapshot?: {
    full_address?: string | null;
    lat?: number | null;
    lng?: number | null;
    address_id?: string | null;
  } | null;
  manual_address_details?: {
    contactName?: string | null;
    phoneNumber?: string | null;
    houseNumber?: string | null;
    streetAddress?: string | null;
    landmark?: string | null;
    city?: string | null;
    pincode?: string | null;
  } | null;
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

const ACTIVE_CLOSET_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "ready_for_pickup",
  "rider_assigned",
  "driver_arrived_warehouse",
  "order_picked_up",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "in_use",
  "return_requested",
  "return_scheduled",
  "return_dispatched",
] as const;

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
  couponCode?: string | null;
  routeDistanceKm: number;
  deliveryEta: string | null;
  returnPickupDate: string | null;
  returnTimeSlot: string | null;
  items: PlaceOrderItem[];
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
}

export interface PlaceOrderResult {
  success: boolean;
  order_id?: string;
  status?: string;
  subtotal?: number;
  coupon_discount?: number;
  delivery_fee?: number;
  total?: number;
  item_count?: number;
  idempotent?: boolean;
  code?: string;
  message?: string;
}

export interface PreviewOrderParams {
  items: { product_id: string; size?: string; plan: string; quantity: number }[];
  couponCode?: string | null;
  distanceKm?: number | null;
  addressId?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface PreviewOrderResult {
  success: boolean;
  original_total?: number;
  subtotal?: number;
  discount?: number;
  coupon?: { valid: boolean; reason?: string; message?: string; discount?: number; discount_type?: string; discount_value?: number };
  coupon_discount?: number;
  delivery_fee?: number;
  total?: number;
  items?: { product_id: string; unit_price: number; quantity: number; line_total: number; mrp: number }[];
  code?: string;
  message?: string;
}

/**
 * Preview order pricing — read-only, no side effects.
 * All prices computed server-side. Use this to display totals before placing.
 */
export async function previewOrder(params: PreviewOrderParams): Promise<PreviewOrderResult> {
  const { data, error } = await supabase.rpc("preview_order", {
    p_items: params.items,
    p_coupon_code: params.couponCode || null,
    p_distance_km: params.distanceKm ?? 0,
    p_address_id: params.addressId || null,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
  });

  if (error) {
    console.error("previewOrder RPC error:", error);
    throw new Error(error.message || "Failed to preview order");
  }

  return data as PreviewOrderResult;
}

/**
 * Resolve cart items to inventory variant_ids.
 * Maps product_id + size to the inventory row id (variant_id).
 */
export async function resolveVariantIds(
  items: { product_id: string; size: string; quantity: number }[]
): Promise<{ variant_id: string; quantity: number }[]> {
  if (items.length === 0) return [];

  // Fetch all matching inventory rows in one query
  const productIds = [...new Set(items.map(i => i.product_id))];
  const { data: inventoryRows, error } = await supabase
    .from('inventory')
    .select('id, product_id, size')
    .in('product_id', productIds);

  if (error) throw new Error(`Failed to resolve variants: ${error.message}`);
  if (!inventoryRows || inventoryRows.length === 0) {
    throw new Error('No inventory found for cart items');
  }

  // Build lookup map: "product_id:size" -> inventory.id
  const lookup = new Map<string, string>();
  for (const row of inventoryRows) {
    lookup.set(`${row.product_id}:${row.size}`, row.id);
  }

  const resolved: { variant_id: string; quantity: number }[] = [];
  for (const item of items) {
    const key = `${item.product_id}:${item.size}`;
    const variantId = lookup.get(key);
    if (!variantId) {
      throw new Error(`No inventory variant found for product ${item.product_id} size ${item.size}`);
    }
    resolved.push({ variant_id: variantId, quantity: item.quantity });
  }

  return resolved;
}

/**
 * Reserve stock for all items in the cart atomically.
 * Must be called BEFORE order creation. Returns the reserved items on success.
 */
export async function reserveCheckoutStock(
  items: { variant_id: string; quantity: number }[]
): Promise<{ success: boolean; reserved_items?: { variant_id: string; quantity: number }[]; message?: string }> {
  const { data, error } = await supabase.rpc('reserve_checkout_stock', {
    p_items: items,
  });

  if (error) {
    console.error('reserveCheckoutStock RPC error:', error);
    throw new Error(error.message || 'Failed to reserve stock');
  }

  return data as { success: boolean; reserved_items?: { variant_id: string; quantity: number }[]; message?: string };
}

/**
 * Release previously reserved stock (e.g. on order creation failure).
 * This is a client-side fallback; the backend release_order_stock RPC
 * is the primary release mechanism for confirmed orders.
 */
export async function releaseCheckoutStock(
  items: { variant_id: string; quantity: number }[]
): Promise<void> {
  const { error } = await supabase.rpc('release_checkout_stock', {
    p_items: items,
  });

  if (error) {
    console.error('releaseCheckoutStock RPC error (non-fatal):', error);
  }
}

/**
 * Persist stock reservation records for an order.
 * Called after order creation succeeds, so the backend knows what to release.
 */
export async function persistOrderReservations(
  orderId: string,
  items: { variant_id: string; quantity: number }[]
): Promise<void> {
  const { data, error } = await supabase.rpc('persist_order_stock_reservations', {
    p_order_id: orderId,
    p_items: items,
  });

  if (error) {
    console.error('persistOrderReservations RPC error:', error);
    throw new Error(error.message || 'Failed to persist stock reservations');
  }

  const result = data as { success: boolean; code?: string; message?: string } | null;
  if (result && !result.success) {
    throw new Error(result.message || `Failed to persist stock reservations: ${result.code ?? 'UNKNOWN'}`);
  }
}

/**
 * Place an order atomically via server-side RPC.
 *
 * - Order + items created in a single DB transaction
 * - Prices fetched from the products table server-side (never from client)
 * - Idempotency key prevents duplicate orders on double-click / retry
 * - On ANY failure the entire transaction rolls back (no partial data)
 * - Retries transient network errors up to 2 times (safe due to idempotency key)
 */
export async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Keep the client aligned with the canonical DB RPC signature.
      // Recipient overrides are still collected in the UI, but the stable
      // public.place_order function does not accept those named arguments.
      const { data, error } = await supabase.rpc("place_order", {
        p_idempotency_key: params.idempotencyKey,
        p_address_id: params.addressId,
        p_start_date: params.startDate,
        p_end_date: params.endDate,
        p_payment_method: params.paymentMethod,
        p_coupon_code: params.couponCode || null,
        p_route_distance_km: params.routeDistanceKm,
        p_delivery_eta: params.deliveryEta,
        p_return_pickup_date: params.returnPickupDate,
        p_return_time_slot: params.returnTimeSlot,
        p_items: params.items,
      });

      if (error) {
        // Business logic errors (validation, auth) — don't retry
        if (error.code && !isTransientError(error)) {
          console.error("placeOrder RPC error:", error);
          throw new Error(error.message || "Failed to place order");
        }
        throw error; // Transient — will be retried
      }

      const result = data as PlaceOrderResult;
      if (!result.success) {
        throw new Error(result.message || `Order failed: ${result.code}`);
      }

      return result;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry transient/network errors
      const isRetryable = isTransientError(err) || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s
      console.warn(`[placeOrder] Transient error, retrying (${attempt + 1}/${MAX_RETRIES})...`);
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Failed to place order");
}

function isTransientError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.statusCode;
  // Postgres/Supabase transient codes
  if (['PGRST301', '08006', '08001', '57P01'].includes(code)) return true;
  // HTTP 5xx or network errors
  if (typeof code === 'number' && code >= 500) return true;
  return false;
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
          brand,
          images,
          rental_price,
          mrp,
          buy_price
        )
      )
    `)
    .eq("user_id", user.id)
    .in("status", [...ACTIVE_CLOSET_STATUSES])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyActiveRentals error:", error);
    throw error;
  }

  return data ?? [];
}

export async function getMyActiveClosetItemCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_items (
        id
      )
    `)
    .eq("user_id", user.id)
    .in("status", [...ACTIVE_CLOSET_STATUSES]);

  if (error) {
    console.error("getMyActiveClosetItemCount error:", error);
    throw error;
  }

  return (data ?? []).reduce((total, order) => {
    const itemCount = Array.isArray(order.order_items) ? order.order_items.length : 0;
    return total + itemCount;
  }, 0);
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
