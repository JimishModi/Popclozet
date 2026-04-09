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

  const units = safeRows.flatMap((row) => (Array.isArray(row.all_products) ? row.all_products : []));

  if (units.length === 0) {
    return {
      isSoldOut: totalStock === 0,
      isRentedOut: totalStock > 0 && totalAvailableStock === 0,
    };
  }

  const activeUnitCount = units.filter((unit) => !NON_PHYSICAL_STATUSES.has(unit.status ?? "")).length;
  const availableUnitCount = units.filter((unit) => AVAILABLE_STATUSES.has(unit.status ?? "")).length;
  return {
    isSoldOut: totalStock === 0 || activeUnitCount === 0,
    isRentedOut: totalStock > 0 && availableUnitCount === 0,
  };
}
