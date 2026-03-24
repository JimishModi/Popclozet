// Vercel Serverless Function: /api/location/reverse
// Proxies to Mappls Reverse Geocode API

const https = require('https');

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('Failed to parse response')); }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  const REST_KEY = process.env.MAPPLS_REST_KEY;
  if (!REST_KEY) {
    return res.status(500).json({ error: 'MAPPLS_REST_KEY not configured' });
  }

  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  try {
    const url = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
    const { body } = await httpsGet(url, { Referer: req.headers.referer || 'https://popclozet.vercel.app/' });

    const results = body.results || (Array.isArray(body) ? body : [body]);
    const bestResult = results[0];

    if (bestResult) {
      res.status(200).json(bestResult);
    } else {
      // Fallback with raw coordinates
      res.status(200).json({
        formatted_address: `${lat}, ${lng}`,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        city: 'Mumbai'
      });
    }
  } catch (error) {
    // Graceful fallback so the map page still works
    res.status(200).json({
      formatted_address: `${lat}, ${lng}`,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      city: 'Mumbai'
    });
  }
};
