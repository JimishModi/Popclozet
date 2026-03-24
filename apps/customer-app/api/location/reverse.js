// Vercel Serverless Function: /api/location/reverse
// Proxies to Mappls Reverse Geocode API

const https = require('https');

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data.slice(0, 200) });
        }
      });
    }).on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  const { lat, lng } = req.query;

  // Always return something so the map page doesn't break
  const fallback = {
    formatted_address: lat && lng ? `${lat}, ${lng}` : 'Unknown location',
    latitude: parseFloat(lat) || 0,
    longitude: parseFloat(lng) || 0,
    city: 'Mumbai',
  };

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const REST_KEY = process.env.MAPPLS_REST_KEY;
  if (!REST_KEY) {
    console.error('[reverse] MAPPLS_REST_KEY not set in environment');
    return res.status(200).json(fallback);
  }

  try {
    const url = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
    const { status, body, raw } = await httpsGet(url, {
      Referer: req.headers.referer || 'https://popclozet.vercel.app/',
    });

    if (!body) {
      console.error(`[reverse] Mappls non-JSON response (status ${status}):`, raw);
      return res.status(200).json(fallback);
    }

    if (status !== 200) {
      console.error(`[reverse] Mappls error (status ${status}):`, JSON.stringify(body));
      return res.status(200).json(fallback);
    }

    const results = body.results || (Array.isArray(body) ? body : []);
    const bestResult = results[0];
    res.status(200).json(bestResult || fallback);
  } catch (error) {
    console.error('[reverse] Unexpected error:', error.message);
    res.status(200).json(fallback);
  }
};
