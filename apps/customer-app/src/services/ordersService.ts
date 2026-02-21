import { supabase } from '@popclozet/api-client';

export async function getMyOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getMyOrders error:', error);
    throw error;
  }

  return data;
}
