// deno-lint-ignore-file
// @ts-nocheck
// supabase/functions/location/index.ts
//
// Unified location Edge Function — replaces the Express /api/location/* proxy.
// Reads MAPPLS_REST_KEY from Supabase secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REST_KEY = Deno.env.get("MAPPLS_REST_KEY") ?? "";

// ─── action handlers ────────────────────────────────────────────────

async function handleSearch(body: any) {
  const { query, lat, lng } = body;
  if (!query) return json({ error: "query is required" }, 400);

  const truncated = String(query).slice(0, 100);
  const locationBias = lat && lng ? `&location=${lat},${lng}` : "";

  // 1. Mappls AutoSuggest
  try {
    const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(truncated)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true${locationBias}`;
    const res = await fetch(url, { headers: { Referer: "https://popclozet.vercel.app/" } });
    const data = await res.json();
    const results = data.suggestedLocations || (Array.isArray(data) ? data : []);
    if (results.length > 0) return json(results);
  } catch (e) {
    console.warn("[location/search] Mappls failed:", e.message);
  }

  // 2. Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(truncated)}&format=json&addressdetails=1&countrycodes=in&limit=10`;
    const nomRes = await fetch(nomUrl, {
      headers: { "User-Agent": "PopClozet/1.0 (popclozet.com)" },
    });
    const nomData = await nomRes.json();
    const results = nomData.map((p: any) => ({
      placeName: p.name || (p.display_name ? p.display_name.split(",")[0] : "Unknown"),
      placeAddress: p.display_name,
      latitude: parseFloat(p.lat),
      longitude: parseFloat(p.lon),
      type: p.type,
      pincode: p.address?.postcode || "",
      city: p.address?.city || p.address?.town || p.address?.village || "",
    }));
    return json(results);
  } catch (e) {
    console.error("[location/search] Nominatim also failed:", e.message);
  }

  return json([]);
}

async function handleDetail(body: any) {
  const { eloc } = body;
  if (!eloc) return json({ error: "eloc is required" }, 400);

  try {
    const url = `https://atlas.mappls.com/api/places/geocode?eLoc=${eloc}&access_token=${REST_KEY}`;
    const res = await fetch(url, { headers: { Referer: "https://popclozet.vercel.app/" } });
    const result = await res.json();
    const data = Array.isArray(result) ? result[0] : result.results ? result.results[0] : result;

    if (data && (data.latitude || data.lat)) {
      return json({
        latitude: parseFloat(data.latitude || data.lat),
        longitude: parseFloat(data.longitude || data.lng),
        eLoc: eloc,
        placeName: data.placeName || data.formatted_address || data.address || "",
      });
    }
    return json({ error: "Location details not found" }, 404);
  } catch (e) {
    console.error("[location/detail] Error:", e.message);
    return json({ error: "Failed to fetch location details" }, 500);
  }
}

async function handleReverse(body: any) {
  const { lat, lng } = body;
  if (!lat || !lng) return json({ error: "lat and lng are required" }, 400);

  // 1. Mappls reverse geocode
  try {
    const url = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
    const res = await fetch(url, { headers: { Referer: "https://popclozet.vercel.app/" } });
    const data = await res.json();
    const results = data.results || (Array.isArray(data) ? data : [data]);
    if (results[0]?.formatted_address) return json(results[0]);
  } catch (e) {
    console.warn("[location/reverse] Mappls failed:", e.message);
  }

  // 2. Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const nomRes = await fetch(nomUrl, {
      headers: { "User-Agent": "PopClozet/1.0 (popclozet.com)" },
    });
    const nomData = await nomRes.json();
    if (nomData?.display_name) {
      const city =
        nomData.address?.city || nomData.address?.town || nomData.address?.county || "Mumbai";
      return json({
        formatted_address: nomData.display_name,
        latitude: parseFloat(String(lat)),
        longitude: parseFloat(String(lng)),
        city,
      });
    }
  } catch (e) {
    console.warn("[location/reverse] Nominatim also failed:", e.message);
  }

  // Hard fallback
  return json({
    formatted_address: `${lat}, ${lng}`,
    latitude: parseFloat(String(lat)),
    longitude: parseFloat(String(lng)),
    city: "Mumbai",
  });
}

