import { encode, decode } from 'ngeohash';

export const encodeGeohash = (latitude: number, longitude: number, precision: number = 9): string => {
    return encode(latitude, longitude, precision);
};

export const decodeGeohash = (geohash: string): { latitude: number; longitude: number } => {
    const { latitude, longitude } = decode(geohash);
    return { latitude, longitude };
};

export const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

export const getProximityStatus = (distance: number): 'far' | 'near' | 'arrived' => {
    if (distance <= 100) return 'arrived';
    if (distance <= 1000) return 'near';
    return 'far';
};

export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
};
