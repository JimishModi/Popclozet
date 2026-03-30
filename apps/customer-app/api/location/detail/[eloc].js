// Vercel Serverless Function: /api/location/detail/:eloc

export default async function handler(req, res) {
  const { eloc } = req.query;
  if (!eloc) {
    return res.status(400).json({ error: 'eloc is required' });
  }

  const REST_KEY = process.env.MAPPLS_REST_KEY || process.env.VITE_MAPPLS_REST_KEY;
  if (!REST_KEY) {
    return res.status(404).json({ error: 'Location details unavailable' });
  }

  // Strategy 1: Mappls v1 place_detail API (works with REST key directly in URL)
  try {
    const v1Url = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/place_detail?eLoc=${encodeURIComponent(eloc)}`;
    const v1Res = await fetch(v1Url, {
      headers: { Referer: 'https://popclozet.vercel.app/' },
    });
    if (v1Res.ok) {
      const data = await v1Res.json();
      const lat = parseFloat(data.latitude || data.lat);
      const lng = parseFloat(data.longitude || data.lng);
      if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01)) {
        return res.status(200).json({
          latitude: lat,
          longitude: lng,
          eLoc: eloc,
          placeName: data.placeName || data.formatted_address || data.address || '',
        });
      }
    }
  } catch (e) {
    console.error('[detail] Mappls v1 place_detail error:', e.message);
  }

  // Strategy 2: Mappls v1 geocode API
  try {
    const geocodeUrl = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/geo_code?eLoc=${encodeURIComponent(eloc)}`;
    const geocodeRes = await fetch(geocodeUrl, {
      headers: { Referer: 'https://popclozet.vercel.app/' },
    });
    if (geocodeRes.ok) {
      const result = await geocodeRes.json();
      const data = result.results ? result.results[0] : (Array.isArray(result) ? result[0] : result);
      if (data) {
        const lat = parseFloat(data.latitude || data.lat);
        const lng = parseFloat(data.longitude || data.lng);
        if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01)) {
          return res.status(200).json({
            latitude: lat,
            longitude: lng,
            eLoc: eloc,
            placeName: data.placeName || data.formatted_address || data.address || '',
          });
        }
      }
    }
  } catch (e) {
    console.error('[detail] Mappls v1 geocode error:', e.message);
  }

  // Strategy 3: Atlas API (newer — may need OAuth)
  try {
    const atlasUrl = `https://atlas.mappls.com/api/places/geocode?eLoc=${encodeURIComponent(eloc)}&access_token=${REST_KEY}`;
    const atlasRes = await fetch(atlasUrl, {
      headers: { Referer: 'https://popclozet.vercel.app/' },
    });
    if (atlasRes.ok) {
      const result = await atlasRes.json();
      const data = Array.isArray(result) ? result[0] : (result.results ? result.results[0] : result);
      if (data && (data.latitude || data.lat)) {
        const lat = parseFloat(data.latitude || data.lat);
        const lng = parseFloat(data.longitude || data.lng);
        if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01)) {
          return res.status(200).json({
            latitude: lat,
            longitude: lng,
            eLoc: eloc,
            placeName: data.placeName || data.formatted_address || data.address || '',
          });
        }
      }
    }
  } catch (e) {
    console.error('[detail] Atlas API error:', e.message);
  }

  res.status(404).json({ error: 'Could not resolve coordinates for this eLoc' });
}
