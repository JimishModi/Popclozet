import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const REST_KEY = process.env.MAPPLS_REST_KEY;
const MAPBOX_TOKEN = process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (!REST_KEY || REST_KEY === 'your_mapmyindia_rest_key_here') {
    console.warn('WARNING: MAPPLS_REST_KEY is not configured or using placeholder value.');
} else {
    console.log(`[API] MAPPLS_REST_KEY loaded, length: ${REST_KEY.length}`);
}

/**
 * GET /api/location/search
 * Proxies to Mappls Auto-Suggest API
 */
app.get("/api/location/search", async (req, res) => {
    let { query } = req.query;
    if (typeof query === 'string' && query.length > 40) {
        query = query.substring(0, 40);
        console.log(`[API] Truncated long query to: ${query}`);
    }

    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query as string)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true`;
        console.log(`[API] Searching Mappls Atlas: ${query}`);
        console.log(`[API] URL: ${url.replace(REST_KEY || '', 'REDACTED')}`);

        const response = await axios.get(url, {
            headers: { 'Referer': req.headers.referer || 'http://localhost:5501/' }
        });

        console.log(`[API] Mappls Response Status: ${response.status}`);

        // Handle both root array and 'suggestedLocations' wrapper
        const results = response.data.suggestedLocations || (Array.isArray(response.data) ? response.data : []);
        console.log(`[API] Found ${results.length} results`);
        res.json(results);
    } catch (error: any) {
        console.error("Mappls Search Error:", error.response?.data || error.message);
        console.error("Full Error Stack:", error.stack);
        res.status(500).json({
            error: "Failed to fetch locations",
            detail: error.response?.data || error.message
        });
    }
});

/**
 * GET /api/location/detail/:eloc
 * Get coordinates for an eLoc (MapmyIndia Detail API)
 */
app.get("/api/location/detail/:eloc", async (req, res) => {
    const { eloc } = req.params;

    try {
        // Updated to use the correct Mappls Atlas Geocode API URL
        const url = `https://atlas.mappls.com/api/places/geocode?eLoc=${eloc}&access_token=${REST_KEY}`;
        console.log(`[BACKEND] eLoc Detail lookup: ${eloc}`);
        console.log(`[BACKEND] API URL: ${url.replace(REST_KEY || '', 'REDACTED')}`);
        
        const response = await axios.get(url, {
            headers: { 'Referer': req.headers.referer || 'http://localhost:5501/' }
        });

        console.log(`[BACKEND] Detail API Response Status:`, response.status);

        const result = response.data;
        // Mappls results often wrap data in a results array or return directly
        const data = Array.isArray(result) ? result[0] : (result.results ? result.results[0] : result);

        if (data && (data.latitude || data.lat)) {
            const resolved = {
                latitude: parseFloat(data.latitude || data.lat),
                longitude: parseFloat(data.longitude || data.lng),
                eLoc: eloc,
                placeName: data.placeName || data.formatted_address || data.address || ''
            };
            console.log(`[BACKEND] Successfully resolved eLoc ${eloc}:`, resolved.latitude, resolved.longitude);
            res.json(resolved);
        } else {
            console.warn(`[BACKEND] eLoc ${eloc} found but missing coordinates:`, JSON.stringify(result));
            res.status(404).json({ error: "Location details not found in result" });
        }
    } catch (error: any) {
        console.error("[BACKEND] Mappls Detail Error:", error.response?.data || error.message);
        res.status(500).json({
            error: "Failed to fetch location details",
            detail: error.response?.data || error.message
        });
    }
});


/**
 * GET /api/location/reverse
 * Standardized reverse geocode endpoint with fallbacks
 */
app.get("/api/location/reverse", async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng are required" });
    }

    try {
        const url = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
        console.log(`Reverse Geocoding: ${lat}, ${lng}`);
        
        const response = await axios.get(url, {
            headers: { 'Referer': req.headers.referer || 'http://localhost:5501/' }
        });

        const results = response.data.results || (Array.isArray(response.data) ? response.data : [response.data]);
        const bestResult = results[0];

        if (bestResult) {
            res.json(bestResult);
        } else {
            // Robust fallback
            res.json({
                formatted_address: `${lat}, ${lng}`,
                latitude: parseFloat(lat as string),
                longitude: parseFloat(lng as string),
                city: "Mumbai"
            });
        }
    } catch (error: any) {
        console.warn("[BACKEND] Mappls Reverse Error (Likely Expired Key), attempting Mapbox Fallback:", error.response?.data?.error_description || error.message);
        
        // Fallback to Mapbox Reverse Geocoding
        if (MAPBOX_TOKEN) {
            try {
                const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place,locality&limit=1`;
                const mbResponse = await axios.get(mapboxUrl);
                const feature = mbResponse.data.features?.[0];
                
                if (feature) {
                    // Extract city from context if available
                    let city = "Mumbai"; 
                    const placeContext = feature.context?.find((c: any) => c.id.startsWith('place'));
                    if (placeContext) city = placeContext.text;

                    console.log(`[BACKEND] Mapbox Reverse Geocode Success: ${feature.place_name}`);
                    return res.json({
                        formatted_address: feature.place_name,
                        latitude: parseFloat(lat as string),
                        longitude: parseFloat(lng as string),
                        city: city
                    });
                }
            } catch (mbError: any) {
                console.error("[BACKEND] Mapbox Reverse Geocode Fallback also failed:", mbError.message);
            }
        }

        // Ultimate hard fallback if BOTH fail
        console.warn(`[BACKEND] Both Mappls and Mapbox failed. Sending raw coords.`);
        res.json({
            formatted_address: `${lat}, ${lng}`,
            latitude: parseFloat(lat as string),
            longitude: parseFloat(lng as string),
            city: "Mumbai"
        });
    }
});

/**
 * GET /api/location/directions
 * Proxies to MapmyIndia Routing API
 */
app.get('/api/location/directions', async (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: "Missing origin or destination coordinates" });
    }

    try {
        const url = `https://route.mappls.com/route/direction/driving/${origin};${destination}?overview=full&geometries=geojson&access_token=${REST_KEY}`;
        
        const response = await axios.get(url, {
            headers: { 'Referer': req.headers.referer || 'http://localhost:5501/' }
        });
        res.json(response.data);
    } catch (error: any) {
        console.error("Mappls Routing Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch directions" });
    }
});

