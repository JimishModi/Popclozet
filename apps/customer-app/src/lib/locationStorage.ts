export type StoredLocation =
  | {
    source: "manual";
    city: string;
    locality?: string;
    delivery_estimate?: "60min";
  }
  | {
    source: "gps";
    lat: number;
    lng: number;
    city?: string;
    locality?: string;
    eLoc?: string;
    delivery_estimate?: "60min";
  };

const KEY = "service_availability";

export const locationStorage = {
  get(): StoredLocation | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  set(value: StoredLocation) {
    localStorage.setItem(KEY, JSON.stringify(value));
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
