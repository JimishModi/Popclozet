// Vercel Serverless Function: /api/location/detail/:eloc
// Proxies to Mappls eLoc Detail API

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

  const { eloc } = req.query;
  if (!eloc) {
    return res.status(400).json({ error: 'eloc is required' });
  }

  try {
    const url = `https://atlas.mappls.com/api/places/eloc/${eloc}?access_token=${REST_KEY}`;
    const { body } = await httpsGet(url, { Referer: req.headers.referer || 'https://popclozet.vercel.app/' });

    const result = body;
    const data = Array.isArray(result) ? result[0] : (result.results ? result.results[0] : result);

    if (data && (data.latitude || data.lat)) {
      res.status(200).json({
        latitude: parseFloat(data.latitude || data.lat),
        longitude: parseFloat(data.longitude || data.lng),
        eLoc: eloc,
        placeName: data.placeName || data.formatted_address || data.address || ''
      });
    } else {
      res.status(404).json({ error: 'Location details not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch location details', detail: error.message });
  }
};
