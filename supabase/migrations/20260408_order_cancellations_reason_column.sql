ALTER TABLE public.order_cancellations
ADD COLUMN IF NOT EXISTS reason TEXT;

NOTIFY pgrst, 'reload schema';
