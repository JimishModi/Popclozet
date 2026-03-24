// Vercel Serverless Function: /api/location/detail/:eloc

export default async function handler(req, res) {
  const { eloc } = req.query;
  if (!eloc) {
    return res.status(400).json({ error: 'eloc is required' });
  }

  const REST_KEY = process.env.MAPPLS_REST_KEY;
  if (!REST_KEY) {
    return res.status(404).json({ error: 'Location details unavailable' });
  }

  try {
    const response = await fetch(
      `https://atlas.mappls.com/api/places/eloc/${eloc}?access_token=${REST_KEY}`,
      { headers: { Referer: 'https://popclozet.vercel.app/' } }
    );
    if (!response.ok) {
      return res.status(404).json({ error: 'Location details not found' });
    }
    const result = await response.json();
    const data = Array.isArray(result) ? result[0] : (result.results ? result.results[0] : result);
    if (data && (data.latitude || data.lat)) {
      res.status(200).json({
        latitude: parseFloat(data.latitude || data.lat),
        longitude: parseFloat(data.longitude || data.lng),
        eLoc: eloc,
        placeName: data.placeName || data.formatted_address || data.address || '',
      });
    } else {
      res.status(404).json({ error: 'Location details not found' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch location details' });
  }
}
