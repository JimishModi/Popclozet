-- Comprehensive script to make ALL links to `auth.users` use ON DELETE CASCADE
-- This guarantees that deleting a user from the Supabase Authentication dashboard works perfectly

ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;
ALTER TABLE public.addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.cart DROP CONSTRAINT IF EXISTS cart_user_id_fkey;
ALTER TABLE public.cart ADD CONSTRAINT cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_id_fkey;
ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_user_id_fkey;
ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.product_reviews DROP CONSTRAINT IF EXISTS product_reviews_user_id_fkey;
ALTER TABLE public.product_reviews ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_id_fkey;
ALTER TABLE public.rider_profiles ADD CONSTRAINT rider_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_user_id_fkey;
ALTER TABLE public.rider_profiles ADD CONSTRAINT rider_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.rider_settings DROP CONSTRAINT IF EXISTS rider_settings_user_id_fkey;
ALTER TABLE public.rider_settings ADD CONSTRAINT rider_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.rider_transactions DROP CONSTRAINT IF EXISTS rider_transactions_rider_id_fkey;
ALTER TABLE public.rider_transactions ADD CONSTRAINT rider_transactions_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.riders DROP CONSTRAINT IF EXISTS riders_id_fkey;
ALTER TABLE public.riders ADD CONSTRAINT riders_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_rider_id_fkey;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.warehouse_activity_log DROP CONSTRAINT IF EXISTS warehouse_activity_log_actor_id_fkey;
ALTER TABLE public.warehouse_activity_log ADD CONSTRAINT warehouse_activity_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.warehouse_profiles DROP CONSTRAINT IF EXISTS warehouse_profiles_id_fkey;
ALTER TABLE public.warehouse_profiles ADD CONSTRAINT warehouse_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.warehouse_profiles DROP CONSTRAINT IF EXISTS warehouse_profiles_user_id_fkey;
ALTER TABLE public.warehouse_profiles ADD CONSTRAINT warehouse_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- In case profiles is still around
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_fk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
