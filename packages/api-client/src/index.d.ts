/**
 * API Client - Supabase Client & Services
 *
 * @popclozet/api-client v1.0.0
 *
 * Provides Supabase client, order state machine, and realtime service.
 * Apps consume this package; they do not define their own clients.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import type { OrderStatus, ActorRole, TransitionResult, UserRole } from '@popclozet/domain-contracts';
export declare const supabase: SupabaseClient;
export declare const getCurrentUser: () => Promise<import("@supabase/supabase-js").AuthUser | null>;
export declare const getUserRole: () => Promise<UserRole | null>;
/**
 * Transition an order to a new status via server-side state machine
 *
 * NEVER bypass this with direct supabase.from('orders').update()
 * The database has guards preventing direct status updates.
 */
export declare const transitionOrderState: (orderId: string, newStatus: OrderStatus, actorRole: ActorRole, actorId: string) => Promise<TransitionResult>;
/**
 * Get allowed transitions for a given status and role
 * Client-side helper for UI state (e.g., showing/hiding buttons)
 *
 * Note: This is advisory only. Server enforces actual transitions.
 */
export declare const getAllowedTransitions: (currentStatus: OrderStatus, role: ActorRole) => OrderStatus[];
/**
 * Check if a transition is allowed (client-side advisory)
 */
export declare const canTransition: (currentStatus: OrderStatus, targetStatus: OrderStatus, role: ActorRole) => boolean;
type EventCallback<T = unknown> = (payload: T) => void;
declare class RealtimeService {
    private channels;
    subscribeToOrderUpdates(orderId: string, callback: EventCallback): () => void;
    subscribeToRiderLocation(riderId: string, callback: EventCallback): () => void;
    subscribeToProximityUpdates(orderId: string, callback: EventCallback): () => void;
    private unsubscribe;
    unsubscribeAll(): void;
}
export declare const realtimeService: RealtimeService;
export * from './rentalOrderService';
export * from './pickupScheduler';
export * from './config';
//# sourceMappingURL=index.d.ts.map