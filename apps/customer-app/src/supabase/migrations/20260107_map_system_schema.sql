-- Migration: Map & Location System Schema for PopClozet
-- Generated: 2026-01-07
-- Description: Creates tables for rental hubs, user addresses, delivery orders, tracking, and notifications

-- ============================================
-- RENTAL HUBS TABLE
-- Stores rental hub/warehouse locations
-- ============================================
CREATE TABLE IF NOT EXISTS rental_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  
  -- Geolocation
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Operating hours (JSON: { "mon": { "open": "09:00", "close": "21:00" }, ... })
  operating_hours JSONB DEFAULT '{}',
  
  -- Hub status
  is_active BOOLEAN DEFAULT true,
  availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'offline')),
  
  -- Delivery info
  delivery_radius_km INTEGER DEFAULT 50,
  avg_delivery_minutes INTEGER DEFAULT 60,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create spatial index for efficient radius queries
CREATE INDEX IF NOT EXISTS idx_rental_hubs_location ON rental_hubs (lat, lng);
CREATE INDEX IF NOT EXISTS idx_rental_hubs_city ON rental_hubs (city);
CREATE INDEX IF NOT EXISTS idx_rental_hubs_active ON rental_hubs (is_active) WHERE is_active = true;

-- ============================================
-- USER ADDRESSES TABLE
-- Stores multiple saved addresses per user
-- ============================================
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Address details
  label TEXT DEFAULT 'Home', -- Home, Work, Other
  full_address TEXT NOT NULL,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'India',
  
  -- Geolocation
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses (user_id, is_default) WHERE is_default = true;

-- ============================================
-- DELIVERY ORDERS TABLE
-- Tracks rental delivery and return orders
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Hub assignment
  hub_id UUID REFERENCES rental_hubs(id),
  
  -- Address
  delivery_address_id UUID REFERENCES user_addresses(id),
  delivery_address_snapshot JSONB, -- Snapshot of address at order time
  
  -- Order type
  order_type TEXT NOT NULL CHECK (order_type IN ('delivery', 'pickup', 'return')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 
    'confirmed', 
    'preparing', 
    'out_for_delivery', 
    'delivered', 
    'pickup_scheduled',
    'picked_up',
    'return_scheduled',
    'return_completed',
    'cancelled'
  )),
  
  -- Route info
  route_distance_km DOUBLE PRECISION,
  route_polyline TEXT, -- Encoded polyline for map display
  
  -- Timing
  estimated_delivery_at TIMESTAMPTZ,
  actual_delivery_at TIMESTAMPTZ,
  scheduled_slot JSONB, -- { "date": "2026-01-08", "start": "14:00", "end": "16:00" }
  
  -- Pricing
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  is_free_delivery BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_user ON delivery_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_hub ON delivery_orders (hub_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders (status);

-- Enable Realtime for delivery_orders (for status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_orders;

-- ============================================
-- DELIVERY TRACKING TABLE
-- Real-time vehicle location (for Supabase Realtime)
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  
  -- Vehicle/driver info
  driver_name TEXT,
  vehicle_number TEXT,
  
  -- Current location
  current_lat DOUBLE PRECISION NOT NULL,
  current_lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION, -- Direction in degrees (0-360)
  speed DOUBLE PRECISION, -- Speed in km/h
  
  -- ETA
  eta_minutes INTEGER,
  last_eta_update TIMESTAMPTZ DEFAULT now(),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON delivery_tracking (order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_active ON delivery_tracking (is_active) WHERE is_active = true;

-- Enable Realtime for delivery_tracking
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_tracking;

-- ============================================
-- NOTIFICATIONS TABLE
-- In-app notifications for users
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Notification type
  type TEXT NOT NULL CHECK (type IN (
    'order_confirmed',
    'out_for_delivery',
    'delivered',
    'pickup_scheduled',
    'pickup_completed',
    'return_scheduled',
    'return_completed',
    'general'
  )),
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Related order (optional)
  order_id UUID REFERENCES delivery_orders(id) ON DELETE SET NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read) WHERE is_read = false;

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- SEED DATA: Sample Rental Hubs in Mumbai
-- ============================================
INSERT INTO rental_hubs (name, address, city, lat, lng, operating_hours, avg_delivery_minutes) VALUES
  (
    'PopClozet Mumbai Central',
    'Kamala Mills Compound, Lower Parel, Mumbai 400013',
    'Mumbai',
    19.0048,
    72.8268,
    '{"mon": {"open": "10:00", "close": "22:00"}, "tue": {"open": "10:00", "close": "22:00"}, "wed": {"open": "10:00", "close": "22:00"}, "thu": {"open": "10:00", "close": "22:00"}, "fri": {"open": "10:00", "close": "22:00"}, "sat": {"open": "10:00", "close": "22:00"}, "sun": {"open": "11:00", "close": "20:00"}}',
    45
  ),
  (
    'PopClozet Bandra',
    'Turner Road, Bandra West, Mumbai 400050',
    'Mumbai',
    19.0596,
    72.8295,
    '{"mon": {"open": "10:00", "close": "21:00"}, "tue": {"open": "10:00", "close": "21:00"}, "wed": {"open": "10:00", "close": "21:00"}, "thu": {"open": "10:00", "close": "21:00"}, "fri": {"open": "10:00", "close": "21:00"}, "sat": {"open": "10:00", "close": "21:00"}, "sun": {"open": "11:00", "close": "19:00"}}',
    50
  ),
  (
    'PopClozet Andheri',
    'Lokhandwala Complex, Andheri West, Mumbai 400053',
    'Mumbai',
    19.1384,
    72.8296,
    '{"mon": {"open": "10:00", "close": "21:00"}, "tue": {"open": "10:00", "close": "21:00"}, "wed": {"open": "10:00", "close": "21:00"}, "thu": {"open": "10:00", "close": "21:00"}, "fri": {"open": "10:00", "close": "21:00"}, "sat": {"open": "10:00", "close": "21:00"}, "sun": {"open": "11:00", "close": "19:00"}}',
    55
  ),
  (
    'PopClozet South Mumbai',
    'Colaba Causeway, Colaba, Mumbai 400005',
    'Mumbai',
    18.9067,
    72.8147,
    '{"mon": {"open": "11:00", "close": "20:00"}, "tue": {"open": "11:00", "close": "20:00"}, "wed": {"open": "11:00", "close": "20:00"}, "thu": {"open": "11:00", "close": "20:00"}, "fri": {"open": "11:00", "close": "20:00"}, "sat": {"open": "11:00", "close": "20:00"}, "sun": {"open": "12:00", "close": "18:00"}}',
    60
  )
ON CONFLICT DO NOTHING;
