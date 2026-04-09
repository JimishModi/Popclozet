-- Add reviewer_name column to persist the name at the time of review
ALTER TABLE public.product_reviews
ADD COLUMN IF NOT EXISTS reviewer_name TEXT;

-- Backfill existing reviews with the name from customer_profiles
UPDATE public.product_reviews pr
SET reviewer_name = cp.full_name
FROM public.customer_profiles cp
WHERE pr.user_id = cp.id
  AND pr.reviewer_name IS NULL
  AND cp.full_name IS NOT NULL;
