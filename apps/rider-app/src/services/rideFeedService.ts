import { supabase } from '@popclozet/api-client';

export interface IncomingOrder {
    id: string;
    notificationId: string;
    source: 'assigned' | 'notification' | 'direct';
    workflowStatus: string;
    orderType: 'delivery' | 'pickup' | 'return';
    pickup: { name: string; address: string };
    dropoff: { name: string; address: string };
    customerName: string;
    customerPhone?: string;
    paymentMethod?: string | null;
    items?: Array<{ name: string; qty: number; imageUrl?: string }>;
    earnings: number;
    distance: string;
    duration: string;
    totalAmount?: number;
    routeDistanceKm?: number | null;
    updatedAt?: string | null;
}

const ORDER_SELECT = `
    *,
    customer_profiles!orders_user_id_fkey1(full_name, phone),
    addresses:delivery_address_id(full_address, latitude, longitude),
    order_items(
        id,
        product_id,
        products(name, images)
    )
`;

export const ASSIGNED_ORDER_STATUSES = [
    'rider_assigned',
    'ready_for_pickup',
    'driver_arrived_warehouse',
    'order_picked_up',
    'dispatched',
    'out_for_delivery',
    'return_scheduled',
    'return_dispatched',
    'return_picked_up',
    'return_at_warehouse',
] as const;

export function getIncomingOrderCardStatus(order: IncomingOrder): 'pending' | 'accepted' | 'picked_up' | 'delivering' {
    if (order.source !== 'assigned') return 'pending';

    if (['order_picked_up', 'dispatched'].includes(order.workflowStatus)) {
        return 'picked_up';
    }

    if (['out_for_delivery', 'return_scheduled', 'return_dispatched', 'return_picked_up', 'return_at_warehouse'].includes(order.workflowStatus)) {
        return 'delivering';
    }

    return 'accepted';
}

export function getAssignedOrderRoute(order: IncomingOrder): string {
    if (order.workflowStatus === 'return_picked_up' || order.workflowStatus === 'return_at_warehouse') {
        return `/warehouse/${order.id}`;
    }
    if (order.orderType === 'return' || ['out_for_delivery', 'return_scheduled', 'return_dispatched'].includes(order.workflowStatus)) {
        return `/delivery/${order.id}`;
    }

    return `/warehouse/${order.id}`;
}

export function getAssignedActionLabel(order: IncomingOrder): string {
    if (order.workflowStatus === 'return_picked_up') return 'Drop off at Warehouse';
    if (order.workflowStatus === 'return_at_warehouse') return 'Show OTP to Warehouse';
    if (order.orderType === 'return') return 'Open Return Pickup';
    if (order.workflowStatus === 'out_for_delivery') return 'Open Delivery';
    return 'Open Warehouse Pickup';
}

function mapDbOrderToIncoming(
    dbOrder: any,
    notificationId: string,
    source: IncomingOrder['source'],
): IncomingOrder {
    const addr = dbOrder.addresses;
    const fullAddr = addr?.full_address ?? 'Customer Address';

    const items = (dbOrder.order_items ?? []).map((item: any) => ({
        name: item.products?.name || `Product ${item.product_id.slice(0, 8)}`,
        qty: 1,
        imageUrl: Array.isArray(item.products?.images) ? item.products?.images?.[0] : null,
    }));

    const estimatedKm = typeof dbOrder.route_distance_km === 'number' ? dbOrder.route_distance_km : 3;
    const etaMinutes = dbOrder.delivery_eta
        ? Math.max(1, Math.round((new Date(dbOrder.delivery_eta).getTime() - Date.now()) / 60000))
        : Math.round(estimatedKm * 3);
    const isReturn = ['return_scheduled', 'return_dispatched', 'return_picked_up', 'return_at_warehouse'].includes(dbOrder.status);

    return {
        id: dbOrder.id,
        notificationId,
        source,
        workflowStatus: dbOrder.status ?? 'ready_for_pickup',
        orderType: isReturn
            ? 'return'
            : (dbOrder.order_type === 'pickup' || dbOrder.order_type === 'return' ? 'pickup' : 'delivery'),
        pickup: isReturn
            ? { name: 'Customer Pickup', address: fullAddr }
            : { name: 'Popclozet Warehouse', address: 'Near IIT Main Gate, Powai' },
        dropoff: isReturn
            ? { name: 'Warehouse Drop-off', address: 'Near IIT Main Gate, Powai' }
            : { name: 'Customer', address: fullAddr },
        customerName: dbOrder.customer_profiles?.full_name || 'Customer',
        customerPhone: dbOrder.customer_profiles?.phone || undefined,
        paymentMethod: dbOrder.payment_method || null,
        items,
        earnings: dbOrder.delivery_fee > 0
            ? dbOrder.delivery_fee
            : Math.round((dbOrder.total_amount ?? 0) * 0.15),
        distance: `${estimatedKm.toFixed(1)} km`,
        duration: `${etaMinutes} mins`,
        totalAmount: dbOrder.total_amount,
        routeDistanceKm: dbOrder.route_distance_km ?? null,
        updatedAt: dbOrder.updated_at ?? null,
    };
}

