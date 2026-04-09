-- One-off helper for a broken inventory row that has duplicate active units.
-- Fill the values in the params CTE first, run the preview SELECT, then run the
-- UPDATE + reconcile block once you confirm the correct unit is being archived.

WITH params AS (
  SELECT
    'REPLACE_INVENTORY_ID'::uuid AS inventory_id,
    'REPLACE_BAD_INDIVIDUAL_ID'::text AS bad_individual_id
)
SELECT
  ap.individual_id,
  ap.inventory_id,
  ap.status,
  ap.available,
  ap.created_at,
  ap.last_rented,
  ap.last_washed,
  ap.times_rented,
  ap.times_washed
FROM public.all_products ap
JOIN params p
  ON ap.inventory_id = p.inventory_id
ORDER BY ap.created_at ASC;

-- After verifying the preview above:
WITH params AS (
  SELECT
    'REPLACE_INVENTORY_ID'::uuid AS inventory_id,
    'REPLACE_BAD_INDIVIDUAL_ID'::text AS bad_individual_id
)
UPDATE public.all_products ap
SET
  status = 'archived',
  available = FALSE
FROM params p
WHERE ap.inventory_id = p.inventory_id
  AND ap.individual_id = p.bad_individual_id
  AND COALESCE(ap.status, 'available') NOT IN ('sold', 'lost', 'damaged', 'archived', 'instantly_bought');

WITH params AS (
  SELECT 'REPLACE_INVENTORY_ID'::uuid AS inventory_id
)
SELECT public.reconcile_inventory_physical_units(params.inventory_id)
FROM params;

-- Optional hard delete, only if you are absolutely sure the archived row is a
-- phantom row with no history attached. The delete trigger only allows delete
-- after status is archived/lost/damaged.
WITH params AS (
  SELECT 'REPLACE_BAD_INDIVIDUAL_ID'::text AS bad_individual_id
)
DELETE FROM public.all_products ap
USING params p
WHERE ap.individual_id = p.bad_individual_id
  AND ap.status = 'archived'
  AND COALESCE(ap.times_rented, 0) = 0
  AND ap.last_rented IS NULL
  AND ap.last_washed IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.individual_id = ap.individual_id
  );
