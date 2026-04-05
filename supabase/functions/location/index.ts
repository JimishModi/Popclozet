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

function makeLogger(fn: string) {
  const rid = crypto.randomUUID().slice(0, 8);
  const t0 = performance.now();
  const meta = (extra?: Record<string, unknown>) =>
    JSON.stringify({ fn, rid, ...extra });
  return {
    rid,
    info: (msg: string, extra?: Record<string, unknown>) =>
      console.log(meta({ level: "info", msg, ...extra })),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      console.warn(meta({ level: "warn", msg, ...extra })),
    error: (msg: string, extra?: Record<string, unknown>) =>
      console.error(meta({ level: "error", msg, ...extra })),
    done: (status: number) =>
      console.log(
        meta({
          level: "info",
          msg: "complete",
          status,
          ms: Math.round(performance.now() - t0),
        }),
      ),
  };
}

function json(
  body: Record<string, unknown> | any[],
  status = 200,
  log?: ReturnType<typeof makeLogger>,
) {
  if (log) log.done(status);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REST_KEY = Deno.env.get("MAPPLS_REST_KEY") ?? "";

// ─── action handlers ────────────────────────────────────────────────

async function handleSearch(body: any, log: ReturnType<typeof makeLogger>) {
  const { query, lat, lng } = body;
  if (!query) {
    log.error("query is required");
    return json({ error: "query is required" }, 400, log);
  }

  const truncated = String(query).slice(0, 100);
  const locationBias = lat && lng ? `&location=${lat},${lng}` : "";

  // 1. Mappls AutoSuggest
  try {
    const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(truncated)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true${locationBias}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.vercel.app/" },
    });
    const data = await res.json();
    const results =
      data.suggestedLocations || (Array.isArray(data) ? data : []);
    if (results.length > 0) return json(results, 200, log);
  } catch (e: any) {
    log.warn("Mappls failed", { error: e.message });
  }

  // 2. Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(truncated)}&format=json&addressdetails=1&countrycodes=in&limit=10`;
    const nomRes = await fetch(nomUrl, {
      headers: { "User-Agent": "PopClozet/1.0 (popclozet.com)" },
    });
    const nomData = await nomRes.json();
    const results = nomData.map((p: any) => ({
      placeName:
        p.name || (p.display_name ? p.display_name.split(",")[0] : "Unknown"),
      placeAddress: p.display_name,
      latitude: parseFloat(p.lat),
      longitude: parseFloat(p.lon),
      type: p.type,
      pincode: p.address?.postcode || "",
      city: p.address?.city || p.address?.town || p.address?.village || "",
    }));
    return json(results, 200, log);
  } catch (e: any) {
    log.error("Nominatim also failed", { error: e.message });
  }

  return json([], 200, log);
}

async function handleDetail(body: any, log: ReturnType<typeof makeLogger>) {
  const { eloc } = body;
  if (!eloc) {
    log.error("eloc is required");
    return json({ error: "eloc is required" }, 400, log);
  }

  try {
    const url = `https://atlas.mappls.com/api/places/geocode?eLoc=${eloc}&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.vercel.app/" },
    });
    const result = await res.json();
    const data = Array.isArray(result)
      ? result[0]
      : result.results
        ? result.results[0]
        : result;

    if (data && (data.latitude || data.lat)) {
      return json(
        {
          latitude: parseFloat(data.latitude || data.lat),
          longitude: parseFloat(data.longitude || data.lng),
          eLoc: eloc,
          placeName:
            data.placeName || data.formatted_address || data.address || "",
        },
        200,
        log,
      );
    }
    log.warn("Location details not found", { eloc });
    return json({ error: "Location details not found" }, 404, log);
  } catch (e: any) {
    log.error("Failed to fetch location details", { error: e.message });
    return json({ error: "Failed to fetch location details" }, 500, log);
  }
}

async function handleReverse(body: any, log: ReturnType<typeof makeLogger>) {
  const { lat, lng } = body;
  if (!lat || !lng) {
    log.error("lat and lng are required");
    return json({ error: "lat and lng are required" }, 400, log);
  }

  // 1. Mappls reverse geocode
  try {
    const url = `https://atlas.mappls.com/api/places/rev_geocode?lat=${lat}&lng=${lng}&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.vercel.app/" },
    });
    const data = await res.json();
    const results = data.results || (Array.isArray(data) ? data : [data]);
    if (results[0]?.formatted_address) return json(results[0], 200, log);
  } catch (e: any) {
    log.warn("Mappls failed", { error: e.message });
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
        nomData.address?.city ||
        nomData.address?.town ||
        nomData.address?.county ||
        "Mumbai";
      return json(
        {
          formatted_address: nomData.display_name,
          latitude: parseFloat(String(lat)),
          longitude: parseFloat(String(lng)),
          city,
        },
        200,
        log,
      );
    }
  } catch (e: any) {
    log.warn("Nominatim also failed", { error: e.message });
  }

  // Hard fallback
  return json(
    {
      formatted_address: `${lat}, ${lng}`,
      latitude: parseFloat(String(lat)),
      longitude: parseFloat(String(lng)),
      city: "Mumbai",
    },
    200,
    log,
  );
}