async function getDeclinedOrderIds(riderId: string): Promise<Set<string>> {
    const { data } = await supabase
        .from('rider_notifications')
        .select('order_id')
        .eq('rider_id', riderId)
        .eq('status', 'declined');

    return new Set((data ?? []).map((row: any) => row.order_id));
}

async function getDismissedOrderIds(riderId: string): Promise<Set<string>> {
    const { data } = await supabase
        .from('rider_notifications')
        .select('order_id')
        .eq('rider_id', riderId)
        .eq('status', 'dismissed');

    return new Set((data ?? []).map((row: any) => row.order_id));
}

async function getCancelledOrderIds(riderId: string): Promise<Set<string>> {
    const { data } = await supabase
        .from('order_cancellations')
        .select('order_id')
        .eq('rider_id', riderId);

    return new Set((data ?? []).map((row: any) => row.order_id));
}

export async function getAssignedIncomingOrder(riderId: string): Promise<IncomingOrder | null> {
    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('rider_id', riderId)
        .in('status', [...ASSIGNED_ORDER_STATUSES])
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('[rideFeedService] getAssignedIncomingOrder:', error);
        return null;
    }

    if (!data?.length) return null;

    return mapDbOrderToIncoming(data[0], `assigned:${data[0].id}`, 'assigned');
}

export async function getAvailableIncomingOrders(
    riderId: string,
    options?: {
        maxDistanceKm?: number;
    },
): Promise<IncomingOrder[]> {
    const [declinedOrderIds, cancelledOrderIds] = await Promise.all([
        getDeclinedOrderIds(riderId),
        getCancelledOrderIds(riderId),
    ]);

    // Format current date in IST for accurate filtering
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIst = new Date(today.getTime() + istOffset);
    const todayStr = todayIst.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .is('rider_id', null)
        .or(`status.eq.ready_for_pickup,and(status.eq.return_scheduled,return_pickup_date.lte.${todayStr})`)
        .order('updated_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[rideFeedService] getAvailableIncomingOrders:', error);
        return [];
    }

    const mapped = (data ?? [])
        .filter((order: any) => {
            if (declinedOrderIds.has(order.id)) return false;
            if (cancelledOrderIds.has(order.id)) return false;

            const maxDistanceKm = options?.maxDistanceKm;
            if (typeof maxDistanceKm === 'number' && typeof order.route_distance_km === 'number') {
                return order.route_distance_km <= maxDistanceKm;
            }

            return true;
        })
        .map((order: any) => mapDbOrderToIncoming(order, `direct:${order.id}`, 'direct'));

    mapped.sort((left, right) => {
        const leftUpdatedAt = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightUpdatedAt = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightUpdatedAt - leftUpdatedAt;
    });

    return mapped;
}

export async function getTopPendingIncomingOrder(
    riderId: string,
    dismissedDirectOrderIds?: Set<string>,
): Promise<IncomingOrder | null> {
    const assignedOrder = await getAssignedIncomingOrder(riderId);
    if (assignedOrder) return assignedOrder;

    const { data: notifications } = await supabase
        .from('rider_notifications')
        .select('id, order_id')
        .eq('rider_id', riderId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

    if (notifications?.length) {
        const notification = notifications[0];
        const { data: orderData } = await supabase
            .from('orders')
            .select(ORDER_SELECT)
            .eq('id', notification.order_id)
            .single();

        if (orderData) {
            return mapDbOrderToIncoming(orderData, notification.id, 'notification');
        }
    }

    const [availableOrders, dismissedOrderIds] = await Promise.all([
        getAvailableIncomingOrders(riderId),
        getDismissedOrderIds(riderId),
    ]);

    const sessionDismissedOrderIds = dismissedDirectOrderIds ?? new Set<string>();

    return availableOrders.find((order) =>
        !dismissedOrderIds.has(order.id) && !sessionDismissedOrderIds.has(order.id),
    ) ?? null;
}
