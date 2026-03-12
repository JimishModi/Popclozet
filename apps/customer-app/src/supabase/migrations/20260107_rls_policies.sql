-- Migration: Row Level Security (RLS) Policies for Map & Location System
-- This fixes the "unrestricted" error by enabling RLS and creating proper policies

-- ============================================
-- RENTAL HUBS TABLE
-- ============================================
ALTER TABLE rental_hubs ENABLE ROW LEVEL SECURITY;

-- Anyone can read active hubs
CREATE POLICY "Anyone can view active hubs" ON rental_hubs
    FOR SELECT
    USING (is_active = true);

-- Only authenticated admins can insert/update/delete
-- For now, allow all authenticated users (you can restrict this further)
CREATE POLICY "Authenticated users can manage hubs" ON rental_hubs
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- USER ADDRESSES TABLE
-- ============================================
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Users can only see their own addresses
CREATE POLICY "Users can view their own addresses" ON user_addresses
    FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can insert their own addresses
CREATE POLICY "Users can insert their own addresses" ON user_addresses
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own addresses
CREATE POLICY "Users can update their own addresses" ON user_addresses
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own addresses
CREATE POLICY "Users can delete their own addresses" ON user_addresses
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- ============================================
-- DELIVERY ORDERS TABLE
-- ============================================
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view their own orders" ON delivery_orders
    FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can create their own orders
CREATE POLICY "Users can create their own orders" ON delivery_orders
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own orders (for status updates, etc.)
-- In production, you might want to restrict this to certain fields
CREATE POLICY "Users can update their own orders" ON delivery_orders
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Allow authenticated admins/service accounts to update any order
-- This is needed for order status updates from backend/admin panel
CREATE POLICY "Admins can update any order" ON delivery_orders
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Users can delete their own orders (if needed)
CREATE POLICY "Users can delete their own orders" ON delivery_orders
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- ============================================
-- DELIVERY TRACKING TABLE
-- ============================================
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view tracking for their own orders
-- We need to join with delivery_orders to check ownership
CREATE POLICY "Users can view tracking for their orders" ON delivery_tracking
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM delivery_orders
            WHERE delivery_orders.id = delivery_tracking.order_id
            AND delivery_orders.user_id::text = auth.uid()::text
        )
    );

-- Allow authenticated users to insert tracking records
-- This allows drivers/admin apps to create tracking
CREATE POLICY "Authenticated users can create tracking" ON delivery_tracking
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update tracking records
-- This allows driver apps to update vehicle position
CREATE POLICY "Authenticated users can update tracking" ON delivery_tracking
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete tracking records (for cleanup)
CREATE POLICY "Authenticated users can delete tracking" ON delivery_tracking
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Allow authenticated users to create notifications
-- This allows the system to create notifications for users
CREATE POLICY "Authenticated users can create notifications" ON notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own notifications (mark as read, etc.)
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- ============================================
-- DEVELOPMENT/TESTING: PUBLIC ACCESS POLICIES
-- ============================================
-- Uncomment these if you need to test without authentication
-- WARNING: Only use in development! Remove in production!
--
-- DROP POLICY IF EXISTS "Anyone can view active hubs" ON rental_hubs;
-- CREATE POLICY "Public read access for hubs" ON rental_hubs FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "Users can view their own addresses" ON user_addresses;
-- CREATE POLICY "Public read access for addresses" ON user_addresses FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Users can insert their own addresses" ON user_addresses;
-- CREATE POLICY "Public insert access for addresses" ON user_addresses FOR INSERT WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "Users can view their own orders" ON delivery_orders;
-- CREATE POLICY "Public read access for orders" ON delivery_orders FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Users can create their own orders" ON delivery_orders;
-- CREATE POLICY "Public insert access for orders" ON delivery_orders FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Users can update their own orders" ON delivery_orders;
-- CREATE POLICY "Public update access for orders" ON delivery_orders FOR UPDATE USING (true) WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "Users can view tracking for their orders" ON delivery_tracking;
-- CREATE POLICY "Public read access for tracking" ON delivery_tracking FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Authenticated users can create tracking" ON delivery_tracking;
-- CREATE POLICY "Public insert access for tracking" ON delivery_tracking FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Authenticated users can update tracking" ON delivery_tracking;
-- CREATE POLICY "Public update access for tracking" ON delivery_tracking FOR UPDATE USING (true) WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
-- CREATE POLICY "Public read access for notifications" ON notifications FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
-- CREATE POLICY "Public insert access for notifications" ON notifications FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
-- CREATE POLICY "Public update access for notifications" ON notifications FOR UPDATE USING (true) WITH CHECK (true);

