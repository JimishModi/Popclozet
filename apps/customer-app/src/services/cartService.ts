/**
 * Cart Service
 * Handles shopping cart operations
 */

import { supabase } from "@popclozet/api-client";

export interface CartItem {
  id: string;
  cart_id: string;
  item_id: string;
  quantity: number;
  days: number;
  created_at?: string;
  item?: any;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at?: string;
}

/**
 * Get or create user's cart
 */
async function getOrCreateCart(): Promise<Cart> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let { data: cart } = await supabase
    .from("cart")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cart) {
    const { data: newCart, error: createError } = await supabase
      .from("cart")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (createError) throw createError;
    return newCart;
  }

  return cart;
}

/**
 * Get cart items for current user
 */
export async function getMyCart(): Promise<CartItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // First, get the user's cart
  const { data: userCart } = await supabase
    .from("cart")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!userCart) {
    return [];
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      id,
      cart_id,
      item_id,
      quantity,
      days,
      created_at,
      item:item_id (
        id,
        title,
        rental_price_per_day,
        image_url,
        brand,
        category
      )
    `
    )
    .eq("cart_id", userCart.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMyCart error:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Add item to cart
 */
export async function addToCart(itemId: string, quantity: number, days: number) {
  const cart = await getOrCreateCart();

  const { data, error } = await supabase
    .from("cart_items")
    .insert({
      cart_id: cart.id,
      item_id: itemId,
      quantity,
      days,
    })
    .select()
    .single();

  if (error) {
    console.error("addToCart error:", error);
    throw error;
  }

  return data;
}

/**
 * Update cart item
 */
export async function updateCartItem(
  cartItemId: string,
  quantity: number,
  days: number
) {
  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity, days })
    .eq("id", cartItemId)
    .select()
    .single();

  if (error) {
    console.error("Error updating cart item:", error);
    throw error;
  }

  return data;
}

/**
 * Remove item from cart
 */
export async function removeFromCart(cartItemId: string) {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId);

  if (error) {
    console.error('removeFromCart error:', error);
    throw error;
  }
}

/**
 * Get all cart items for current user (alias for getMyCart)
 */
export async function getCartItems(): Promise<CartItem[]> {
  return getMyCart();
}

/**
 * Clear all items from user's cart
 */
export async function clearCart() {
  const cart = await getOrCreateCart();

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id);

  if (error) {
    console.error('clearCart error:', error);
    throw error;
  }
}
