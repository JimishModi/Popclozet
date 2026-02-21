// src/hooks/useGeofence.ts
import { useMemo } from "react"
import { findServiceArea } from "@/services/geoService"
import { ValidatedAddress } from "@/services/addressService"

export function useGeofence(address?: ValidatedAddress) {
  return useMemo(() => {
    if (!address) {
      return {
        isServiceable: false,
        serviceArea: null,
      }
    }

    const area = findServiceArea(address.lat, address.lng)

    return {
      isServiceable: Boolean(area),
      serviceArea: area,
    }
  }, [address])
}
