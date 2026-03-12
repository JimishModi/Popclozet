/**
 * Wallet Service
 *
 * Handles rider wallet operations: balance, transactions, withdrawals
 */
export interface WalletBalance {
    balance: number;
    pendingWithdrawals: number;
    lastUpdated: string;
}
export interface Transaction {
    id: string;
    riderId: string;
    type: 'earning' | 'bonus' | 'withdrawal' | 'refund';
    amount: number;
    description: string;
    orderId?: string;
    createdAt: string;
}
export interface WithdrawalRequest {
    id: string;
    riderId: string;
    amount: number;
    bankDetails: BankDetails;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    processedAt?: string;
}
export interface BankDetails {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName: string;
}
/**
 * Get rider's wallet balance
 */
export declare function getWalletBalance(riderId: string): Promise<WalletBalance | null>;
/**
 * Get transaction history
 */
export declare function getTransactions(riderId: string, limit?: number, offset?: number): Promise<Transaction[]>;
/**
 * Get transactions by type
 */
export declare function getTransactionsByType(riderId: string, type: Transaction['type'], limit?: number): Promise<Transaction[]>;
/**
 * Request a withdrawal
 */
export declare function requestWithdrawal(riderId: string, amount: number, bankDetails: BankDetails): Promise<{
    success: boolean;
    error?: string;
    withdrawalId?: string;
}>;
/**
 * Get withdrawal history
 */
export declare function getWithdrawalHistory(riderId: string, limit?: number): Promise<WithdrawalRequest[]>;
/**
 * Get pending withdrawal amount
 */
export declare function getPendingWithdrawals(riderId: string): Promise<number>;
export interface EarningsSummary {
    today: number;
    thisWeek: number;
    thisMonth: number;
    ordersToday: number;
    bonusToday: number;
    avgPerOrder: number;
}
/**
 * Get earnings summary for dashboard
 */
export declare function getEarningsSummary(riderId: string): Promise<EarningsSummary>;
/**
 * Mock earnings configuration
 */
export declare const EARNINGS_CONFIG: {
    deliveryFee: number;
    pickupFee: number;
    bonusPerKm: number;
    rushHourBonus: number;
};
/**
 * Credit delivery earning to rider wallet
 * Called when delivery is confirmed via OTP
 */
export declare function creditDeliveryEarning(riderId: string, orderId: string, distanceKm?: number): Promise<{
    success: boolean;
    amount: number;
    error?: string;
}>;
/**
 * Credit pickup earning to rider wallet
 * Called when item is returned to warehouse
 */
export declare function creditPickupEarning(riderId: string, orderId: string, distanceKm?: number): Promise<{
    success: boolean;
    amount: number;
    error?: string;
}>;
