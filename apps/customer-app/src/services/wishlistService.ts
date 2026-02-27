// src/services/wishlistService.ts
import { supabase } from '@popclozet/api-client';

export async function getWishlist() {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function addToWishlist(productId: string) {
  const { error } = await supabase
    .from('wishlist_items')
    .insert({ product_id: productId });

  if (error) throw error;
}

export async function removeFromWishlist(productId: string) {
  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('product_id', productId);

  if (error) throw error;
}