async function handleGeocode(body: any, log: ReturnType<typeof makeLogger>) {
  const { address } = body;
  if (!address) {
    log.error("address is required");
    return json({ error: "address is required" }, 400, log);
  }

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
          return json(
            {
              lat,
              lng,
              eLoc: data.eLoc || data.eloc || data.mapplsPin || null,
              displayAddress:
                data.formatted_address ||
                data.placeName ||
                data.address ||
                fullAddress,
            },
            200,
            log,
          );
        }
      }
    } catch (e: any) {
      log.warn("Mappls failed", { error: e.message });
    }
  }

  // 2. Nominatim fallback with progressive chunking
  const parts = fullAddress
    .split(",")
    .map((p: string) => p.trim())
    .filter(Boolean);
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
          return json(
            {
              lat,
              lng,
              eLoc: null,
              displayAddress: best.display_name ?? fullAddress,
            },
            200,
            log,
          );
        }
      }
    } catch (e: any) {
      log.warn(`Nominatim failed for "${q}"`, { error: e.message });
    }
  }

  log.warn("No geocoding results found", { address });
  return json({ error: "No geocoding results found" }, 404, log);
}

async function handleDistance(body: any, log: ReturnType<typeof makeLogger>) {
  const { origin, destination } = body;
  if (!origin || !destination) {
    log.error("origin and destination are required");
    return json({ error: "origin and destination are required" }, 400, log);
  }

  try {
    const url = `https://route.mappls.com/route/dm/distance_matrix/driving/${origin};${destination}?region=ind&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.vercel.app/" },
    });
    const data = await res.json();

    if (data?.results?.distances) {
      return json({ distance: data.results.distances[0][1] / 1000 }, 200, log);
    }
    if (data?.distances?.[0]) {
      return json({ distance: data.distances[0][1] / 1000 }, 200, log);
    }
    log.warn("Unexpected structure", { data: JSON.stringify(data) });
    return json({ error: "Unexpected response structure" }, 500, log);
  } catch (e: any) {
    log.error("Failed to calculate distance", { error: e.message });
    return json({ error: "Failed to calculate distance" }, 500, log);
  }
}

async function handleDirections(body: any, log: ReturnType<typeof makeLogger>) {
  const { origin, destination } = body;
  if (!origin || !destination) {
    log.error("origin and destination are required");
    return json({ error: "origin and destination are required" }, 400, log);
  }

  try {
    const url = `https://route.mappls.com/route/direction/driving/${origin};${destination}?overview=full&geometries=geojson&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.vercel.app/" },
    });
    const data = await res.json();
    return json(data, 200, log);
  } catch (e: any) {
    log.error("Failed to fetch directions", { error: e.message });
    return json({ error: "Failed to fetch directions" }, 500, log);
  }
}

// ─── main handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const log = makeLogger("location");
  log.info("request started");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, log);
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "search":
        return await handleSearch(body, log);
      case "detail":
        return await handleDetail(body, log);
      case "reverse":
        return await handleReverse(body, log);
      case "geocode":
        return await handleGeocode(body, log);
      case "distance":
        return await handleDistance(body, log);
      case "directions":
        return await handleDirections(body, log);
      default:
        log.warn("Unknown action", { action });
        return json({ error: `Unknown action: ${action}` }, 400, log);
    }
  } catch (e: any) {
    log.error("Unexpected error", { error: String(e) });
    return json(
      { error: "Internal server error", details: String(e) },
      500,
      log,
    );
  }
});
