import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@popclozet/api-client";
import { getUserOrders, DeliveryOrder as DeliveryOrderType } from "@/services/deliveryService";

export interface Order {
    id: string;
    status: string;
    orderType: "delivery" | "pickup" | "return";
    createdAt: string;
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
}

function mapToOrder(raw: DeliveryOrderType): Order {
    return {
        id: raw.id,
        status: raw.status,
        orderType: raw.order_type,
        createdAt: raw.created_at,
        itemCount: 2, // TODO: Get from order_items join
        totalAmount: raw.delivery_fee + 4000, // TODO: Get from order_items
        deliveryFee: raw.delivery_fee,
        isFreeDelivery: raw.is_free_delivery,
        estimatedDeliveryAt: raw.estimated_delivery_at,
        actualDeliveryAt: raw.actual_delivery_at,
        address: {
            fullAddress: raw.delivery_address_snapshot?.full_address || "Address not provided",
            lat: raw.delivery_address_snapshot?.lat || 0,
            lng: raw.delivery_address_snapshot?.lng || 0,
        },
        hubId: raw.hub_id,
        etaMinutes: raw.estimated_delivery_at
            ? Math.max(0, Math.round((new Date(raw.estimated_delivery_at).getTime() - Date.now()) / 60000))
            : undefined,
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

    const fetchOrders = useCallback(async () => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const rawOrders = await getUserOrders(user.id);
            setOrders(rawOrders.map(mapToOrder));
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

        const channel = supabase
            .channel(`orders_${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "delivery_orders",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    // Refetch on any change
                    fetchOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchOrders]);

    const activeOrders = orders.filter((o) =>
        ["pending", "confirmed", "packed", "ready_for_pickup", "preparing", "driver_arrived_warehouse", "order_picked_up", "dispatched", "out_for_delivery", "pickup_scheduled"].includes(o.status)
    );

    const pastOrders = orders.filter((o) =>
        ["delivered", "picked_up", "return_completed", "cancelled"].includes(o.status)
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

    const fetchOrder = useCallback(async () => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from("delivery_orders")
                .select("*")
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
        const channel = supabase
            .channel(`order_${orderId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "delivery_orders",
                    filter: `id=eq.${orderId}`,
                },
                () => {
                    fetchOrder();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orderId, fetchOrder]);

    return { order, loading, error, refetch: fetchOrder };
}
