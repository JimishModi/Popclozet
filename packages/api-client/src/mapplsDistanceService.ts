const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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

async function edgeFetch(action: string, body: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/location`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action, ...body }),
    });
    return res.json();
}

export async function getRoadDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DistanceResult> {
  try {
    const data = await edgeFetch('distance', {
      origin: `${fromLng},${fromLat}`,
      destination: `${toLng},${toLat}`,
    });

    if (data.error) {
      throw new MapplsDistanceError(data.error);
    }

    return {
      distanceKm: data.distance ?? 0,
      durationMinutes: Math.round((data.duration ?? 0) / 60)
    };
  } catch (err: unknown) {
    if (err instanceof MapplsDistanceError) {
      throw err;
    }
    throw new MapplsDistanceError('Failed to fetch road distance via Edge Function');
  }
}