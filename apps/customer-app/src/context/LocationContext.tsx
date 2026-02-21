import { createContext, useContext, useEffect, useState } from "react"
import { ValidatedAddress } from "@/services/addressService"
import {
  loadLocation,
  saveLocation,
  clearLocation,
} from "@/services/locationStorage"

type LocationState = {
  address: ValidatedAddress | null
  setAddress: (a: ValidatedAddress) => void
  clearAddress: () => void
}

const LocationContext = createContext<LocationState | null>(null)

export function LocationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [address, setAddressState] = useState<ValidatedAddress | null>(null)

  // 🔒 Restore on app load
  useEffect(() => {
    const stored = loadLocation()
    if (stored) {
      setAddressState(stored)
    }
  }, [])

  const setAddress = (a: ValidatedAddress) => {
    setAddressState(a)
    saveLocation(a)
  }

  const clearAddressState = () => {
    setAddressState(null)
    clearLocation()
  }

  return (
    <LocationContext.Provider
      value={{ address, setAddress, clearAddress: clearAddressState }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) {
    throw new Error("useLocation must be used within LocationProvider")
  }
  return ctx
}
