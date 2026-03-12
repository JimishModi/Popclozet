-- Fix RLS Policy for Order Updates (Cancel Order)
-- This allows users to update (cancel) their own orders
-- Run this in Supabase SQL Editor

-- Add UPDATE policy for orders
CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'orders' AND cmd = 'UPDATE';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Order UPDATE policy created successfully!';
    RAISE NOTICE '📝 Users can now cancel their own orders';
    RAISE NOTICE '🔄 Order status updates will persist in database';
END $$;
