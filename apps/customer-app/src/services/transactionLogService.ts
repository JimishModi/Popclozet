/**
 * Transaction Log Service
 * 
 * Records all financial transactions (payments, refunds, settlements)
 * for audit trail and reporting.
 */

import { supabase } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

export type TransactionType =
    | 'payment'
    | 'refund'
    | 'rider_earning'
    | 'rider_bonus'
    | 'settlement';

export interface TransactionLog {
    id?: string;
    orderId: string;
    userId: string;
    type: TransactionType;
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
    createdAt: string;
}

export interface TransactionFilter {
    userId?: string;
    orderId?: string;
    type?: TransactionType;
    limit?: number;
    offset?: number;
}

// ==========================================
// LOGGING
// ==========================================

/**
 * Log a transaction to the transaction_logs table.
 */
export async function logTransaction(entry: {
    orderId: string;
    userId: string;
    type: TransactionType;
    amount: number;
    metadata?: Record<string, any>;
}): Promise<void> {
    try {
        if (supabase) {
            const { error } = await supabase.from('transaction_logs').insert({
                order_id: entry.orderId,
                user_id: entry.userId,
                type: entry.type,
                amount: entry.amount,
                currency: 'INR',
                metadata: entry.metadata || {},
                created_at: new Date().toISOString(),
            });

            if (error) {
                console.error('Failed to log transaction:', error);
            } else {
                console.log(`💰 Transaction logged: ${entry.type} ₹${entry.amount} for order ${entry.orderId.slice(0, 8)}`);
            }
        }
    } catch (err) {
        console.error('Transaction logging failed:', err);
    }
}

// ==========================================
// RETRIEVAL
// ==========================================

/**
 * Get transaction history with pagination and filtering.
 */
export async function getTransactionHistory(
    filter: TransactionFilter = {}
): Promise<TransactionLog[]> {
    if (!supabase) return [];

    let query = supabase
        .from('transaction_logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (filter.userId) query = query.eq('user_id', filter.userId);
    if (filter.orderId) query = query.eq('order_id', filter.orderId);
    if (filter.type) query = query.eq('type', filter.type);
    if (filter.limit) query = query.limit(filter.limit);
    if (filter.offset) query = query.range(filter.offset, filter.offset + (filter.limit || 20) - 1);

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch transaction history:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        userId: row.user_id,
        type: row.type,
        amount: row.amount,
        currency: row.currency,
        metadata: row.metadata,
        createdAt: row.created_at,
    }));
}

/**
 * Get settlement summary for a rider.
 */
export async function getRiderSettlementSummary(riderId: string): Promise<{
    totalEarnings: number;
    pendingSettlement: number;
    completedSettlements: number;
}> {
    const earnings = await getTransactionHistory({
        userId: riderId,
        type: 'rider_earning',
    });

    const settlements = await getTransactionHistory({
        userId: riderId,
        type: 'settlement',
    });

    const totalEarnings = earnings.reduce((sum, t) => sum + t.amount, 0);
    const completedSettlements = settlements.reduce((sum, t) => sum + t.amount, 0);

    return {
        totalEarnings,
        pendingSettlement: totalEarnings - completedSettlements,
        completedSettlements,
    };
}
