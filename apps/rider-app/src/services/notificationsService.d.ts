/**
 * Notifications Service
 *
 * Handles rider notifications and real-time updates
 */
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
/**
 * Get all notifications for a rider
 */
export declare function getNotifications(riderId: string, limit?: number, unreadOnly?: boolean): Promise<RiderNotification[]>;
/**
 * Get unread notification count
 */
export declare function getUnreadCount(riderId: string): Promise<number>;
/**
 * Mark a notification as read
 */
export declare function markAsRead(notificationId: string): Promise<boolean>;
/**
 * Mark all notifications as read
 */
export declare function markAllAsRead(riderId: string): Promise<boolean>;
/**
 * Delete a notification
 */
export declare function deleteNotification(notificationId: string): Promise<boolean>;
/**
 * Clear all notifications
 */
export declare function clearAllNotifications(riderId: string): Promise<boolean>;
/**
 * Subscribe to new notifications
 */
export declare function subscribeToNotifications(riderId: string, callback: (notification: RiderNotification) => void): () => Promise<"error" | "ok" | "timed out">;
/**
 * Get notification icon based on type
 */
export declare function getNotificationIcon(type: RiderNotification['type']): string;
/**
 * Format notification time for display
 */
export declare function formatNotificationTime(createdAt: string): string;
