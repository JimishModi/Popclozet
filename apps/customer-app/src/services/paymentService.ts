import { supabase } from '@popclozet/api-client';

/**
 * Get payments for the CURRENT user only.
 * RLS also enforces this at the DB level, but we filter explicitly for defense-in-depth.
 */
export async function getMyPayments() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user.id)  // FIX: was missing — returned ALL users' payments
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getMyPayments error:', error);
    throw error;
  }

  return data;
}

export async function createPayment(
  orderId: string,
  amount: number,
  provider: 'razorpay' | 'cod' = 'razorpay',
  razorpayPaymentId?: string,
  razorpayOrderId?: string,
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  const status = provider === 'cod' ? 'pending_cod' : 'pending';

  const { data, error } = await supabase.from('payments').insert({
    user_id: user.id,
    order_id: orderId,
    amount,
    status,
    provider,
    ...(razorpayPaymentId && { razorpay_payment_id: razorpayPaymentId }),
    ...(razorpayOrderId && { razorpay_order_id: razorpayOrderId }),
  });

  if (error) {
    console.error('createPayment error:', error);
    throw error;
  }

  return data;
}