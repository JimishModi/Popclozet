// Vercel Serverless Function: /api/location/reverse

export default async function handler(req, res) {
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

  const REST_KEY = process.env.MAPPLS_REST_KEY;

  if (REST_KEY) {
    // Try Mappls v1 REST API (uses key directly in URL — no OAuth needed)
    try {
      const v1Url = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/rev_geocode?lat=${lat}&lng=${lng}`;
      const v1Res = await fetch(v1Url, {
        headers: { 'Referer': 'https://popclozet.vercel.app/' },
      });
      if (v1Res.ok) {
        const data = await v1Res.json();
        // v1 returns { results: { formatted_address, city, pincode, lat, lng, ... } }
        const result = data.results;
        if (result && (result.formatted_address || result.city)) {
          res.status(200).json({
            formatted_address: result.formatted_address || `${lat}, ${lng}`,
            full_address: result.formatted_address || `${lat}, ${lng}`,
            latitude: parseFloat(result.lat || lat),
            longitude: parseFloat(result.lng || lng),
            city: result.city || 'Mumbai',
            pincode: result.pincode || '',
          });
          return;
        }
      } else {
        console.error('[reverse] Mappls v1 status:', v1Res.status);
      }
    } catch (e) {
      console.error('[reverse] Mappls v1 error:', e.message);
    }

    // Try Mappls Atlas API (newer — may need OAuth, worth trying)
    try {
      const atlasUrl = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
      const atlasRes = await fetch(atlasUrl, {
        headers: { 'Referer': 'https://popclozet.vercel.app/' },
      });
      if (atlasRes.ok) {
        const data = await atlasRes.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        const best = results[0];
        if (best) {
          res.status(200).json(best);
          return;
        }
      } else {
        const errText = await atlasRes.text().catch(() => '');
        console.error('[reverse] Mappls Atlas status:', atlasRes.status, errText.slice(0, 100));
      }
    } catch (e) {
      console.error('[reverse] Mappls Atlas error:', e.message);
    }
  } else {
    console.warn('[reverse] MAPPLS_REST_KEY not set');
  }

  // Fallback: Nominatim (OpenStreetMap) — always works, no key needed
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'popclozet/1.0 (popclozet.vercel.app)', 'Accept-Language': 'en' } }
    );
    if (nomRes.ok) {
      const data = await nomRes.json();
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

  res.status(200).json(fallback);
}
