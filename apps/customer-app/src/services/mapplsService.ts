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
  const key = import.meta.env.VITE_MAPPLS_REST_KEY;
  if (!key || key === '') {
    throw new MapplsGeocodingError('VITE_MAPPLS_REST_KEY is not configured', eLoc);
  }

  const url = `https://atlas.mappls.com/api/places/geocode?eLoc=${encodeURIComponent(eLoc)}&access_token=${key}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new MapplsGeocodingError(`API error: ${response.status}`, eLoc);
  }

  const data = await response.json();
  
  if (data.responseCode !== 200 || !data.results || data.results.length === 0) {
    throw new MapplsGeocodingError('No results returned', eLoc);
  }

  const result = data.results[0];
  const lat = parseFloat(result.latitude);
  const lng = parseFloat(result.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    throw new MapplsGeocodingError('API returned non-numeric coordinates', eLoc);
  }

  if (lat === 0 && lng === 0) {
    throw new MapplsGeocodingError('API returned zero coordinates — REST key may be expired or eLoc is invalid', eLoc);
  }

  return {
    eLoc: result.eLoc,
    placeName: result.placeName || '',
    placeAddress: result.placeAddress || '',
    latitude: lat,
    longitude: lng
  };
}
