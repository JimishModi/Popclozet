import { supabase } from '@popclozet/api-client';

export async function getMyPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getMyPayments error:', error);
    throw error;
  }

  return data;
}

export async function createPayment(orderId: string, amount: number) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.from('payments').insert({
    user_id: user.id,
    order_id: orderId,
    amount,
    status: 'pending',
  });

  if (error) {
    console.error('createPayment error:', error);
    throw error;
  }

  return data;
}
