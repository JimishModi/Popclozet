-- ============================================
-- SIMPLIFIED HYGIENE SYSTEM MIGRATION
-- No auto-triggers, manual admin setup
-- ============================================

-- Create products table first (if it doesn't exist)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    rental_price DECIMAL(10, 2),
    gender TEXT NOT NULL CHECK (gender IN ('mens', 'womens', 'unisex')),
    event_category TEXT NOT NULL CHECK (event_category IN ('casual', 'party', 'cocktail', 'formal', 'street', 'vacation', 'wedding', 'office')),
    image_url TEXT,
    video_url TEXT,
    color TEXT NOT NULL,
    sizes TEXT[],
    lead_time_minutes INTEGER,
    rating DECIMAL(3, 2) DEFAULT 5.0,
    stock_quantity INTEGER DEFAULT 1,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create hygiene_sops table
CREATE TABLE IF NOT EXISTS hygiene_sops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    fabric_type TEXT NOT NULL,
    fabric_composition TEXT,
    cleaning_procedure JSONB NOT NULL,
    hygiene_steps JSONB NOT NULL,
    storage_guidelines TEXT NOT NULL,
    inspection_checklist JSONB NOT NULL,
    special_instructions TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, version)
);

-- Create product_qr_codes table
CREATE TABLE IF NOT EXISTS product_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qr_code_data TEXT NOT NULL UNIQUE,
    qr_code_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id)
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add hygiene-related columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS fabric_type TEXT,
ADD COLUMN IF NOT EXISTS fabric_hint TEXT,
ADD COLUMN IF NOT EXISTS hygiene_sop_id UUID REFERENCES hygiene_sops(id),
ADD COLUMN IF NOT EXISTS rental_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_cleaned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS condition_status TEXT DEFAULT 'excellent' CHECK (condition_status IN ('excellent', 'good', 'fair', 'needs_repair'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_event_category ON products(event_category);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_hygiene_sops_product_id ON hygiene_sops(product_id);
CREATE INDEX IF NOT EXISTS idx_product_qr_codes_product_id ON product_qr_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_qr_codes_qr_code_data ON product_qr_codes(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_fabric_type ON products(fabric_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hygiene_sops_updated_at ON hygiene_sops;
CREATE TRIGGER update_hygiene_sops_updated_at
    BEFORE UPDATE ON hygiene_sops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE hygiene_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view available products" ON products;
DROP POLICY IF EXISTS "Admin can manage products" ON products;
DROP POLICY IF EXISTS "Admin and staff can view hygiene SOPs" ON hygiene_sops;
DROP POLICY IF EXISTS "Admin can insert hygiene SOPs" ON hygiene_sops;
DROP POLICY IF EXISTS "Admin can update hygiene SOPs" ON hygiene_sops;
DROP POLICY IF EXISTS "Admin and staff can view QR codes" ON product_qr_codes;
DROP POLICY IF EXISTS "Admin can manage QR codes" ON product_qr_codes;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admin can manage all roles" ON user_roles;

-- Create policies for products (allow all for testing)
CREATE POLICY "Anyone can view available products" ON products
    FOR SELECT
    USING (true);

CREATE POLICY "Anyone can manage products for testing" ON products
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create policies for hygiene_sops (allow all for testing)
CREATE POLICY "Anyone can view hygiene SOPs for testing" ON hygiene_sops
    FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert hygiene SOPs for testing" ON hygiene_sops
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update hygiene SOPs for testing" ON hygiene_sops
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create policies for product_qr_codes (allow all for testing)
CREATE POLICY "Anyone can view QR codes for testing" ON product_qr_codes
    FOR SELECT
    USING (true);

CREATE POLICY "Anyone can manage QR codes for testing" ON product_qr_codes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create policies for user_roles (allow all for testing)
CREATE POLICY "Anyone can view roles for testing" ON user_roles
    FOR SELECT
    USING (true);

CREATE POLICY "Anyone can manage roles for testing" ON user_roles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Hygiene system tables created successfully!';
    RAISE NOTICE '✅ Testing mode enabled - all policies allow full access';
    RAISE NOTICE '📝 You can now test the system without authentication';
END $$;
