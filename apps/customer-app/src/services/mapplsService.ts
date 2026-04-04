import { callLocationFn } from '@/utils/env';

export interface MapplsSuggestion {
  eLoc: string;
  placeName: string;
  placeAddress: string;
  type: string;
  alternateName?: string;
}

export interface MapplsPlaceDetails {
  eLoc: string;
  placeName: string;
  placeAddress: string;
  latitude: number;
  longitude: number;
}

export class MapplsGeocodingError extends Error {
  constructor(message: string, public readonly eLoc: string) {
    super(message);
    this.name = 'MapplsGeocodingError';
  }
}

export async function fetchPlaceDetails(eLoc: string): Promise<MapplsPlaceDetails> {
  try {
    const data = await callLocationFn({ action: 'detail', eloc: eLoc });

    const lat = typeof data.latitude === 'number' ? data.latitude : parseFloat(data.latitude ?? '0');
    const lng = typeof data.longitude === 'number' ? data.longitude : parseFloat(data.longitude ?? '0');

    if (isNaN(lat) || isNaN(lng)) {
      throw new MapplsGeocodingError('API returned non-numeric coordinates', eLoc);
    }

    if (lat === 0 && lng === 0) {
      throw new MapplsGeocodingError('API returned zero coordinates — eLoc may be invalid', eLoc);
    }

    return {
      eLoc: data.eLoc || eLoc,
      placeName: data.placeName || '',
      placeAddress: data.placeName || '',
      latitude: lat,
      longitude: lng
    };
  } catch (err) {
    if (err instanceof MapplsGeocodingError) throw err;
    throw new MapplsGeocodingError(
      err instanceof Error ? err.message : 'Failed to fetch place details',
      eLoc
    );
  }
}
