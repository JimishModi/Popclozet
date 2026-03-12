/**
 * Wallet Service
 * Handles rider wallet operations: balance, transactions, withdrawals
 */

import { supabase, config } from '@popclozet/api-client';

// ==========================================
// TYPES
// ==========================================

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
  description?: string;
  orderId?: string;
  createdAt: string;
}

export interface BankDetails {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  bankName: string;
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

// ==========================================
// WALLET
// ==========================================

export async function getWalletBalance(
  riderId: string
): Promise<WalletBalance | null> {
  if (config.USE_MOCK_DATA) {
    return {
      balance: 12500.50,
      pendingWithdrawals: 2000,
      lastUpdated: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('wallets')
    .select('balance, pending_withdrawals, updated_at')
    .eq('rider_id', riderId)
    .single();

  if (error || !data) {
    console.error('Wallet fetch failed:', error);
    return null;
  }

  return {
    balance: Number(data.balance),
    pendingWithdrawals: Number(data.pending_withdrawals),
    lastUpdated: data.updated_at,
  };
}

// ==========================================
// TRANSACTIONS
// ==========================================

export async function getTransactions(
  riderId: string,
  limit = 20,
  offset = 0
): Promise<Transaction[]> {
  if (config.USE_MOCK_DATA) {
    return [
      {
        id: 'tx-123',
        riderId,
        type: 'earning',
        amount: 150,
        description: 'Delivery #ORDER-123',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx-124',
        riderId,
        type: 'bonus',
        amount: 50,
        description: 'Peak hour bonus',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((tx: any) => ({
    id: tx.id,
    riderId: tx.rider_id,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
    orderId: tx.order_id,
    createdAt: tx.created_at,
  }));
}

export async function getTransactionsByType(
  riderId: string,
  type: Transaction['type'],
  limit = 20
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('rider_id', riderId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((tx: any) => ({
    id: tx.id,
    riderId: tx.rider_id,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
    orderId: tx.order_id,
    createdAt: tx.created_at,
  }));
}

// ==========================================
// WITHDRAWALS
// ==========================================

export async function requestWithdrawal(
  riderId: string,
  amount: number,
  bankDetails: BankDetails
) {
  if (amount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  const wallet = await getWalletBalance(riderId);
  if (!wallet || wallet.balance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const { data, error } = await supabase
    .from('withdrawal_requests')
    .insert({
      rider_id: riderId,
      amount,
      bank_details: bankDetails,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return { success: false, error: error.message };
  }

  return { success: true, withdrawalId: data.id };
}

export async function getWithdrawalHistory(
  riderId: string,
  limit = 10
): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

// ==========================================
// EARNINGS SUMMARY (USED BY HOMEPAGE)
// ==========================================

export interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  ordersToday: number;
  bonusToday: number;
  avgPerOrder: number;
}

export async function getEarningsSummary(
  riderId: string
): Promise<EarningsSummary> {
  if (config.USE_MOCK_DATA) {
    return {
      today: 1250,
      thisWeek: 8750,
      thisMonth: 35000,
      ordersToday: 8,
      bonusToday: 200,
      avgPerOrder: 156,
    };
  }

  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: todayData } = await supabase
    .from('payments')
    .select('amount, type')
    .eq('rider_id', riderId)
    .gte('created_at', today);

  const { data: weekData } = await supabase
    .from('payments')
    .select('amount')
    .eq('rider_id', riderId)
    .gte('created_at', week);

  const { data: monthData } = await supabase
    .from('payments')
    .select('amount')
    .eq('rider_id', riderId)
    .gte('created_at', month);

  const earnings = (todayData || []).filter(d => d.type === 'earning');
  const bonus = (todayData || []).filter(d => d.type === 'bonus');

  const sum = (arr: any[]) => arr.reduce((s, x) => s + Number(x.amount), 0);

  return {
    today: sum(earnings) + sum(bonus),
    thisWeek: sum(weekData || []),
    thisMonth: sum(monthData || []),
    ordersToday: earnings.length,
    bonusToday: sum(bonus),
    avgPerOrder: earnings.length ? sum(earnings) / earnings.length : 0,
  };
}

// ==========================================
// CREDIT EARNINGS
// ==========================================

export const EARNINGS_CONFIG = {
  deliveryFee: 50,
  pickupFee: 40,
  bonusPerKm: 5,
};

export async function creditDeliveryEarning(
  riderId: string,
  orderId: string,
  distanceKm = 0
) {
  const extraKm = Math.max(0, distanceKm - 2);
  const amount = EARNINGS_CONFIG.deliveryFee + extraKm * EARNINGS_CONFIG.bonusPerKm;

  if (config.USE_MOCK_DATA) {
    return { success: true, amount };
  }

  const { error } = await supabase.from('payments').insert({
    rider_id: riderId,
    order_id: orderId,
    type: 'earning',
    amount,
  });

  if (error) {
    console.error(error);
    return { success: false, amount: 0 };
  }

  return { success: true, amount };
}
