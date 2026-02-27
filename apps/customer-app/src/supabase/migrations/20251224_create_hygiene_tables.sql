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

-- Create user_roles table (if not exists)
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

-- Create indexes for better performance
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

-- Create trigger for hygiene_sops
DROP TRIGGER IF EXISTS update_hygiene_sops_updated_at ON hygiene_sops;
CREATE TRIGGER update_hygiene_sops_updated_at
    BEFORE UPDATE ON hygiene_sops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE hygiene_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for hygiene_sops (admin and staff can read/write)
CREATE POLICY "Admin and staff can view hygiene SOPs" ON hygiene_sops
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Admin can insert hygiene SOPs" ON hygiene_sops
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admin can update hygiene SOPs" ON hygiene_sops
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Create policies for product_qr_codes
CREATE POLICY "Admin and staff can view QR codes" ON product_qr_codes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Admin can manage QR codes" ON product_qr_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Create policies for user_roles (only admin can manage)
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all roles" ON user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );
