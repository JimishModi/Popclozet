import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@popclozet/api-client";
import { getUserOrders, DeliveryOrder as DeliveryOrderType } from "@/services/deliveryService";

export interface Order {
    id: string;
    status: string;
    orderType: "delivery" | "pickup" | "return" | "rental" | "home_try_on";
    createdAt: string;
    updatedAt?: string;
    itemCount: number;
    totalAmount: number;
    deliveryFee: number;
    isFreeDelivery: boolean;
    estimatedDeliveryAt: string;
    actualDeliveryAt: string | null;
    address: {
        fullAddress: string;
        lat: number;
        lng: number;
    };
    hubId: string;
    riderId?: string;
    deliveryPartner?: {
        id: string;
        name: string;
        phone?: string;
        vehicleNumber?: string;
        rating?: number;
    };
    etaMinutes?: number;
    firstItemName?: string;
    firstItemImage?: string;
}

function mapToOrder(raw: any): Order {
    return {
        id: raw.id,
        status: raw.status,
        orderType: raw.order_type || 'rental',
        createdAt: raw.created_at,
        updatedAt: raw.updated_at || raw.created_at,
        itemCount: Array.isArray(raw.order_items) ? raw.order_items.length : 0,
        totalAmount: raw.total_amount || 0,
        deliveryFee: raw.delivery_fee || 0,
        isFreeDelivery: raw.is_free_delivery || false,
        estimatedDeliveryAt: raw.delivery_eta || raw.estimated_delivery_at,
        actualDeliveryAt: raw.actual_delivery_at || null,
        address: {
            fullAddress: raw.delivery_address?.full_address || raw.delivery_address_snapshot?.full_address || "Address not provided",
            lat: raw.delivery_address?.latitude || raw.delivery_address_snapshot?.lat || 0,
            lng: raw.delivery_address?.longitude || raw.delivery_address_snapshot?.lng || 0,
        },
        hubId: raw.hub_id,
        etaMinutes: (raw.delivery_eta || raw.estimated_delivery_at)
            ? Math.max(0, Math.round((new Date(raw.delivery_eta || raw.estimated_delivery_at).getTime() - Date.now()) / 60000))
            : undefined,
        firstItemName: raw.order_items?.[0]?.products?.name ?? undefined,
        firstItemImage: raw.order_items?.[0]?.products?.images?.[0] ?? undefined,
    };
}

/**
 * Hook to fetch user's orders with real-time updates
 */
export function useOrders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const channelNameRef = useRef(`orders_${user?.id}_${Math.random().toString(36).slice(2, 9)}`);


    const fetchOrders = useCallback(async () => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const rawOrders = await getUserOrders(user.id);
            setOrders(rawOrders.map(mapToOrder).filter(o => o.status !== 'cancelled'));
            setError(null);
        } catch (err) {
            console.error("Failed to fetch orders:", err);
            setError("Failed to load orders");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOrders();

        // Subscribe to real-time updates
        if (!user) return;

        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(channelNameRef.current)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "orders",
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => {
                        // Refetch on any change
                        fetchOrders();
                    }
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[useOrders] Realtime subscription error (non-fatal):', err);
                });
        } catch (err) {
            console.warn('[useOrders] Failed to subscribe to orders realtime (non-fatal):', err);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [user, fetchOrders]);

    const activeOrders = orders.filter((o) =>
        [
            "pending",
            "confirmed",
            "packed",
            "ready_for_pickup",
            "rider_assigned",
            "preparing",
            "driver_arrived_warehouse",
            "order_picked_up",
            "dispatched",
            "out_for_delivery",
            "pickup_scheduled",
            "delivered",
            "in_use",
            "return_requested",
            "return_scheduled",
            "return_dispatched",
        ].includes(o.status)
    );

    const pastOrders = orders.filter((o) =>
        [
            "picked_up",
            "return_completed",
            "completed",
            "return_picked_up",
            "return_at_warehouse",
            "returned"
        ].includes(o.status)
    );

    return {
        orders,
        activeOrders,
        pastOrders,
        loading,
        error,
        refetch: fetchOrders,
    };
}



/**
 * Hook to get a specific order by ID with real-time updates
 */
export function useOrder(orderId: string) {
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const channelNameRef = useRef(`order_${orderId}_${Math.random().toString(36).slice(2, 9)}`);


    const fetchOrder = useCallback(async () => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from("orders")
                .select(`
                    *,
                    order_items (id, product_id, size, rental_price),
                    delivery_address:delivery_address_id (full_address, latitude, longitude)
                `)
                .eq("id", orderId)
                .single();

            if (fetchError) throw fetchError;
            if (data) {
                setOrder(mapToOrder(data as DeliveryOrderType));
            }
            setError(null);
        } catch (err) {
            console.error("Failed to fetch order:", err);
            setError("Failed to load order");
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        fetchOrder();

        // Subscribe to real-time updates for this specific order
        let channel: ReturnType<typeof supabase.channel> | null = null;
        try {
            channel = supabase
                .channel(channelNameRef.current)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "orders",
                        filter: `id=eq.${orderId}`,
                    },
                    () => {
                        fetchOrder();
                    }
                )
                .subscribe((status, err) => {
                    if (err) console.warn('[useOrder] Realtime subscription error (non-fatal):', err);
                });
        } catch (err) {
            console.warn('[useOrder] Failed to subscribe to order realtime (non-fatal):', err);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [orderId, fetchOrder]);

    return { order, loading, error, refetch: fetchOrder };
}
