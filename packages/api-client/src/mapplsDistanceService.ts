export class MapplsDistanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapplsDistanceError';
  }
}

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
}

export async function getRoadDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DistanceResult> {
  const restKey = import.meta.env.VITE_MAPPLS_REST_KEY;
  if (!restKey) {
    throw new MapplsDistanceError('VITE_MAPPLS_REST_KEY is not defined');
  }

  // Mappls format: lng1,lat1;lng2,lat2
  const coordinates = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `https://apis.mappls.com/advancedmaps/v1/${restKey}/distance_matrix/driving/${coordinates}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new MapplsDistanceError(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.results || !data.results.distances || !data.results.distances[0] || data.results.distances[0][1] === undefined) {
      throw new MapplsDistanceError('Invalid or empty response from Mappls Distance Matrix API');
    }

    const distanceMeters = data.results.distances[0][1];
    const durationSeconds = data.results.durations[0][1] || 0;

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: Math.round(durationSeconds / 60)
    };
  } catch (err: unknown) {
    if (err instanceof MapplsDistanceError) {
      throw err;
    }
    throw new MapplsDistanceError('Failed to fetch road distance from Mappls');
  }
}
