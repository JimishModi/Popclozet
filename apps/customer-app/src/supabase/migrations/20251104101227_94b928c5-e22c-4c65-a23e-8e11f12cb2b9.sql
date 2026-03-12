-- Create table for email signups
CREATE TABLE public.email_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for email lookups
CREATE INDEX idx_email_signups_email ON public.email_signups(email);

-- Enable Row Level Security
ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert their email (public signup form)
CREATE POLICY "Anyone can sign up with email" 
ON public.email_signups 
FOR INSERT 
WITH CHECK (true);

-- Only authenticated admins can view signups (you can modify this based on your needs)
CREATE POLICY "Only admins can view signups" 
ON public.email_signups 
FOR SELECT 
USING (false);  -- Change this once you implement admin roles