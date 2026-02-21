import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@popclozet/api-client';

export interface CartItem {
  id: string;
  product_id: string;
  size: string;
  rental_duration_days: number;
  reservation_expires_at: string;
  added_at: string;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('cart_items')
      .select('id, product_id, size, rental_duration_days, reservation_expires_at, added_at')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (!error && data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, reload };
}
