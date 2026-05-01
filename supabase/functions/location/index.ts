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

function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMatrixDistanceKm(data: any): number | null {
  const rawDistance =
    data?.results?.distances?.[0]?.[1] ??
    data?.distances?.[0]?.[1] ??
    data?.results?.[0]?.distances?.[0]?.[1];

  const distanceInMeters =
    typeof rawDistance === "number"
      ? rawDistance
      : Number.parseFloat(String(rawDistance ?? ""));

  if (!Number.isFinite(distanceInMeters) || distanceInMeters < 0) {
    return null;
  }

  return distanceInMeters / 1000;
}

// ─── action handlers ────────────────────────────────────────────────

// Mappls returns every POI type — addresses, hostels, but also benches, trees,
// waste baskets, ATMs, etc. For an address-selection flow these noisy POIs
// produce wildly wrong coordinates (e.g. picking the lat/lng of a literal trash
// can near a building). Restrict to address-shaped types and drop the rest.
const ADDRESS_TYPES = new Set([
  "address",
  "street_address",
  "house",
  "building",
  "locality",
  "sub_locality",
  "village",
  "city",
  "district",
  "state",
  "country",
  "pincode",
  "postal_code",
  "landmark",
  "place",
  "poi", // Mappls' generic point-of-interest — usually safe
]);

function isAddressLikePlace(p: any): boolean {
  const t = (p?.type || "").toString().toLowerCase().replace(/\s+/g, "_");
  if (!t) return true; // unknown type — let it through, better than dropping all
  // Allow if type matches whitelist or contains "address"/"locality"/"street"
  if (ADDRESS_TYPES.has(t)) return true;
  if (t.includes("address") || t.includes("locality") || t.includes("street") || t.includes("road")) {
    return true;
  }
  return false;
}

async function handleSearch(body: any, log: ReturnType<typeof makeLogger>) {
  const { query, lat, lng } = body;
  if (!query) {
    log.error("query is required");
    return json({ error: "query is required" }, 400, log);
  }

  const truncated = String(query).slice(0, 100);
  const locationBias = lat && lng ? `&location=${lat},${lng}` : "";

  // 1. Mappls AutoSuggest — request more results so we can filter and still have options
  try {
    const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(truncated)}&access_token=${REST_KEY}&region=IND&tokenizeAddress=true&pod=Locality,SubLocality,City,SubDistrict,District,State,PinCode,Building,Address,POI&limit=15${locationBias}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.in/" },
    });
    const data = await res.json();
    const rawResults =
      data.suggestedLocations || (Array.isArray(data) ? data : []);

    // Drop garbage POI types (waste_basket, bench, etc.) — keep only address-like results
    const filtered = rawResults.filter(isAddressLikePlace);
    const results = filtered.length > 0 ? filtered : rawResults;

    if (results.length > 0) return json(results, 200, log);
  } catch (e: any) {
    log.warn("Mappls failed", { error: e.message });
  }

  // 2. Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(truncated)}&format=json&addressdetails=1&countrycodes=in&limit=10`;
    const nomRes = await fetch(nomUrl, {
      headers: { "User-Agent": "Popclozet/1.0 (popclozet.in)" },
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

// Mappls' Atlas API (atlas.mappls.com) requires OAuth tokens for many places
// endpoints — our REST key alone returns 404 here. The legacy v1 API
// (apis.mappls.com/advancedmaps/v1/{key}/place_detail) accepts the REST key
// directly in the URL path. Try v1 first, fall back to Atlas, then surface
// 404 only if both miss.
async function tryMapplsV1Detail(eloc: string, log: ReturnType<typeof makeLogger>): Promise<any> {
  try {
    const url = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/place_detail?eloc=${encodeURIComponent(eloc)}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.in/" },
    });
    if (!res.ok) {
      log.warn("Mappls v1 place_detail non-200", { eloc, status: res.status });
      return null;
    }
    const result = await res.json();
    // v1 API shape: { results: [{ latitude, longitude, ... }] }
    const data = result?.results?.[0] ?? (Array.isArray(result) ? result[0] : result);
    if (data && (data.latitude || data.lat)) return data;
    return null;
  } catch (e: any) {
    log.warn("Mappls v1 place_detail threw", { error: e.message });
    return null;
  }
}

