// src/services/notificationService.ts
// In-app notifications with Supabase — RLS-safe (no userId params for read/write)

import { supabase } from '@popclozet/api-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type NotificationType =
    | 'order_confirmed'
    | 'out_for_delivery'
    | 'delivered'
    | 'pickup_scheduled'
    | 'pickup_completed'
    | 'return_scheduled'
    | 'return_completed'
    | 'general';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    order_id: string | null;
    is_read: boolean;
    created_at: string;
}

// Notification templates
const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; message: string }> = {
    order_confirmed: {
        title: 'Order Confirmed! 🎉',
        message: 'Your rental order has been confirmed. We\'ll notify you when it\'s out for delivery.',
    },
    out_for_delivery: {
        title: 'On the way! 🚗',
        message: 'Your order is out for delivery. Track it in real-time on the map.',
    },
    delivered: {
        title: 'Delivered! ✅',
        message: 'Your rental has been delivered. Enjoy your outfit!',
    },
    pickup_scheduled: {
        title: 'Pickup Scheduled 📦',
        message: 'Your pickup has been scheduled. We\'ll be there soon!',
    },
    pickup_completed: {
        title: 'Pickup Complete ✅',
        message: 'We\'ve picked up your rental items. Thank you!',
    },
    return_scheduled: {
        title: 'Return Scheduled 🔄',
        message: 'Your return pickup has been scheduled.',
    },
    return_completed: {
        title: 'Return Complete ✅',
        message: 'Your items have been returned successfully.',
    },
    general: {
        title: 'PopClozet',
        message: 'You have a new notification.',
    },
};

/* ================================
   CREATE  (RLS-safe: user_id from auth)
================================ */

export async function createNotification(
    type: NotificationType = 'general',
    orderId?: string,
    customTitle?: string,
    customMessage?: string
): Promise<Notification> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const template = NOTIFICATION_TEMPLATES[type];

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: user.id,
            type,
            title: customTitle ?? template.title,
            message: customMessage ?? template.message,
            order_id: orderId ?? null,
            is_read: false,
        })
        .select()
        .single();

    if (error) {
        console.error('❌ createNotification failed', error);
        throw error;
    }

    return data;
}

/* ================================
   READ  (RLS-safe: no userId param)
================================ */

export async function getNotifications(limit = 20): Promise<Notification[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    }

    return data ?? [];
}

export async function getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

    if (error) {
        console.error('Failed to fetch unread count:', error);
        return 0;
    }

    return count ?? 0;
}

/* ================================
   UPDATE  (RLS-safe)
================================ */

export async function markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    return !error;
}

export async function markAllAsRead(): Promise<boolean> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

    return !error;
}

/* ================================
   REALTIME  (needs userId for filter)
================================ */

export async function subscribeToNotifications(
    onNewNotification: (notification: Notification) => void
): Promise<RealtimeChannel | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
                onNewNotification(payload.new as Notification);
            }
        )
        .subscribe();

    return channel;
}

export function unsubscribeFromNotifications(channel: RealtimeChannel) {
    supabase?.removeChannel(channel);
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
