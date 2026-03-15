/**
 * Notify Customer Service
 * 
 * Shared service for inserting notifications into the customer's
 * notifications table. Used by rider-app and warehouse-app to
 * communicate status changes to customers.
 */

import { supabase } from './index';

// ==========================================
// CUSTOMER NOTIFICATION TYPES
// ==========================================

export type CustomerNotificationType =
    | 'order_dispatched'
    | 'rider_arrived_warehouse'
    | 'order_picked_up'
    | 'out_for_delivery'
    | 'delivered'
    | 'rider_message';

interface NotificationPayload {
    userId: string;
    type: CustomerNotificationType;
    title: string;
    message: string;
    orderId?: string;
    metadata?: Record<string, any>;
}

// ==========================================
// INSERT NOTIFICATION
// ==========================================

async function insertNotification(payload: NotificationPayload): Promise<boolean> {
    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: payload.userId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            order_id: payload.orderId || null,
            metadata: payload.metadata || null,
            is_read: false,
        });

    if (error) {
        console.error('[notifyCustomer] Failed to insert notification:', error);
        return false;
    }

    return true;
}

// ==========================================
// NOTIFICATION HELPERS
// ==========================================

/**
 * Notify customer that their order has been picked up from warehouse and dispatched
 */
export async function notifyCustomerOfDispatch(
    orderId: string,
    customerId: string,
    riderName?: string
): Promise<boolean> {
    return insertNotification({
        userId: customerId,
        type: 'order_dispatched',
        title: '📦 Your package has been dispatched!',
        message: riderName
            ? `${riderName} has picked up your package from the warehouse and is on the way.`
            : 'Your package has been dispatched from the warehouse. A rider is currently handling your delivery.',
        orderId,
        metadata: { rider_name: riderName || null },
    });
}

/**
 * Notify customer that the rider has arrived at the warehouse
 */
export async function notifyCustomerOfWarehouseArrival(
    orderId: string,
    customerId: string,
    riderName?: string
): Promise<boolean> {
    return insertNotification({
        userId: customerId,
        type: 'rider_arrived_warehouse',
        title: '🏭 Rider arrived at warehouse',
        message: riderName
            ? `${riderName} has arrived at the warehouse to pick up your package.`
            : 'Your assigned rider has arrived at the warehouse to collect your package.',
        orderId,
        metadata: { rider_name: riderName || null },
    });
}

/**
 * Notify customer that the order has been picked up
 */
export async function notifyCustomerOfPickup(
    orderId: string,
    customerId: string,
    riderName?: string
): Promise<boolean> {
    return insertNotification({
        userId: customerId,
        type: 'order_picked_up',
        title: '✅ Package picked up!',
        message: riderName
            ? `${riderName} has collected your package and will deliver it shortly.`
            : 'Your package has been collected from the warehouse and is being prepared for delivery.',
        orderId,
        metadata: { rider_name: riderName || null },
    });
}

/**
 * Send a predefined or custom message from rider to customer
 */
export async function sendRiderMessageToCustomer(
    orderId: string,
    customerId: string,
    message: string,
    riderName?: string
): Promise<boolean> {
    return insertNotification({
        userId: customerId,
        type: 'rider_message',
        title: `💬 Message from ${riderName || 'your rider'}`,
        message,
        orderId,
        metadata: { rider_name: riderName || null },
    });
}

/**
 * Notify customer that the order is out for delivery
 */
export async function notifyCustomerOutForDelivery(
    orderId: string,
    customerId: string,
    riderName?: string,
    etaMinutes?: number
): Promise<boolean> {
    let message = riderName
        ? `${riderName} is on the way with your package.`
        : 'Your package is out for delivery.';

    if (etaMinutes) {
        message += ` Estimated arrival: ~${etaMinutes} minutes.`;
    }

    return insertNotification({
        userId: customerId,
        type: 'out_for_delivery',
        title: '🚗 Out for delivery!',
        message,
        orderId,
        metadata: { rider_name: riderName || null, eta_minutes: etaMinutes || null },
    });
}
