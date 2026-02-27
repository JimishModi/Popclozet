/**
 * Notifications Service
 * Handle user notifications and preferences
 */

import { supabase } from "@popclozet/api-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NotificationType =
  | "general"
  | "order_update"
  | "delivery_update"
  | "price_drop"
  | "new_arrival"
  | "rental_reminder"
  | "order_confirmed"
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
export function subscribeToNotifications(
  onNewNotification: (notification: Notification) => void
): RealtimeChannel {
  const channel = supabase.auth.getSession().then(({ data }) => {
    if (!data.session?.user.id) {
      throw new Error("Not authenticated");
    }

    return supabase
      .channel(`notifications:${data.session.user.id}`)
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
  });

  return channel as any;
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
    orderId: string,
    newStatus: string
): Promise<void> {
    const statusToType: Record<string, NotificationType> = {
        confirmed: 'order_confirmed',
        out_for_delivery: 'out_for_delivery',
        delivered: 'delivered',
        pickup_scheduled: 'pickup_scheduled',
        picked_up: 'pickup_completed',
        return_scheduled: 'return_scheduled',
        return_completed: 'return_completed',
    };

    const type = statusToType[newStatus];
    if (type) {
        await createNotification(type, orderId);
    }
}
