-- Create gender enum
CREATE TYPE gender_category AS ENUM ('mens', 'womens', 'unisex');

-- Create event enum  
CREATE TYPE event_category AS ENUM (
  'casual', 'party', 'cocktail', 'formal', 
  'street', 'vacation', 'wedding', 'office'
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  rental_price DECIMAL(10,2),
  gender gender_category NOT NULL,
  event_category event_category NOT NULL,
  image_url TEXT NOT NULL,
  video_url TEXT,
  color TEXT,
  sizes TEXT[],
  lead_time_minutes INTEGER DEFAULT 60,
  rating DECIMAL(2,1) DEFAULT 4.5,
  stock_quantity INTEGER DEFAULT 1,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_gender ON products(gender);
CREATE INDEX idx_products_event ON products(event_category);
CREATE INDEX idx_products_gender_event ON products(gender, event_category);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT
  USING (is_available = true);

CREATE POLICY "Only admins can insert products"
  ON products FOR INSERT
  WITH CHECK (false); -- Update when admin auth is implemented

CREATE POLICY "Only admins can update products"
  ON products FOR UPDATE
  USING (false); -- Update when admin auth is implemented

CREATE POLICY "Only admins can delete products"
  ON products FOR DELETE
  USING (false); -- Update when admin auth is implemented

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
