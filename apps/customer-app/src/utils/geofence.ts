export const MUMBAI_GEOFENCE = {
  lat: 19.0760,
  lng: 72.8777,
  radiusKm: 40
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

// Haversine distance formula
export function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isInsideMumbai(lat: number, lng: number) {
  const distance = getDistanceKm(
    lat,
    lng,
    MUMBAI_GEOFENCE.lat,
    MUMBAI_GEOFENCE.lng
  );

  return distance <= MUMBAI_GEOFENCE.radiusKm;
}
