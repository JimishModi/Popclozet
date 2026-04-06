// src/services/locationStorage.ts
import { ValidatedAddress } from "@/services/addressService"

const STORAGE_KEY = "popclozet_location"

export function saveLocation(address: ValidatedAddress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(address))
  } catch (e) {
    console.warn("localStorage not available", e);
  }
}

export function loadLocation(): ValidatedAddress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearLocation() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.warn("localStorage not available", e);
  }
}
