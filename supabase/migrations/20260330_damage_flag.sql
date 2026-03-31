-- Add damage tracking fields to physical units (all_products)
ALTER TABLE all_products
    ADD COLUMN IF NOT EXISTS damage_notes TEXT,
    ADD COLUMN IF NOT EXISTS damage_flagged_at TIMESTAMPTZ;

-- Index for quick lookup of damaged units
CREATE INDEX IF NOT EXISTS idx_all_products_damaged
    ON all_products (status)
    WHERE status = 'damaged';
