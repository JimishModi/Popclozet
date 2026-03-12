-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for geospatial queries (optional but recommended)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'rider', 'warehouse')),
  measurements JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- ADDRESSES TABLE
-- =====================================================
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  full_address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geohash TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_geohash ON addresses(geohash);

-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for addresses
CREATE POLICY "Users can view their own addresses"
  ON addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses"
  ON addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses"
  ON addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses"
  ON addresses FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('men', 'women', 'unisex')),
  occasion TEXT[] NOT NULL,
  rental_price DECIMAL(10,2) NOT NULL CHECK (rental_price > 0),
  deposit_amount DECIMAL(10,2) NOT NULL CHECK (deposit_amount >= 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  fabric_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  sizes_available JSONB NOT NULL DEFAULT '[]'::jsonb,
  hygiene_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_products_gender ON products(gender);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_available ON products(is_available);
CREATE INDEX idx_products_occasion ON products USING GIN(occasion);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products (public read)
CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  USING (is_available = TRUE);

-- =====================================================
-- CART_ITEMS TABLE
-- =====================================================
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size TEXT NOT NULL,
  rental_duration_days INTEGER NOT NULL CHECK (rental_duration_days > 0),
  reservation_expires_at TIMESTAMPTZ NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_cart_items_expires_at ON cart_items(reservation_expires_at);

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cart_items
CREATE POLICY "Users can view their own cart items"
  ON cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart items"
  ON cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  delivery_address_id UUID REFERENCES addresses(id) NOT NULL,
  rental_start_date DATE NOT NULL,
  rental_end_date DATE,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  deposit_amount DECIMAL(10,2) NOT NULL CHECK (deposit_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'packed', 'dispatched', 
    'out_for_delivery', 'delivered', 'in_use', 
    'return_requested', 'return_dispatched', 'return_picked_up', 
    'returned', 'completed', 'cancelled'
  )),
  delivery_eta TIMESTAMPTZ,
  rider_id UUID,
  rider_distance DOUBLE PRECISION,
  otp_delivery TEXT,
  otp_return TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_rider_id ON orders(rider_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- ORDER_ITEMS TABLE
-- =====================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  size TEXT NOT NULL,
  rental_price DECIMAL(10,2) NOT NULL CHECK (rental_price > 0),
  deposit_amount DECIMAL(10,2) NOT NULL CHECK (deposit_amount >= 0),
  rental_duration_days INTEGER NOT NULL CHECK (rental_duration_days > 0)
);

-- Create indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
CREATE POLICY "Users can view items from their own orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- =====================================================
-- RETURN_REQUESTS TABLE
-- =====================================================
CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  pickup_address_id UUID REFERENCES addresses(id) NOT NULL,
  pickup_slot TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'dispatched', 'picked_up', 'completed', 'rejected'
  )),
  pickup_eta TIMESTAMPTZ,
  rider_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);

-- Enable RLS
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for return_requests
CREATE POLICY "Users can view their own return requests"
  ON return_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = return_requests.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert return requests for their orders"
  ON return_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = return_requests.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- =====================================================
-- RIDER_LOCATIONS TABLE
-- =====================================================
CREATE TABLE rider_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_rider_locations_rider_id ON rider_locations(rider_id);
CREATE INDEX idx_rider_locations_timestamp ON rider_locations(timestamp DESC);

-- Enable RLS
ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rider_locations (customers can view)
CREATE POLICY "Users can view rider locations for their orders"
  ON rider_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.rider_id = rider_locations.rider_id
      AND orders.user_id = auth.uid()
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- OTP VERIFICATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION verify_order_otp(
  p_order_id UUID,
  p_otp_code TEXT,
  p_otp_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_stored_otp TEXT;
  v_result JSONB;
BEGIN
  -- Get the stored OTP based on type
  IF p_otp_type = 'delivery' THEN
    SELECT otp_delivery INTO v_stored_otp
    FROM orders
    WHERE id = p_order_id;
  ELSIF p_otp_type = 'return' THEN
    SELECT otp_return INTO v_stored_otp
    FROM orders
    WHERE id = p_order_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid OTP type');
  END IF;

  -- Check if OTP matches
  IF v_stored_otp = p_otp_code THEN
    -- Update order status based on type
    IF p_otp_type = 'delivery' THEN
      UPDATE orders
      SET status = 'delivered',
          updated_at = NOW()
      WHERE id = p_order_id;
    ELSIF p_otp_type = 'return' THEN
      UPDATE orders
      SET status = 'return_picked_up',
          updated_at = NOW()
      WHERE id = p_order_id;
    END IF;

    v_result := jsonb_build_object('success', true, 'message', 'OTP verified successfully');
  ELSE
    v_result := jsonb_build_object('success', false, 'message', 'Invalid OTP');
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RESEND OTP FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION resend_order_otp(
  p_order_id UUID,
  p_otp_type TEXT
)
RETURNS VOID AS $$
DECLARE
  v_new_otp TEXT;
BEGIN
  -- Generate new 6-digit OTP
  v_new_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Update the appropriate OTP field
  IF p_otp_type = 'delivery' THEN
    UPDATE orders
    SET otp_delivery = v_new_otp,
        updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF p_otp_type = 'return' THEN
    UPDATE orders
    SET otp_return = v_new_otp,
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  -- In production, you would send this OTP via SMS/notification
  -- For now, it's just stored in the database
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REALTIME PUBLICATION
-- =====================================================

-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE rider_locations;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample product
INSERT INTO products (name, brand, description, category, gender, occasion, rental_price, deposit_amount, images, fabric_details, sizes_available, hygiene_info)
VALUES (
  'Elegant Evening Gown',
  'Designer Brand',
  'Beautiful floor-length evening gown perfect for weddings and formal events',
  'Dresses',
  'women',
  ARRAY['wedding', 'party', 'formal'],
  299.00,
  500.00,
  ARRAY['https://example.com/image1.jpg'],
  '{"composition": "Silk 80%, Polyester 20%", "stretch_percentage": 5, "care_instructions": ["Dry clean only", "Do not iron"], "comfort_rating": 4.5}'::jsonb,
  '[
    {"size": "S", "measurements": {"bust": 32, "waist": 26, "hip": 36, "length": 60}, "stock_count": 2},
    {"size": "M", "measurements": {"bust": 34, "waist": 28, "hip": 38, "length": 60}, "stock_count": 3},
    {"size": "L", "measurements": {"bust": 36, "waist": 30, "hip": 40, "length": 60}, "stock_count": 1}
  ]'::jsonb,
  '{"last_sanitized": "2026-01-15T10:00:00Z", "hygiene_rating": "A+", "is_sealed": true, "lifecycle_count": 5, "sanitization_method": "Professional steam cleaning"}'::jsonb
);
