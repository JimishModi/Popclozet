# Supabase Configuration

## Project Setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Get your credentials**:
   - Project URL: `https://your-project.supabase.co`
   - Anon Key: Found in Project Settings > API

3. **Update `.env` file**:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Database Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### Option 2: Manual SQL Execution

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20260118_initial_schema.sql`
4. Paste and run the SQL

## Enable Realtime

1. Go to Database > Replication
2. Enable replication for these tables:
   - `orders`
   - `rider_locations`

## Storage Buckets (Optional)

Create storage buckets for:
- `product-images` - For product photos
- `avatars` - For user profile pictures

### Storage Policies

```sql
-- Allow public read access to product images
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Authentication Settings

1. Go to Authentication > Providers
2. Enable Email provider
3. (Optional) Enable Google, Facebook, etc.

## Environment Variables

Required environment variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Mapbox
VITE_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token

# App Config
VITE_APP_NAME=popclozet
VITE_APP_URL=http://localhost:3000
VITE_ENABLE_MAP=true
VITE_ENABLE_OFFLINE_MODE=true
VITE_CART_RESERVATION_MINUTES=15
```

## Testing the Setup

After running the migration, test with:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- Test sample product
SELECT * FROM products;
```

## Realtime Channels

The app uses these realtime channels:

1. **Order Updates**: `order:{order_id}`
   - Listens to order status changes
   - Updates delivery ETA

2. **Rider Location**: `rider:{rider_id}`
   - Tracks rider GPS coordinates
   - Updates every few seconds

3. **Proximity Updates**: `proximity:{order_id}`
   - Broadcasts rider distance
   - Triggers map activation

## Security Notes

- All tables have RLS enabled
- Customers can only access their own data
- OTP functions use SECURITY DEFINER
- Sensitive operations require authentication

## Troubleshooting

### Migration Fails
- Check if UUID extension is enabled
- Verify you have admin privileges
- Check for syntax errors in SQL

### Realtime Not Working
- Verify replication is enabled
- Check if tables are published
- Ensure client is authenticated

### RLS Blocking Queries
- Check if user is authenticated
- Verify RLS policies match your use case
- Use `auth.uid()` in policies