/**
 * GET /api/location/geocode
 * Proxies to Mappls Geocode API (text address → lat/lng/eLoc)
 * Avoids CORS since the old MapMyIndia REST endpoint blocks browser calls.
 */
app.get("/api/location/geocode", async (req, res) => {
    const { address } = req.query;

    if (!address) {
        return res.status(400).json({ error: "address query param is required" });
    }

    try {
        // Nominatim (OpenStreetMap) — free, no key, no domain restrictions.
        // Problem: full addresses like "Pizza By The Bay, Churchgate, Ground Floor, 143, ..."
        // include establishment names that Nominatim doesn't recognise.
        // Fix: retry with progressively shorter address tails (drop leading components).
        const fullAddress = address as string;
        const parts = fullAddress.split(',').map((p: string) => p.trim()).filter(Boolean);

        // Build candidate queries from most-specific to least-specific.
        // Skipping 0 (full), 1, 2 leading parts gives: "Marine Drive, Church Gate, Mumbai..."
        // We stop as soon as we get a result.
        const candidates: string[] = [
            fullAddress,
            parts.slice(1).join(', '),   // skip establishment name
            parts.slice(2).join(', '),   // skip establishment + floor/unit
            parts.slice(3).join(', '),   // skip establishment + floor + house no
        ].filter(q => q.length > 5);

        let best: any = null;
        let usedQuery = '';

        for (const query of candidates) {
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
            console.log(`[GeoAPI] Nominatim trying: "${query}"`);

            const response = await axios.get(nominatimUrl, {
                headers: { 'User-Agent': 'PopClozet/1.0 (popclozet.com)' }
            });

            const results = response.data;
            if (Array.isArray(results) && results.length > 0) {
                best = results[0];
                usedQuery = query;
                break;
            }
            console.log(`[GeoAPI] No results for: "${query}", trying shorter form...`);
        }

        if (!best) {
            console.warn(`[GeoAPI] All candidate queries exhausted for: ${fullAddress}`);
            return res.status(404).json({ error: "No geocoding results found" });
        }

        const lat = parseFloat(best.lat);
        const lng = parseFloat(best.lon);

        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
            return res.status(404).json({ error: "Geocoding returned invalid coordinates" });
        }

        console.log(`[GeoAPI] ✓ Resolved via "${usedQuery}": lat=${lat} lng=${lng}`);
        res.json({
            lat,
            lng,
            eLoc: null,
            displayAddress: best.display_name ?? fullAddress
        });
    } catch (error: any) {
        console.error("[GeoAPI] Geocode error:", error.response?.data || error.message);
        res.status(500).json({
            error: "Geocoding failed",
            detail: error.response?.data || error.message
        });
    }
});

/**
 * GET /api/location/distance
 * Proxies to MapmyIndia Distance Matrix API (on-road distance)
 */
app.get("/api/location/distance", async (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: "origin and destination coordinates are required (lat,lng)" });
    }

    try {
        // Mappls Distance Matrix API via route.mappls.com
        const url = `https://route.mappls.com/route/dm/distance_matrix/driving/${origin};${destination}?region=ind&access_token=${REST_KEY}`;
        
        const response = await axios.get(url, {
            headers: { 'Referer': req.headers.referer || 'http://localhost:5501/' }
        });

        if (response.data && response.data.results && response.data.results.distances) {
            const distanceInMeters = response.data.results.distances[0][1];
            res.json({ distance: distanceInMeters / 1000 });
        } else if (response.data && response.data.distances && response.data.distances[0]) {
            const distanceInMeters = response.data.distances[0][1];
            res.json({ distance: distanceInMeters / 1000 });
        } else {
            console.warn("[DistanceAPI] Unexpected structure:", JSON.stringify(response.data));
            res.status(500).json({ error: "Unexpected response structure" });
        }
    } catch (error: any) {
        console.error("[DistanceAPI] Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to calculate distance" });
    }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
