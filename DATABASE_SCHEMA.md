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
  deposit_amount DECIMAL(10,2) NOT NULL,
  images TEXT[] NOT NULL,
  fabric_details JSONB NOT NULL,
  sizes_available JSONB NOT NULL,
  hygiene_info JSONB NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  deposit_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_eta TIMESTAMPTZ,
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
