// src/services/locationStorage.ts
import { ValidatedAddress } from "@/services/addressService"

const STORAGE_KEY = "popclozet_location"

export function saveLocation(address: ValidatedAddress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(address))
}

export function loadLocation(): ValidatedAddress | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearLocation() {
  localStorage.removeItem(STORAGE_KEY)
}
