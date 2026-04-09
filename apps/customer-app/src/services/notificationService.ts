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
  | "driver_arrived_location"
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
 * Delete all notifications for current user
 */
export async function clearAllNotifications(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Error clearing all notifications:", error);
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
  instanceId?: string,
  onNotificationUpdate?: (notification: Notification) => void,
  onNotificationDelete?: (notificationId: string) => void
): Promise<RealtimeChannel> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user.id) {
      // Not authenticated — return a silent no-op channel.
      // Throwing here crashes iOS Safari because the error propagates
      // out of unguarded async IIFEs in callers.
      console.warn('[notificationService] subscribeToNotifications: no session, skipping realtime');
      return supabase.channel(`noop-no-auth-${Math.random().toString(36).slice(2, 9)}`).subscribe(
        (status, err) => { if (err) console.warn('[notificationService] noop channel:', err); }
      );
    }

    const userId = data.session.user.id;
    const channelName = instanceId
      ? `notifications:${userId}:${instanceId}`
      : `notifications:${userId}:${Math.random().toString(36).slice(2, 9)}`;

    return supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNewNotification(payload.new as Notification);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotificationUpdate?.(payload.new as Notification);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) onNotificationDelete?.(deletedId);
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn('[notificationService] Realtime subscription error (non-fatal):', err);
      });
  } catch (err) {
    // Catch any unexpected errors (e.g. iOS Safari WebSocket security errors)
    // so callers never crash.
    console.warn('[notificationService] subscribeToNotifications failed (non-fatal):', err);
    return supabase.channel(`noop-error-${Math.random().toString(36).slice(2, 9)}`).subscribe(
      (status, subErr) => { if (subErr) console.warn('[notificationService] noop channel:', subErr); }
    );
  }
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

/**
 * Notify about order status changes.
 *
 * IMPORTANT: In-app notifications (DB inserts into `notifications` table) are
 * now handled by the backend notification-webhook, which fires on DB triggers
 * for order status changes. This function only triggers a best-effort client-side
 * push notification as a fallback — the primary notification path is server-side.
 *
 * Do NOT insert into the `notifications` table here to avoid duplicates.
 */
export async function notifyOrderStatusChange(
    userId: string,
    orderId: string,
    status: string
): Promise<void> {
    // Best-effort push notification as client-side fallback.
    // The backend webhook is the primary notification source.
    triggerPushForOrderStatus(userId, orderId, status).catch((err) =>
        console.warn('Push notification trigger failed (non-blocking):', err)
    );
}
