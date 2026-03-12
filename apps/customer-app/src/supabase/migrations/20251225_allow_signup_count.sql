-- Migration to allow public access to signup count
-- This enables the registration counter feature on the landing page

-- Create a secure function to get the signup count
-- This allows counting rows without exposing individual email data
CREATE OR REPLACE FUNCTION public.get_signup_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.email_signups;
  RETURN total_count;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_signup_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_signup_count() TO authenticated;

-- Alternative: Create a policy that allows counting rows (but not reading data)
-- This is a more permissive approach but still doesn't expose individual emails
-- Uncomment below if you prefer this approach over the function

-- CREATE POLICY "Allow public to count signups"
-- ON public.email_signups
-- FOR SELECT
-- USING (true);
-- Note: The above would allow SELECT but the anon user still can't see data columns
-- due to column-level security or by using head:true queries

COMMENT ON FUNCTION public.get_signup_count() IS 'Returns the total count of email signups. Safe for public use - does not expose individual emails.';
