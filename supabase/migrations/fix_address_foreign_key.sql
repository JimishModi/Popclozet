-- Fix Foreign Key and NOT NULL Constraint for Address Deletion
-- This allows addresses to be deleted without breaking orders
-- Run this in Supabase SQL Editor

-- Step 1: Make delivery_address_id nullable
ALTER TABLE orders 
ALTER COLUMN delivery_address_id DROP NOT NULL;

-- Step 2: Drop the existing foreign key constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_delivery_address_id_fkey;

-- Step 3: Recreate the constraint with ON DELETE SET NULL
ALTER TABLE orders
ADD CONSTRAINT orders_delivery_address_id_fkey 
FOREIGN KEY (delivery_address_id) 
REFERENCES addresses(id) 
ON DELETE SET NULL;

-- Verify the changes
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'delivery_address_id';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema updated successfully!';
    RAISE NOTICE '📝 delivery_address_id is now nullable';
    RAISE NOTICE '🗑️ Addresses can be deleted without breaking orders';
    RAISE NOTICE '🔗 Orders will have delivery_address_id set to NULL when address is deleted';
END $$;
