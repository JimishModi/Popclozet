// src/lib/serviceAreas.ts

export type ServiceAreaStatus = "live" | "coming_soon";

export type ServiceArea = {
  id: string;
  name: string;
  status: ServiceAreaStatus;
  center?: {
    lat: number;
    lng: number;
  };
  radiusKm?: number;
};

/**
 * Service Areas Configuration
 * 
 * For demo: IIT Bombay campus area (6km radius)
 * Customers outside this area can browse products but cannot checkout
 */
export const SERVICE_AREAS: ServiceArea[] = [
  {
    id: "mumbai",
    name: "Mumbai",
    status: "live",
    center: {
      lat: 19.076,
      lng: 72.8777,
    },
    radiusKm: 50,  // Entire Mumbai metropolitan area
  },
  {
    id: "bangalore",
    name: "Bangalore",
    status: "live",
    center: {
      lat: 12.9716,
      lng: 77.5946,
    },
    radiusKm: 40,
  },
  {
    id: "delhi",
    name: "Delhi",
    status: "live",
    center: {
      lat: 28.6139,
      lng: 77.2090,
    },
    radiusKm: 40,
  },
  {
    id: "other",
    name: "Other cities",
    status: "live",
  },
];

// Warehouse location (same as IIT Bombay center for demo)
export const WAREHOUSE_LOCATION = {
  lat: 19.1305,
  lng: 72.9135,
  address: "Hostel 2, IIT Bombay, Powai, Mumbai",
};

