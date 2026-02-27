export function canDeliverHere(): boolean {
  const saved = localStorage.getItem("user_location");
  if (!saved) return false;

  try {
    const data = JSON.parse(saved);
    return Boolean(data.allowed);
  } catch {
    return false;
  }
}
