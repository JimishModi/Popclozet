import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY).'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const inventoryId = getArg('--inventory-id');
const keepId = getArg('--keep');
const archiveId = getArg('--archive');
const dryRun = args.includes('--dry-run');

if (!inventoryId) {
  console.error(
    'Usage: node scripts/fix-duplicate-all-products.mjs --inventory-id <uuid> [--keep <individual_id>] [--archive <individual_id>] [--dry-run]'
  );
  process.exit(1);
}

const NON_PHYSICAL_STATUSES = new Set([
  'sold',
  'lost',
  'damaged',
  'archived',
  'instantly_bought',
]);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const chooseArchiveCandidate = (rows) => {
  if (archiveId) {
    return rows.find((row) => row.individual_id === archiveId) ?? null;
  }

  if (keepId) {
    const candidate = rows.find((row) => row.individual_id !== keepId);
    return candidate ?? null;
  }

  const ranked = [...rows].sort((a, b) => {
    const aAvailable = a.available ? 1 : 0;
    const bAvailable = b.available ? 1 : 0;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;

    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return aTime - bTime;
  });

  return ranked[0] ?? null;
};

const main = async () => {
  const { data: rows, error } = await supabase
    .from('all_products')
    .select(
      'individual_id, inventory_id, status, available, created_at, last_rented, last_washed, times_rented, times_washed'
    )
    .eq('inventory_id', inventoryId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const activeRows = (rows ?? []).filter(
    (row) => !NON_PHYSICAL_STATUSES.has(row.status ?? 'available')
  );

  console.log(
    JSON.stringify(
      {
        inventoryId,
        totalRows: rows?.length ?? 0,
        activeRows: activeRows.length,
        rows,
      },
      null,
      2
    )
  );

  if (activeRows.length <= 1) {
    console.log('No duplicate active unit found for this inventory row.');
    return;
  }

  const candidate = chooseArchiveCandidate(activeRows);
  if (!candidate) {
    throw new Error('Could not determine which row to archive.');
  }

  console.log(`Archive candidate: ${candidate.individual_id}`);

  if (dryRun) {
    console.log('Dry run only. No changes applied.');
    return;
  }

  const { error: updateError } = await supabase
    .from('all_products')
    .update({
      status: 'archived',
      available: false,
    })
    .eq('individual_id', candidate.individual_id);

  if (updateError) {
    throw updateError;
  }

  const { data: reconcileResult, error: reconcileError } = await supabase.rpc(
    'reconcile_inventory_physical_units',
    { p_inventory_id: inventoryId }
  );

  if (reconcileError) {
    throw reconcileError;
  }

  console.log(
    JSON.stringify(
      {
        archived: candidate.individual_id,
        reconciled: reconcileResult,
      },
      null,
      2
    )
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