async function handleGeocode(body: any) {
  const { address } = body;
  if (!address) return json({ error: "address is required" }, 400);

  const fullAddress = String(address).replace(/،/g, ",");

  // 1. Mappls geocode
  if (REST_KEY) {
    try {
      const url = `https://atlas.mappls.com/api/places/geocode?address=${encodeURIComponent(fullAddress)}&access_token=${REST_KEY}`;
      const res = await fetch(url, {
        headers: { Referer: "https://popclozet.vercel.app/" },
      });
      const result = await res.json();
      const data = Array.isArray(result)
        ? result[0]
        : result.copResults
          ? result.copResults[0]
          : result.results
            ? result.results[0]
            : result;

      if (data && (data.latitude || data.lat)) {
        const lat = parseFloat(data.latitude || data.lat);
        const lng = parseFloat(data.longitude || data.lng);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          return json({
            lat,
            lng,
            eLoc: data.eLoc || data.eloc || data.mapplsPin || null,
            displayAddress: data.formatted_address || data.placeName || data.address || fullAddress,
          });
        }
      }
    } catch (e) {
      console.warn("[location/geocode] Mappls failed:", e.message);
    }
  }

  // 2. Nominatim fallback with progressive chunking
  const parts = fullAddress.split(",").map((p: string) => p.trim()).filter(Boolean);
  const candidates = [
    fullAddress,
    parts.slice(1).join(", "),
    parts.slice(2).join(", "),
    parts.slice(3).join(", "),
  ].filter((q) => q.length > 5);

  for (const q of candidates) {
    try {
      await new Promise((r) => setTimeout(r, 1000)); // respect Nominatim 1 req/s
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`;
      const nomRes = await fetch(nomUrl, {
        headers: { "User-Agent": "PopClozet/1.0 (popclozet.com)" },
      });
      const results = await nomRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results[0];
        const lat = parseFloat(best.lat);
        const lng = parseFloat(best.lon);
        if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) {
          return json({ lat, lng, eLoc: null, displayAddress: best.display_name ?? fullAddress });
        }
      }
    } catch (e) {
      console.warn(`[location/geocode] Nominatim failed for "${q}":`, e.message);
    }
  }

  return json({ error: "No geocoding results found" }, 404);
}

async function handleDistance(body: any) {
  const { origin, destination } = body;
  if (!origin || !destination)
    return json({ error: "origin and destination are required" }, 400);

  try {
    const url = `https://route.mappls.com/route/dm/distance_matrix/driving/${origin};${destination}?region=ind&access_token=${REST_KEY}`;
    const res = await fetch(url, { headers: { Referer: "https://popclozet.vercel.app/" } });
    const data = await res.json();

    if (data?.results?.distances) {
      return json({ distance: data.results.distances[0][1] / 1000 });
    }
    if (data?.distances?.[0]) {
      return json({ distance: data.distances[0][1] / 1000 });
    }
    console.warn("[location/distance] Unexpected structure:", JSON.stringify(data));
    return json({ error: "Unexpected response structure" }, 500);
  } catch (e) {
    console.error("[location/distance] Error:", e.message);
    return json({ error: "Failed to calculate distance" }, 500);
  }
}

async function handleDirections(body: any) {
  const { origin, destination } = body;
  if (!origin || !destination)
    return json({ error: "origin and destination are required" }, 400);

  try {
    const url = `https://route.mappls.com/route/direction/driving/${origin};${destination}?overview=full&geometries=geojson&access_token=${REST_KEY}`;
    const res = await fetch(url, { headers: { Referer: "https://popclozet.vercel.app/" } });
    const data = await res.json();
    return json(data);
  } catch (e) {
    console.error("[location/directions] Error:", e.message);
    return json({ error: "Failed to fetch directions" }, 500);
  }
}

// ─── main handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "search":
        return await handleSearch(body);
      case "detail":
        return await handleDetail(body);
      case "reverse":
        return await handleReverse(body);
      case "geocode":
        return await handleGeocode(body);
      case "distance":
        return await handleDistance(body);
      case "directions":
        return await handleDirections(body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[location] Unexpected error:", e);
    return json({ error: "Internal server error", details: String(e) }, 500);
  }
});
