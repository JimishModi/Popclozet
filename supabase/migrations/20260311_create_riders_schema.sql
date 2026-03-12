-- =====================================================
-- CREATE RIDERS SCHEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  vehicle_type TEXT CHECK (vehicle_type IN ('bike', 'scooter', 'car')),
  vehicle_number TEXT,
  license_number TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_deliveries INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders can view own profile" ON public.riders FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Riders can update own profile" ON public.riders FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- CREATE RIDER_SETTINGS SCHEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rider_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',
  dark_mode BOOLEAN DEFAULT true,
  auto_accept_orders BOOLEAN DEFAULT false,
  max_distance INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.rider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders can view own settings" ON public.rider_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Riders can update own settings" ON public.rider_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Riders can insert own settings" ON public.rider_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- UPDATE HANDLE_NEW_USER TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Insert Profile
  INSERT INTO public.profiles (user_id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  
  -- 2. If it's a rider, create the rider entry
  IF NEW.raw_user_meta_data->>'role' = 'rider' THEN
      INSERT INTO public.riders (id, user_id, name, phone, email, vehicle_type, vehicle_number, license_number)
      VALUES (
        NEW.id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'scooter'),
        COALESCE(NEW.raw_user_meta_data->>'vehicle_number', ''),
        COALESCE(NEW.raw_user_meta_data->>'license_number', '')
      );
      
      INSERT INTO public.rider_settings (user_id)
      VALUES (NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
