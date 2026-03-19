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

if (!REST_KEY || REST_KEY === 'your_mapmyindia_rest_key_here') {
    console.warn('WARNING: MAPPLS_REST_KEY is not configured or using placeholder value.');
}

/**
 * GET /api/location/search
 * Proxies to MapmyIndia Auto-Suggest API
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
        console.log(`[API] Searching Mappls: ${query}`);
        console.log(`[API] URL: ${url.replace(REST_KEY || '', 'REDACTED')}`);
        
        const response = await axios.get(url, {
            headers: { 'Referer': 'http://localhost:5500/' }
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
        // Updated to use the correct Mappls Atlas Detail API URL
        const url = `https://atlas.mappls.com/api/places/eloc/${eloc}?access_token=${REST_KEY}`;
        console.log(`[BACKEND] eLoc Detail lookup: ${eloc}`);
        console.log(`[BACKEND] API URL: ${url}`);
        
        const response = await axios.get(url, {
            headers: { 'Referer': 'http://localhost:5500/' }
        });
        
        console.log(`[BACKEND] Detail API Response:`, JSON.stringify(response.data));
        
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
            headers: { 'Referer': 'http://localhost:5500/' }
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
        console.error("Mappls Reverse Error:", error.response?.data || error.message);
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
            headers: { 'Referer': 'http://localhost:5500/' }
        });
        res.json(response.data);
    } catch (error: any) {
        console.error("Mappls Routing Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch directions" });
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
            headers: { 'Referer': 'http://localhost:5500/' }
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
