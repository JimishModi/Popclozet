ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT false;
