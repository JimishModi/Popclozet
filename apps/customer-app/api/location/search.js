// Vercel Serverless Function: /api/location/search

export default async function handler(req, res) {
  let { query, lat, lng } = req.query || {};

  if (!query || query.length < 3) {
    res.status(200).json([]);
    return;
  }
  if (query.length > 100) query = query.substring(0, 100);

  const REST_KEY = process.env.MAPPLS_REST_KEY || process.env.VITE_MAPPLS_REST_KEY;

  // Build location bias parameter if user coordinates are available
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const hasUserLocation = !isNaN(userLat) && !isNaN(userLng) && Math.abs(userLat) > 0.01;
  const locationParam = hasUserLocation ? `&location=${userLat},${userLng}` : '';

  if (REST_KEY) {
    // Try Mappls v1 REST API with autosuggest (more accurate than place_suggest)
    try {
      const v1Url = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/place_suggest?query=${encodeURIComponent(query)}&region=IND${locationParam}`;
      const v1Res = await fetch(v1Url, {
        headers: { 'Referer': 'https://popclozet.vercel.app/' },
      });
      if (v1Res.ok) {
        const data = await v1Res.json();
        // v1 returns { suggestedLocations: [...] } or similar
        const results = data.suggestedLocations || data.results || (Array.isArray(data) ? data : []);
        if (results.length > 0) {
          // Mappls AutoSuggest returns eLoc but often NO coordinates.
          // Resolve coordinates for the first few results so the frontend can use them directly.
          const enriched = await Promise.all(
            results.slice(0, 5).map(async (place) => {
              // If already has valid coordinates, keep as-is
              const lat = parseFloat(place.latitude || place.lat || 0);
              const lng = parseFloat(place.longitude || place.lng || 0);
              if (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01) return place;

              // Try to resolve via eLoc → place_detail
              const eLoc = place.eLoc || place.eloc || place.placeId;
              if (!eLoc) return place;

              try {
                const detailUrl = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/place_detail?eLoc=${encodeURIComponent(eLoc)}`;
                const detailRes = await fetch(detailUrl, {
                  headers: { 'Referer': 'https://popclozet.vercel.app/' },
                });
                if (detailRes.ok) {
                  const detail = await detailRes.json();
                  const dLat = parseFloat(detail.latitude || detail.lat || 0);
                  const dLng = parseFloat(detail.longitude || detail.lng || 0);
                  if (Math.abs(dLat) > 0.01 || Math.abs(dLng) > 0.01) {
                    return { ...place, latitude: dLat, longitude: dLng };
                  }
                }
              } catch (_) { /* ignore — will be resolved client-side */ }

              return place;
            })
          );
          res.status(200).json(enriched);
          return;
        }
      } else {
        console.error('[search] Mappls v1 status:', v1Res.status);
      }
    } catch (e) {
      console.error('[search] Mappls v1 error:', e.message);
    }

    // Try Mappls Atlas API (newer — may need OAuth, worth trying)
    try {
      const atlasUrl = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true${locationParam}`;
      const atlasRes = await fetch(atlasUrl, {
        headers: { 'Referer': 'https://popclozet.vercel.app/' },
      });
      if (atlasRes.ok) {
        const data = await atlasRes.json();
        const results = data.suggestedLocations || (Array.isArray(data) ? data : []);
        if (results.length > 0) {
          res.status(200).json(results);
          return;
        }
      } else {
        console.error('[search] Mappls Atlas status:', atlasRes.status, await atlasRes.text().catch(() => ''));
      }
    } catch (e) {
      console.error('[search] Mappls Atlas error:', e.message);
    }
  } else {
    console.warn('[search] MAPPLS_REST_KEY not set');
  }

  // Fallback: Nominatim (OpenStreetMap) — always works, no key needed
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=in&limit=5`;
    const nomRes = await fetch(nomUrl, {
      headers: { 'User-Agent': 'popclozet/1.0 (popclozet.vercel.app)', 'Accept-Language': 'en' },
    });
    if (nomRes.ok) {
      const data = await nomRes.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map((place) => {
          const addr = place.address || {};
          const name = addr.road || addr.neighbourhood || addr.suburb || place.name || '';
          const city = addr.city || addr.town || addr.village || addr.county || '';
          return {
            placeName: name || place.display_name.split(',')[0],
            placeAddress: place.display_name,
            latitude: place.lat,
            longitude: place.lon,
            pincode: addr.postcode || '',
            city,
          };
        });
        res.status(200).json(results);
        return;
      }
    }
  } catch (e) {
    console.error('[search] Nominatim error:', e.message);
  }

  res.status(200).json([]);
}
