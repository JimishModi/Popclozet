// src/hooks/useServiceAvailability.ts

import { SERVICE_AREAS } from "@/lib/serviceAreas";
import { locationStorage } from "@/lib/locationStorage";

export type ServiceStatus =
  | { canCheckout: true; city: string }
  | {
      canCheckout: false;
      reason: "no_location" | "outside_service_area";
      city: string | null;
    };

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function useServiceAvailability(): ServiceStatus {
  const stored = locationStorage.get();

  /* ----------------------------- */
  /* NO LOCATION — still allow     */
  /* ----------------------------- */
  if (!stored) {
    // Default to allowing checkout — location can be set later
    return { canCheckout: true, city: "Mumbai" };
  }

  /* ----------------------------- */
  /* MANUAL CITY                   */
  /* ----------------------------- */
  if (stored.source === "manual") {
    // Always allow checkout regardless of city
    return { canCheckout: true, city: stored.city ?? "Mumbai" };
  }

  /* ----------------------------- */
  /* GPS                           */
  /* ----------------------------- */
  if (
    stored.source === "gps" &&
    typeof stored.lat === "number" &&
    typeof stored.lng === "number"
  ) {
    // Find matching city name or default
    for (const area of SERVICE_AREAS) {
      if (
        area.status !== "live" ||
        !area.center ||
        typeof area.radiusKm !== "number"
      ) {
        continue;
      }

      const dist = distanceKm(
        stored.lat,
        stored.lng,
        area.center.lat,
        area.center.lng
      );

      if (dist <= area.radiusKm) {
        return { canCheckout: true, city: area.name };
      }
    }

    // Allow checkout even outside known areas
    return { canCheckout: true, city: stored.city ?? "Your Area" };
  }

  /* ----------------------------- */
  /* FALLBACK — allow              */
  /* ----------------------------- */
  return { canCheckout: true, city: "Mumbai" };
}
