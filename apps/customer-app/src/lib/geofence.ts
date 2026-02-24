// src/lib/geofence.ts

const MUMBAI = {
  lat: 19.0760,
  lng: 72.8777,
  radiusKm: 40,
};

export const DELIVERY_PROXIMITY_THRESHOLDS = {
  arriving: 0.5,  // km
  nearby: 0.1,    // km
};

const toRad = (v: number) => (v * Math.PI) / 180;

export const distanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export type ProximityStatus = 'far' | 'arriving' | 'nearby';

export function checkDeliveryProximity(
  riderLat: number,
  riderLng: number,
  destLat: number,
  destLng: number
): ProximityStatus {
  const dist = distanceKm(riderLat, riderLng, destLat, destLng);
  if (dist <= DELIVERY_PROXIMITY_THRESHOLDS.nearby) return 'nearby';
  if (dist <= DELIVERY_PROXIMITY_THRESHOLDS.arriving) return 'arriving';
  return 'far';
}

export function isWithinMumbai(): boolean {
  const saved = localStorage.getItem("user_location");
  if (!saved) return false;

  try {
    const { lat, lng } = JSON.parse(saved);
    return (
      distanceKm(lat, lng, MUMBAI.lat, MUMBAI.lng) <=
      MUMBAI.radiusKm
    );
  } catch {
    return false;
  }
}
