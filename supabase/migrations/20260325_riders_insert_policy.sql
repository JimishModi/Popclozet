-- Allow authenticated users to insert their own rider profile
CREATE POLICY "Users can insert own rider profile"
  ON public.riders
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow riders to insert their own notification declines
CREATE POLICY "Riders can insert own notification declines"
  ON public.rider_notifications
  FOR INSERT
  WITH CHECK (rider_id = auth.uid());
