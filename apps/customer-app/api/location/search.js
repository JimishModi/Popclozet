// Vercel Serverless Function: /api/location/search

module.exports = async function handler(req, res) {
  let { query } = req.query || {};

  if (!query || query.length < 3) {
    res.status(200).json([]);
    return;
  }
  if (query.length > 40) query = query.substring(0, 40);

  // Try Mappls if key is available
  const REST_KEY = process.env.MAPPLS_REST_KEY;
  if (REST_KEY) {
    try {
      const mapplsUrl = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true`;
      const response = await fetch(mapplsUrl, {
        headers: { Referer: 'https://popclozet.vercel.app/' },
      });
      if (response.ok) {
        const data = await response.json();
        const results = data.suggestedLocations || (Array.isArray(data) ? data : []);
        if (results.length > 0) {
          res.status(200).json(results);
          return;
        }
      }
    } catch (e) {
      console.error('[search] Mappls error:', e.message);
    }
  }

  // Fallback to Nominatim (OpenStreetMap) - free, no key required
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=in&limit=5`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'PopClozet/1.0 (popclozet.vercel.app)',
        'Accept-Language': 'en',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map((place) => {
          const addr = place.address || {};
          const name = addr.road || addr.neighbourhood || addr.suburb || place.name || '';
          const city = addr.city || addr.town || addr.village || addr.county || '';
          const state = addr.state || '';
          const addressStr = [name, addr.suburb, city, state, addr.postcode].filter(Boolean).join(', ');
          return {
            placeName: name || place.display_name.split(',')[0],
            placeAddress: addressStr || place.display_name,
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
};
