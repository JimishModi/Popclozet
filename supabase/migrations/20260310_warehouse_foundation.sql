-- Warehouse Foundation Migration (Aligned with provided schema)
-- Finalizes inventory and product tracking for warehouse operations.

-- =====================================================
-- PRODUCTS TABLE REFINEMENT (Assumed existing, but ensuring columns)
-- =====================================================
-- =====================================================
-- ROLE & PROFILE REFINEMENT
-- =====================================================
DO $$ 
BEGIN 
    -- Relax the role constraint to include 'admin'
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role = ANY (ARRAY['customer'::text, 'rider'::text, 'warehouse'::text, 'admin'::text]));
END $$;

-- =====================================================
-- INVENTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    available_stock INTEGER NOT NULL DEFAULT 0,
    went_for_wash INTEGER NOT NULL DEFAULT 0,
    total_stock INTEGER GENERATED ALWAYS AS (available_stock + went_for_wash) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Handle case where table existed without total_stock as generated column
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='total_stock' AND is_generated = 'NO') THEN
        ALTER TABLE public.inventory DROP COLUMN total_stock;
        ALTER TABLE public.inventory ADD COLUMN total_stock INTEGER GENERATED ALWAYS AS (available_stock + went_for_wash) STORED;
    END IF;
END $$;

-- =====================================================
-- ALL PRODUCTS (PHYSICAL UNITS)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.all_products (
  individual_id TEXT NOT NULL,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL DEFAULT true,
  last_rented TIMESTAMPTZ,
  last_washed TIMESTAMPTZ,
  times_rented INTEGER NOT NULL DEFAULT 0,
  times_washed INTEGER NOT NULL DEFAULT 0,
  mrp_price NUMERIC,
  actual_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'available'::TEXT CHECK (status = ANY (ARRAY['available'::TEXT, 'rented'::TEXT, 'returned'::TEXT, 'washing'::TEXT, 'ready'::TEXT])),
  CONSTRAINT all_products_pkey PRIMARY KEY (individual_id)
);

-- =====================================================
-- WAREHOUSE & RIDERS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  pincode TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT warehouses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.riders (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  warehouse_id UUID REFERENCES public.warehouses(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT riders_pkey PRIMARY KEY (id)
);

-- =====================================================
-- ORDERS TABLE UPDATES
-- =====================================================
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='status') THEN
        ALTER TABLE public.orders ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='lifecycle_state') THEN
        ALTER TABLE public.orders ADD COLUMN lifecycle_state TEXT DEFAULT 'placed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='otp_delivery') THEN
        ALTER TABLE public.orders ADD COLUMN otp_delivery TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='otp_return') THEN
        ALTER TABLE public.orders ADD COLUMN otp_return TEXT;
    END IF;
END $$;

-- =====================================================
-- ACTIVITY & JOBS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.warehouse_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT warehouse_activity_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fulfillment_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  job_type TEXT,
  job_status TEXT DEFAULT 'waiting'::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT fulfillment_jobs_pkey PRIMARY KEY (id)
);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Sync status and lifecycle_state
CREATE OR REPLACE FUNCTION public.sync_order_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status IS NULL THEN NEW.status := 'pending'; END IF;
        IF NEW.lifecycle_state IS NULL THEN NEW.lifecycle_state := 'placed'; END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.lifecycle_state := NEW.status;
        ELSIF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
            NEW.status := NEW.lifecycle_state;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_order_status ON public.orders;
CREATE TRIGGER trg_sync_order_status
    BEFORE INSERT OR UPDATE OF status, lifecycle_state ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_order_status();

-- =====================================================
-- STOCK SYNCHRONIZATION (Automated)
-- =====================================================

-- Function to update inventory counts based on item status changes
CREATE OR REPLACE FUNCTION public.sync_inventory_on_product_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_inv_id UUID;
BEGIN
    v_inv_id := COALESCE(NEW.inventory_id, OLD.inventory_id);

    -- Sync 'available' boolean strictly based on status
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.status = 'available' THEN
            NEW.available := true;
        ELSE
            NEW.available := false;
        END IF;
    END IF;

    -- Update Inventory Counts
    -- Decr OLD status counts
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF OLD.status = 'available' OR OLD.status = 'ready' THEN
            UPDATE public.inventory SET available_stock = available_stock - 1 WHERE id = OLD.inventory_id;
        ELSIF OLD.status = 'washing' THEN
            UPDATE public.inventory SET went_for_wash = went_for_wash - 1 WHERE id = OLD.inventory_id;
        END IF;
    END IF;

    -- Incr NEW status counts
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.status = 'available' OR NEW.status = 'ready' THEN
            UPDATE public.inventory SET available_stock = available_stock + 1 WHERE id = NEW.inventory_id;
        ELSIF NEW.status = 'washing' THEN
            UPDATE public.inventory SET went_for_wash = went_for_wash + 1 WHERE id = NEW.inventory_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_on_product_status_change ON public.all_products;
CREATE TRIGGER trg_sync_inventory_on_product_status_change
    BEFORE INSERT OR UPDATE OF status OR DELETE ON public.all_products
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_inventory_on_product_status_change();

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.all_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_activity_log ENABLE ROW LEVEL SECURITY;

-- Basic Warehouse & Admin Role Policies
CREATE POLICY "Warehouse & Admin access inventory" ON public.inventory
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE role IN ('warehouse', 'admin')));

CREATE POLICY "Warehouse & Admin access all_products" ON public.all_products
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE role IN ('warehouse', 'admin')));

CREATE POLICY "Warehouse & Admin read orders" ON public.orders
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE role IN ('warehouse', 'admin')));

CREATE POLICY "Warehouse & Admin update orders" ON public.orders
    FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE role IN ('warehouse', 'admin')));
