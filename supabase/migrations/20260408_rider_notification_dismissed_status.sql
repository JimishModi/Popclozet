ALTER TABLE public.rider_notifications
DROP CONSTRAINT IF EXISTS rider_notifications_status_check;

ALTER TABLE public.rider_notifications
ADD CONSTRAINT rider_notifications_status_check
CHECK (status IN ('pending', 'dismissed', 'declined'));

NOTIFY pgrst, 'reload schema';
