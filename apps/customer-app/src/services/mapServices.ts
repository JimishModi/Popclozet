/**
 * Mappls location helpers used by checkout, address selection, and home flows.
 *
 * Distance calls go through the Supabase `location` edge function first and
 * fall back to a local Haversine estimate if the upstream request fails.
 */

import { callLocationFn } from "@/utils/env";
import { haversineDistance } from "@/utils/haversine";
import { WAREHOUSE, DELIVERY_THRESHOLDS } from "@/lib/serviceAreas";
import { calculateDeliveryFee } from "./deliveryService";

export interface DistanceResult {
  distanceKm: number;
  status: "success" | "error";
  error?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  eLoc?: string | null;
  status: "success" | "error";
  error?: string;
}

/**
 * Calculate road distance between two points via the Supabase edge function.
 * Falls back to Haversine if the edge function is unavailable.
 */
export async function getRoadDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number; eLoc?: string },
): Promise<DistanceResult> {
  const originStr = `${origin.lng},${origin.lat}`;
  const destStr = destination.eLoc
    ? destination.eLoc
    : `${destination.lng},${destination.lat}`;

  if (!origin.lat || !origin.lng) {
    return { distanceKm: 0, status: "error", error: "Invalid origin coordinates" };
  }

  if (!destination.eLoc && (!destination.lat || !destination.lng)) {
    return {
      distanceKm: 0,
      status: "error",
      error: "Invalid destination (no eLoc or coordinates)",
    };
  }

  try {
    console.log("[Map] Calling location edge function (distance):", originStr, "->", destStr);
    const data = await callLocationFn({ action: "distance", origin: originStr, destination: destStr });
    const distance =
      typeof data.distance === "number"
        ? data.distance
        : Number.parseFloat(String(data.distance ?? ""));

    if (Number.isFinite(distance)) {
      console.log(`[Map] Road distance: ${distance.toFixed(2)}km`);
      return { distanceKm: distance, status: "success" };
    }

    throw new Error(data.error || "Unexpected response format");
  } catch (err) {
    console.warn("[Map] Distance edge function failed, using Haversine fallback:", err);

    if (destination.lat && destination.lng) {
      const km = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
      console.log(`[Map] Haversine fallback distance: ${km.toFixed(2)}km`);
      return { distanceKm: km, status: "success" };
    }

    return {
      distanceKm: 0,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Geocode a text address via the Supabase edge function.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    console.log("[Geocode] Calling location edge function:", address);
    const data = await callLocationFn({ action: "geocode", address });
    console.log("[Geocode] Response:", JSON.stringify(data));

    const lat = typeof data.lat === "number" ? data.lat : parseFloat(data.lat ?? "0");
    const lng = typeof data.lng === "number" ? data.lng : parseFloat(data.lng ?? "0");

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      throw new Error("Geocoding returned invalid coordinates");
    }

    console.log(`[Geocode] Resolved: lat=${lat} lng=${lng} eLoc=${data.eLoc ?? "none"}`);
    return {
      lat,
      lng,
      eLoc: data.eLoc ?? null,
      status: "success",
    };
  } catch (err) {
    console.error("[Geocode] Failed for address:", address, err);
    return {
      lat: 0,
      lng: 0,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Sanity-check: are origin and destination suspiciously close?
 */
export function coordinatesAreSuspiciouslyClose(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): boolean {
  return (
    Math.abs(origin.lat - dest.lat) < 0.1 &&
    Math.abs(origin.lng - dest.lng) < 0.1
  );
}

/**
 * Centralized delivery estimate based on road distance from warehouse.
 * Uses WAREHOUSE coords and DELIVERY_THRESHOLDS from serviceAreas.ts.
 */
export async function getDeliveryEstimate(
    destination: { lat: number; lng: number; eLoc?: string }
): Promise<{ estimate: '60min'; distanceKm: number; fee: number }> {
    const res = await getRoadDistance(WAREHOUSE, destination);
    const distanceKm = res.status === 'success' ? res.distanceKm : 0;
    const fee = calculateDeliveryFee(distanceKm);
    console.log(`[DeliveryEstimate] road=${distanceKm.toFixed(2)}km, threshold=${DELIVERY_THRESHOLDS.MAX_KM}km, fee=${fee}`);
    return { estimate: '60min', distanceKm, fee };
}
