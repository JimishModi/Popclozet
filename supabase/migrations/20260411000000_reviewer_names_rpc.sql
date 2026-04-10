-- Allow fetching reviewer display names for product reviews.
-- Uses SECURITY DEFINER to bypass RLS on customer_profiles (only exposes full_name).

CREATE OR REPLACE FUNCTION public.get_reviewer_names(user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.user_id, cp.full_name
  FROM public.customer_profiles cp
  WHERE cp.user_id = ANY(user_ids)
    AND cp.full_name IS NOT NULL;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.get_reviewer_names(uuid[]) TO authenticated;
