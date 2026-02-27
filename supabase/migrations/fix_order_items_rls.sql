-- Fix RLS Policy for Order Items
-- Run this in Supabase SQL Editor

-- Add INSERT policy for order_items
CREATE POLICY "Users can insert items for their own orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );
