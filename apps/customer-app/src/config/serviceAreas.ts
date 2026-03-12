// src/config/serviceAreas.ts

export type ServiceArea = {
  id: string
  name: string
  center: {
    lat: number
    lng: number
  }
  radiusMeters: number
  deliveryPromise: string
}

export const SERVICE_AREAS: ServiceArea[] = [
  {
    id: "blr-core",
    name: "Bangalore Core",
    center: {
      lat: 12.9716,
      lng: 77.5946,
    },
    radiusMeters: 12000, // 12km
    deliveryPromise: "Delivered in 60 minutes",
  },
]
