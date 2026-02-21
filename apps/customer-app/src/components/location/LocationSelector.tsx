import { useState } from "react"
import { useLocation } from "@/context/LocationContext"
import { validateAddress } from "@/services/addressService"
import { useGeofence } from "@/hooks/useGeofence"

export function LocationSelector() {
  const { address, setAddress } = useLocation()
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isServiceable } = useGeofence(address || undefined)

  async function handleConfirm() {
    try {
      setLoading(true)
      setError(null)

      const validated = await validateAddress(input)
      setAddress(validated)
    } catch {
      setError("Unable to find this address")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button>
        {address?.city || "Select location"}
      </button>

      {/* Modal (simplified) */}
      <div>
        <input
          placeholder="Enter delivery address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button onClick={handleConfirm} disabled={loading}>
          {loading ? "Checking…" : "Confirm location"}
        </button>

        {error && <p>{error}</p>}

        {address && !isServiceable && (
          <p>We’re not live in this area yet. Coming soon.</p>
        )}
      </div>
    </div>
  )
}
