ALTER TABLE public.rider_notifications
ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ NULL;

NOTIFY pgrst, 'reload schema';
