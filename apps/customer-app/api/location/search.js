// Vercel Serverless Function: /api/location/search
// Proxies to Mappls AutoSuggest API

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

  let { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  if (typeof query === 'string' && query.length > 40) {
    query = query.substring(0, 40);
  }

  try {
    const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true`;
    const { body } = await httpsGet(url, { Referer: req.headers.referer || 'https://popclozet.vercel.app/' });
    const results = body.suggestedLocations || (Array.isArray(body) ? body : []);
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations', detail: error.message });
  }
};
