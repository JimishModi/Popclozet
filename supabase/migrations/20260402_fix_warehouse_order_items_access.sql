-- Fix warehouse access to order_items
-- Previously, only customers could select their order_items. This caused 0 items to appear for warehouse staff.

DO $$ 
BEGIN 
    -- Drop if exists just in case
    DROP POLICY IF EXISTS "Warehouse & Admin access order_items" ON public.order_items;
END $$;

CREATE POLICY "Warehouse & Admin access order_items" ON public.order_items
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE role IN ('warehouse', 'admin')));
