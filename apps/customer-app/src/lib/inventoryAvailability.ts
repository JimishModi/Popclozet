export interface InventoryStatusUnit {
  status?: string | null;
}

export interface InventoryAvailabilityRow {
  available_stock?: number | null;
  total_stock?: number | null;
  all_products?: InventoryStatusUnit[] | null;
}

const NON_PHYSICAL_STATUSES = new Set([
  "sold",
  "lost",
  "damaged",
  "archived",
  "instantly_bought",
]);

const AVAILABLE_STATUSES = new Set(["available", "ready"]);

export function computeInventoryAvailability(rows: InventoryAvailabilityRow[] | null | undefined) {
  const safeRows = rows || [];
  const totalStock = safeRows.reduce((acc, row) => acc + (row.total_stock || 0), 0);
  const totalAvailableStock = safeRows.reduce((acc, row) => acc + (row.available_stock || 0), 0);

  // inventory.available_stock is the source of truth for availability.
  // It reflects reservations from place_order (before warehouse packing),
  // while all_products.status only changes at packing time.
  // Use all_products only to detect sold out (all units permanently gone).
  const units = safeRows.flatMap((row) => (Array.isArray(row.all_products) ? row.all_products : []));
  const activeUnitCount = units.length > 0
    ? units.filter((unit) => !NON_PHYSICAL_STATUSES.has(unit.status ?? "")).length
    : totalStock;

  return {
    isSoldOut: totalStock === 0 || activeUnitCount === 0,
    isRentedOut: totalStock > 0 && activeUnitCount > 0 && totalAvailableStock === 0,
  };
}
