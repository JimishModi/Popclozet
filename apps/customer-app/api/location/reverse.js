// Vercel Serverless Function: /api/location/reverse

module.exports = async function handler(req, res) {
  const { lat, lng } = req.query || {};

  const fallback = {
    formatted_address: lat && lng ? `${lat}, ${lng}` : 'Unknown location',
    latitude: parseFloat(lat) || 0,
    longitude: parseFloat(lng) || 0,
    city: 'Mumbai',
  };

  if (!lat || !lng) {
    res.status(200).json(fallback);
    return;
  }

  // Try Nominatim (OpenStreetMap) - free, no key required
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'PopClozet/1.0 (popclozet.vercel.app)',
        'Accept-Language': 'en',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        res.status(200).json({
          formatted_address: data.display_name,
          full_address: data.display_name,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          city: addr.city || addr.town || addr.village || addr.county || 'Mumbai',
          pincode: addr.postcode || '',
        });
        return;
      }
    }
  } catch (e) {
    console.error('[reverse] Nominatim error:', e.message);
  }

  // Try Mappls if key is available
  const REST_KEY = process.env.MAPPLS_REST_KEY;
  if (REST_KEY) {
    try {
      const mapplsUrl = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
      const response = await fetch(mapplsUrl, {
        headers: { Referer: 'https://popclozet.vercel.app/' },
      });
      if (response.ok) {
        const data = await response.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        const best = results[0];
        if (best) {
          res.status(200).json(best);
          return;
        }
      }
    } catch (e) {
      console.error('[reverse] Mappls error:', e.message);
    }
  }

  res.status(200).json(fallback);
};
