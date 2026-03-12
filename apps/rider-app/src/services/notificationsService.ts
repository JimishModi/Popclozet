/**
 * Notifications Service
 * 
 * Handles rider notifications and real-time updates
 */

import { supabase, config } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export interface RiderNotification {
    id: string;
    riderId: string;
    type: 'order' | 'payment' | 'bonus' | 'system' | 'promotion';
    title: string;
    message: string;
    data?: Record<string, any>;
    isRead: boolean;
    createdAt: string;
}

// ==========================================
// NOTIFICATION OPERATIONS
// ==========================================

export async function getNotifications(
    riderId: string,
    limit: number = 50,
    unreadOnly: boolean = false
): Promise<RiderNotification[]> {
    if (config.USE_MOCK_DATA) {
        return [
            {
                id: 'notif-1',
                riderId,
                type: 'system',
                title: 'Welcome to PopClozet!',
                message: 'Your account has been verified. You can now start accepting orders.',
                isRead: false,
                createdAt: new Date().toISOString(),
            }
        ];
    }

    let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', riderId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (unreadOnly) {
        query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    }

    return (data || []).map((n: any) => ({
        id: n.id,
        riderId: n.rider_id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        isRead: n.is_read,
        createdAt: n.created_at,
    }));
}

export async function getUnreadCount(riderId: string): Promise<number> {
    if (config.USE_MOCK_DATA) return 1;

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', riderId)
        .eq('is_read', false);

    if (error) {
        console.error('Failed to count unread notifications:', error);
        return 0;
    }

    return count || 0;
}

export async function markAsRead(notificationId: string): Promise<boolean> {
    if (config.USE_MOCK_DATA) return true;

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    if (error) {
        console.error('Failed to mark notification as read:', error);
        return false;
    }

    return true;
}

export async function markAllAsRead(riderId: string): Promise<boolean> {
    if (config.USE_MOCK_DATA) return true;

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', riderId)
        .eq('is_read', false);

    if (error) {
        console.error('Failed to mark all notifications as read:', error);
        return false;
    }

    return true;
}

export async function deleteNotification(notificationId: string): Promise<boolean> {
    if (config.USE_MOCK_DATA) return true;

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) {
        console.error('Failed to delete notification:', error);
        return false;
    }

    return true;
}

export async function clearAllNotifications(riderId: string): Promise<boolean> {
    if (config.USE_MOCK_DATA) return true;

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', riderId);

    if (error) {
        console.error('Failed to clear notifications:', error);
        return false;
    }

    return true;
}

// ==========================================
// REALTIME SUBSCRIPTIONS
// ==========================================

export function subscribeToNotifications(
    riderId: string,
    callback: (notification: RiderNotification) => void
) {
    if (config.USE_MOCK_DATA) {
        return () => { }; // No-op for mock
    }

    const channel = supabase
        .channel(`rider_notifications_${riderId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'rider_notifications', // Still mismatched table name here, but keeping it for now
                filter: `rider_id=eq.${riderId}`,
            },
            (payload) => {
                callback({
                    id: payload.new.id,
                    riderId: payload.new.rider_id,
                    type: payload.new.type,
                    title: payload.new.title,
                    message: payload.new.message,
                    data: payload.new.data,
                    isRead: payload.new.is_read,
                    createdAt: payload.new.created_at,
                });
            }
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
}

// ==========================================
// NOTIFICATION HELPERS
// ==========================================

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: RiderNotification['type']): string {
    switch (type) {
        case 'order':
            return '📦';
        case 'payment':
            return '💰';
        case 'bonus':
            return '🎁';
        case 'promotion':
            return '🎉';
        case 'system':
        default:
            return '🔔';
    }
}

/**
 * Format notification time for display
 */
export function formatNotificationTime(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}
