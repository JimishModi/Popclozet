-- Migration: Development RLS Policies (PUBLIC ACCESS - TESTING ONLY!)
-- WARNING: This removes all security! Only use for development/testing!
-- DO NOT USE IN PRODUCTION!

-- Disable RLS temporarily to drop existing policies
ALTER TABLE rental_hubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE rental_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create public access policies (NO SECURITY - FOR TESTING ONLY!)
-- RENTAL HUBS
CREATE POLICY "Public read access for hubs" ON rental_hubs
    FOR SELECT USING (true);
CREATE POLICY "Public write access for hubs" ON rental_hubs
    FOR ALL USING (true) WITH CHECK (true);

-- USER ADDRESSES
CREATE POLICY "Public access for addresses" ON user_addresses
    FOR ALL USING (true) WITH CHECK (true);

-- DELIVERY ORDERS
CREATE POLICY "Public access for orders" ON delivery_orders
    FOR ALL USING (true) WITH CHECK (true);

-- DELIVERY TRACKING
CREATE POLICY "Public access for tracking" ON delivery_tracking
    FOR ALL USING (true) WITH CHECK (true);

-- NOTIFICATIONS
CREATE POLICY "Public access for notifications" ON notifications
    FOR ALL USING (true) WITH CHECK (true);

-- NOTE: After testing, run the production RLS policies file:
-- 20260107_rls_policies.sql

