# PopClozet Customer PWA - Database Schema

This document outlines the required Supabase database schema for the PopClozet customer application.

## Tables

### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'rider', 'warehouse')),
  measurements JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### addresses
```sql
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
```

### products
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('men', 'women', 'unisex')),
  occasion TEXT[] NOT NULL,
  rental_price DECIMAL(10,2) NOT NULL,
  rental_price_1d DECIMAL(10,2),
  rental_price_2d DECIMAL(10,2),
  rental_price_3d DECIMAL(10,2),
  buy_price DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) NOT NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  fabric_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  early_access_until TIMESTAMPTZ
);
```

### inventory
```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size TEXT NOT NULL,
  available_stock INTEGER NOT NULL DEFAULT 0,
  went_for_wash INTEGER NOT NULL DEFAULT 0,
  total_stock INTEGER GENERATED ALWAYS AS (available_stock + went_for_wash) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_size UNIQUE (product_id, size)
);
```

### fake_products
```sql
CREATE TABLE fake_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  gender TEXT NOT NULL,
  occasion TEXT[] NOT NULL,
  rental_price DECIMAL(10,2),
  rental_price_1d DECIMAL(10,2),
  rental_price_2d DECIMAL(10,2),
  rental_price_3d DECIMAL(10,2),
  buy_price DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  mrp DECIMAL(10,2),
  images TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  color TEXT,
  fabric_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  show_count INTEGER DEFAULT 0,
  last_shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### cart_items
```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size TEXT NOT NULL,
  rental_duration_days INTEGER NOT NULL,
  reservation_expires_at TIMESTAMPTZ NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
```

### orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  delivery_address_id UUID REFERENCES addresses(id) NOT NULL,
  rental_start_date DATE NOT NULL,
  rental_end_date DATE,
  total_amount DECIMAL(10,2) NOT NULL,
  subtotal_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  insurance_fee DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'cod')),
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  delivery_eta TIMESTAMPTZ,
  acceptance_ip TEXT,
  acceptance_tc_version TEXT,
  liability_accepted BOOLEAN DEFAULT FALSE,
  sizing_accepted BOOLEAN DEFAULT FALSE,
  rider_id UUID,
  rider_distance DOUBLE PRECISION,
  otp_delivery TEXT,
  otp_return TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### order_items
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  size TEXT NOT NULL,
  rental_price DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  rental_duration_days INTEGER NOT NULL
);
```

### return_requests
```sql
CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  pickup_address_id UUID REFERENCES addresses(id) NOT NULL,
  pickup_slot TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  pickup_eta TIMESTAMPTZ,
  rider_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_subscriptions
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'captured',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### rider_locations
```sql
CREATE TABLE rider_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Row Level Security (RLS)

Enable RLS on all tables and create policies for customer access only.

## Realtime

Enable realtime for:
- `orders` table
- `rider_locations` table
- Broadcast channel for `rider_distance_update` events

## Functions

### verify_order_otp
```sql
CREATE OR REPLACE FUNCTION verify_order_otp(
  order_id UUID,
  otp_code TEXT,
  otp_type TEXT
) RETURNS JSONB AS $$
-- Implementation for OTP verification
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### resend_order_otp
```sql
CREATE OR REPLACE FUNCTION resend_order_otp(
  order_id UUID,
  otp_type TEXT
) RETURNS VOID AS $$
-- Implementation for OTP resend
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
