import { useEffect, useState } from "react";
import { X } from "lucide-react";

/* ---------------------------------- */
/* Mumbai Geofence Config              */
/* ---------------------------------- */
const MUMBAI = {
  lat: 19.076,
  lng: 72.8777,
  radiusKm: 40,
};

type LocationState =
  | "idle"
  | "requesting"
  | "allowed"
  | "outside"
  | "dismissed"
  | "denied";

/* ---------------------------------- */
/* Distance Helpers                    */
/* ---------------------------------- */
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

function isInsideMumbai(lat: number, lng: number) {
  return distanceKm(lat, lng, MUMBAI.lat, MUMBAI.lng) <= MUMBAI.radiusKm;
}

/* ---------------------------------- */
/* Location Gate Component             */
/* ---------------------------------- */
export function LocationGate() {
  const [state, setState] = useState<LocationState>("idle");

  const saveLocation = (lat: number, lng: number) => {
    const allowed = isInsideMumbai(lat, lng);

    localStorage.setItem(
      "user_location",
      JSON.stringify({ lat, lng, allowed })
    );

    setState(allowed ? "allowed" : "outside");
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }

    setState("requesting");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => setState("denied"),
      { enableHighAccuracy: true }
    );
  };

  /* Restore previous session */
  useEffect(() => {
    const saved = localStorage.getItem("user_location");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setState(parsed.allowed ? "allowed" : "dismissed");
    } catch {
      localStorage.removeItem("user_location");
    }
  }, []);

  /* ---------------------------------- */
  /* Never block the app completely     */
  /* ---------------------------------- */
  if (state === "allowed" || state === "dismissed") return null;

  /* ---------------------------------- */
  /* Ask for location                   */
  /* ---------------------------------- */
  if (state === "idle" || state === "requesting" || state === "denied") {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 text-white border border-zinc-800">
          <h2 className="text-lg font-semibold mb-2">Enable location</h2>
          <p className="text-sm text-zinc-400 mb-6">
            We use your location to check delivery availability.
            You can browse even if delivery isn’t available yet.
          </p>

          <button
            onClick={requestLocation}
            className="w-full py-3 rounded-full bg-[#ff4d6d] font-semibold"
          >
            Allow location
          </button>

          {state === "denied" && (
            <p className="text-xs text-red-400 mt-3">
              Location permission was denied.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------- */
  /* Outside Mumbai (dismissible modal) */
  /* ---------------------------------- */
  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 p-6 text-white border border-zinc-800">

        {/* Close / dismiss */}
        <button
          onClick={() => setState("dismissed")}
          className="absolute top-3 right-3 p-1 rounded hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold mb-2">
          Service not available
        </h2>

        <p className="text-sm text-zinc-400 mb-6">
          We currently deliver only in Mumbai.
          You may continue browsing, but checkout is unavailable.
        </p>

        <button
          onClick={() => setState("dismissed")}
          className="w-full py-3 rounded-full bg-zinc-800 font-semibold"
        >
          Continue browsing
        </button>
      </div>
    </div>
  );
}
