/**
 * Notifications Service
 * Handle user notifications and preferences
 */

import { supabase } from "@popclozet/api-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { triggerPushForOrderStatus } from "./pushNotificationService";

export type NotificationType =
  | "general"
  | "order_update"
  | "delivery_update"
  | "price_drop"
  | "new_arrival"
  | "rental_reminder"
  | "order_confirmed"
  | "order_dispatched"
  | "rider_message"
  | "out_for_delivery"
  | "delivered"
  | "pickup_scheduled"
  | "pickup_completed"
  | "return_scheduled"
  | "return_completed";

export interface Notification {
  id: string;
  user_id: string;
  type?: string;
  title: string;
  message: string;
  order_id?: string | null;
  metadata?: any;
  is_read?: boolean;
  created_at?: string;
}

export interface NotificationPreferences {
  user_id: string;
  push_enabled?: boolean;
  orders_delivery?: boolean;
  new_arrivals?: boolean;
  price_drops?: boolean;
  promotions?: boolean;
  wishlist_updates?: boolean;
  rental_reminders?: boolean;
  general_updates?: boolean;
}

/**
 * Get all notifications for current user
 */
export async function getNotifications(limit: number = 50): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    throw error;
  }

  return count ?? 0;
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }

  return data;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error marking all as read:", error);
    throw error;
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching preferences:", error);
    return null;
  }

  return data;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notification_preferences")
    .update(updates)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating preferences:", error);
    throw error;
  }

  return data;
}

/**
 * Subscribe to real-time notifications
 */
export async function subscribeToNotifications(
  onNewNotification: (notification: Notification) => void,
  instanceId?: string
): Promise<RealtimeChannel> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user.id) {
    throw new Error("Not authenticated");
  }

  const channelName = instanceId 
    ? `notifications:${data.session.user.id}:${instanceId}`
    : `notifications:${data.session.user.id}:${Math.random().toString(36).slice(2, 9)}`;

  return supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${data.session.user.id}`,
      },
      (payload) => {
        onNewNotification(payload.new as Notification);
      }
    )
    .subscribe();
}

/**
 * Unsubscribe from notifications
 */
export async function unsubscribeFromNotifications(
  channel: RealtimeChannel
): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Register device for push notifications
 */
export async function registerDevice(
  deviceId: string,
  deviceName: string,
  pushSubscription?: PushSubscription
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("device_registrations").insert({
    user_id: user.id,
    device_id: deviceId,
    device_name: deviceName,
    platform: "web",
    push_subscription: pushSubscription
      ? JSON.parse(JSON.stringify(pushSubscription))
      : null,
  });

  if (error) {
    console.error("Error registering device:", error);
    throw error;
  }
}

/**
 * Create a notification for a user
 */
async function createNotification(
  type: NotificationType,
  orderId?: string,
  customTitle?: string,
  customMessage?: string
): Promise<Notification> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: user.id,
      type,
      title: customTitle || `Notification (${type})`,
      message: customMessage || `You have a new ${type} notification`,
      order_id: orderId || null,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    throw error;
  }

  return data;
}

/* ================================
   ORDER STATUS HELPER
================================ */

export async function notifyOrderStatusChange(
    userId: string,
    orderId: string,
    status: string
): Promise<void> {
    const notifications: Record<string, { type: string; title: string; message: string }> = {
        confirmed: {
            type: 'order_update',
            title: '✅ Order Confirmed',
            message: 'Your order has been confirmed and is being prepared.',
        },
        packed: {
            type: 'order_update',
            title: '📦 Order Packed',
            message: 'Your order has been packed and is ready for pickup by a rider.',
        },
        ready_for_pickup: {
            type: 'order_update',
            title: '🏭 Ready for Pickup',
            message: 'Your package is ready and a rider has been assigned to collect it.',
        },
        rider_assigned: {
            type: 'order_update',
            title: '🚗 Rider Assigned!',
            message: 'A rider has been assigned to pick up your package. They are on their way to the warehouse!',
        },
        driver_arrived_warehouse: {
            type: 'order_update',
            title: '🚗 Rider at Warehouse',
            message: 'Your assigned rider has arrived at the warehouse to collect your package.',
        },
        order_picked_up: {
            type: 'order_update',
            title: '✅ Package Picked Up!',
            message: 'Your package has been collected from the warehouse and is being prepared for delivery.',
        },
        dispatched: {
            type: 'order_dispatched',
            title: '📦 Package Dispatched!',
            message: 'Your package has been dispatched from the warehouse. A rider is on the way!',
        },
        out_for_delivery: {
            type: 'order_update',
            title: '🚗 Out for Delivery!',
            message: 'Your package is out for delivery. The rider is heading to your location.',
        },
        delivered: {
            type: 'order_update',
            title: '🎉 Package Delivered!',
            message: 'Your package has been delivered. Enjoy!',
        },
        return_scheduled: {
            type: 'return_scheduled',
            title: '📅 Return Pickup Scheduled',
            message: 'Your return pickup has been scheduled. A rider will be assigned shortly.',
        },
        return_dispatched: {
            type: 'return_scheduled',
            title: '🚗 Rider On The Way!',
            message: 'A rider has been assigned and is heading to your location to collect your items.',
        },
        return_picked_up: {
            type: 'return_completed',
            title: '✅ Items Collected!',
            message: 'Your items have been collected by the rider. They are heading back to the warehouse.',
        },
        returned: {
            type: 'return_completed',
            title: '🎉 Return Complete!',
            message: 'Your return has been completed and processed at the warehouse.',
        },
    };

    const notifConfig = notifications[status];
    if (!notifConfig) return;

    try {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type: notifConfig.type,
                title: notifConfig.title,
                message: notifConfig.message,
                order_id: orderId,
                is_read: false,
            });

        if (error) {
            console.error('Failed to create order status notification:', error);
        }

        // Trigger push notification for key order statuses
        // (fires only for important ones like delivery, pickup, etc.)
        triggerPushForOrderStatus(userId, orderId, status).catch((err) =>
            console.warn('Push notification trigger failed (non-blocking):', err)
        );
    } catch (error) {
        console.error('Failed to create order status notification:', error);
    }
}