async function tryMapplsAtlasDetail(eloc: string, log: ReturnType<typeof makeLogger>): Promise<any> {
  try {
    const url = `https://atlas.mappls.com/api/places/geocode?eLoc=${encodeURIComponent(eloc)}&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.in/" },
    });
    if (!res.ok) {
      log.warn("Mappls Atlas geocode non-200", { eloc, status: res.status });
      return null;
    }
    const result = await res.json();
    const data = Array.isArray(result)
      ? result[0]
      : result.results
        ? result.results[0]
        : result;
    if (data && (data.latitude || data.lat)) return data;
    return null;
  } catch (e: any) {
    log.warn("Mappls Atlas geocode threw", { error: e.message });
    return null;
  }
}

async function handleDetail(body: any, log: ReturnType<typeof makeLogger>) {
  const { eloc } = body;
  if (!eloc) {
    log.error("eloc is required");
    return json({ error: "eloc is required" }, 400, log);
  }

  // Try v1 first (REST-key compatible), then Atlas as fallback.
  const data = (await tryMapplsV1Detail(eloc, log)) ?? (await tryMapplsAtlasDetail(eloc, log));

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

  log.warn("Location details not found in v1 or Atlas", { eloc });
  return json({ error: "Location details not found" }, 404, log);
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
      headers: { Referer: "https://popclozet.in/" },
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
      headers: { "User-Agent": "Popclozet/1.0 (popclozet.in)" },
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

// Atlas API requires OAuth, but the legacy v1 API accepts the REST key in the
// URL path. Try v1 first (works), then Atlas (sometimes works), then Nominatim.
async function tryMapplsV1Geocode(address: string, log: ReturnType<typeof makeLogger>): Promise<any> {
  try {
    const url = `https://apis.mappls.com/advancedmaps/v1/${REST_KEY}/geo_code?addr=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.in/" },
    });
    if (!res.ok) {
      log.warn("Mappls v1 geocode non-200", { status: res.status });
      return null;
    }
    const result = await res.json();
    // v1 API shape: { results: [{ lat, lng, formatted_address, ... }], responseCode: 200 }
    const data = result?.results?.[0] ?? (Array.isArray(result) ? result[0] : null);
    if (data && (data.lat || data.latitude)) return data;
    return null;
  } catch (e: any) {
    log.warn("Mappls v1 geocode threw", { error: e.message });
    return null;
  }
}

async function tryMapplsAtlasGeocode(address: string, log: ReturnType<typeof makeLogger>): Promise<any> {
  try {
    const url = `https://atlas.mappls.com/api/places/geocode?address=${encodeURIComponent(address)}&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.in/" },
    });
    if (!res.ok) {
      log.warn("Mappls Atlas geocode non-200", { status: res.status });
      return null;
    }
    const result = await res.json();
    const data = Array.isArray(result)
      ? result[0]
      : result.copResults
        ? result.copResults[0]
        : result.results
          ? result.results[0]
          : result;
    if (data && (data.latitude || data.lat)) return data;
    return null;
  } catch (e: any) {
    log.warn("Mappls Atlas geocode threw", { error: e.message });
    return null;
  }
}

async function handleGeocode(body: any, log: ReturnType<typeof makeLogger>) {
  const { address } = body;
  if (!address) {
    log.error("address is required");
    return json({ error: "address is required" }, 400, log);
  }

  const fullAddress = String(address).replace(/،/g, ",");

  // 1. Mappls geocode — try v1 first, then Atlas
  if (REST_KEY) {
    const data = (await tryMapplsV1Geocode(fullAddress, log)) ?? (await tryMapplsAtlasGeocode(fullAddress, log));
    if (data) {
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
        headers: { "User-Agent": "Popclozet/1.0 (popclozet.in)" },
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
    const url = `https://route.mappls.com/route/dm/distance_matrix/driving/${origin};${destination}?rtype=0&region=ind&access_token=${REST_KEY}`;
    const res = await fetch(url, {
      headers: { Referer: "https://popclozet.in/" },
    });

    const raw = await res.text();
    const data = parseJsonSafely(raw);

    if (!res.ok) {
      log.error("Distance matrix request failed", {
        status: res.status,
        body: raw.slice(0, 500),
      });
      return json({ error: "Failed to calculate distance" }, 500, log);
    }

    const distanceKm = extractMatrixDistanceKm(data);
    if (distanceKm !== null) {
      return json({ distance: distanceKm }, 200, log);
    }

    log.warn("Unexpected structure", { data: raw.slice(0, 500) });
    return json({ error: "Unexpected response structure" }, 500, log);
  } catch (e: any) {
    log.error("Failed to calculate distance", { error: e.message });
    return json({ error: "Failed to calculate distance" }, 500, log);
  }
}

async function handleToken(log: ReturnType<typeof makeLogger>) {
  const clientId = Deno.env.get("MAPPLS_CLIENT_ID") || REST_KEY;
  const clientSecret = Deno.env.get("MAPPLS_CLIENT_SECRET") || REST_KEY;

  try {
    const res = await fetch("https://outpost.mappls.com/api/security/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    });
    const data = await res.json();
    if (data.access_token) {
      log.info("Minted short-lived Mappls OAuth token");
      return json({ token: data.access_token, expires_in: data.expires_in }, 200, log);
    }
    log.warn("Mappls OAuth failed — set MAPPLS_CLIENT_ID + MAPPLS_CLIENT_SECRET as Supabase secrets", { response: data });
  } catch (e: any) {
    log.warn("Mappls OAuth token mint failed", { error: e.message });
  }

  // Fallback: REST key. Rotate MAPPLS_REST_KEY and set MAPPLS_CLIENT_ID/SECRET to eliminate this.
  return json({ token: REST_KEY }, 200, log);
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
      headers: { Referer: "https://popclozet.in/" },
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
      case "token":
        return await handleToken(log);
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
