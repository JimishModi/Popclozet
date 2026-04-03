-- Guard warehouse activity logging from failing on legacy/non-auth actor IDs.
-- Some older functions/triggers may still pass actor IDs that are not in auth.users.
-- This BEFORE trigger normalizes invalid actor_id values to NULL so writes do not
-- fail with: warehouse_activity_log_actor_id_fkey.

CREATE OR REPLACE FUNCTION public.normalize_warehouse_activity_actor_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.actor_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.actor_id) THEN
    NEW.actor_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_warehouse_activity_actor_id
  ON public.warehouse_activity_log;

CREATE TRIGGER trg_normalize_warehouse_activity_actor_id
  BEFORE INSERT OR UPDATE OF actor_id
  ON public.warehouse_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_warehouse_activity_actor_id();

COMMENT ON FUNCTION public.normalize_warehouse_activity_actor_id IS
'Normalizes warehouse_activity_log.actor_id to NULL when it is not a valid auth.users.id, preventing FK violations from legacy actor IDs.';
