export const MUMBAI_CENTER = {
  lat: 19.0760,
  lng: 72.8777,
};

// radius in KM
export const MUMBAI_RADIUS_KM = 60;

export function isInsideMumbai(lat: number, lng: number): boolean {
  const toRad = (v: number) => (v * Math.PI) / 180;

  const R = 6371; // Earth radius
  const dLat = toRad(lat - MUMBAI_CENTER.lat);
  const dLng = toRad(lng - MUMBAI_CENTER.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(MUMBAI_CENTER.lat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= MUMBAI_RADIUS_KM;
}
