// Vercel Serverless Function: /api/location/search
// Proxies to Mappls AutoSuggest API

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
          // Return raw text so caller can log it
          resolve({ status: res.statusCode, body: null, raw: data.slice(0, 200) });
        }
      });
    }).on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  const REST_KEY = process.env.MAPPLS_REST_KEY;

  let { query } = req.query;
  if (!query) {
    return res.status(200).json([]);
  }
  if (typeof query === 'string' && query.length > 40) {
    query = query.substring(0, 40);
  }

  if (!REST_KEY) {
    console.error('[search] MAPPLS_REST_KEY not set in environment');
    return res.status(200).json([]);
  }

  try {
    const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true`;
    const { status, body, raw } = await httpsGet(url, {
      Referer: req.headers.referer || 'https://popclozet.vercel.app/',
    });

    if (!body) {
      console.error(`[search] Mappls non-JSON response (status ${status}):`, raw);
      return res.status(200).json([]);
    }

    if (status !== 200) {
      console.error(`[search] Mappls error (status ${status}):`, JSON.stringify(body));
      return res.status(200).json([]);
    }

    const results = body.suggestedLocations || (Array.isArray(body) ? body : []);
    res.status(200).json(results);
  } catch (error) {
    console.error('[search] Unexpected error:', error.message);
    res.status(200).json([]);
  }
};
