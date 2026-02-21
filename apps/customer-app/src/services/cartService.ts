import { supabase } from '@popclozet/api-client';

export async function getMyCart() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('cart_items')
    .select('id, product_id, size, rental_duration_days, reservation_expires_at, added_at')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('getMyCart error:', error);
    throw error;
  }

  return data ?? [];
}

export async function addToCart(productId: string, size: string, rentalDays: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      user_id: user.id,
      product_id: productId,
      size,
      rental_duration_days: rentalDays,
      reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('addToCart error:', error);
    throw error;
  }

  return data;
}

export async function removeFromCart(cartItemId: string) {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId);

  if (error) {
    console.error('removeFromCart error:', error);
    throw error;
  }
}
