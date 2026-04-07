import type { ValidatedAddress } from "@/services/addressService";

export interface ManualAddressDetails {
  contactName: string;
  phoneNumber: string;
  houseNumber: string;
  streetAddress: string;
  landmark: string;
  city: string;
  pincode: string;
}

export interface CheckoutAddressContext {
  selectedAddress: ValidatedAddress | null;
  manualAddressDetails: ManualAddressDetails | null;
}

const CHECKOUT_ADDRESS_CONTEXT_KEY = "popclozet_checkout_address_context";

const trimValue = (value?: string | null) => (value || "").trim();

export function normalizeManualAddressDetails(
  details?: Partial<ManualAddressDetails> | null
): ManualAddressDetails | null {
  if (!details) return null;

  const normalized: ManualAddressDetails = {
    contactName: trimValue(details.contactName),
    phoneNumber: trimValue(details.phoneNumber),
    houseNumber: trimValue(details.houseNumber),
    streetAddress: trimValue(details.streetAddress),
    landmark: trimValue(details.landmark),
    city: trimValue(details.city),
    pincode: trimValue(details.pincode),
  };

  return hasManualAddressDetails(normalized) ? normalized : null;
}

export function hasManualAddressDetails(
  details?: Partial<ManualAddressDetails> | null
): boolean {
  if (!details) return false;

  return Boolean(
    trimValue(details.contactName) ||
      trimValue(details.phoneNumber) ||
      trimValue(details.houseNumber) ||
      trimValue(details.streetAddress) ||
      trimValue(details.landmark) ||
      trimValue(details.city) ||
      trimValue(details.pincode)
  );
}

export function buildManualAddressSummary(
  details?: Partial<ManualAddressDetails> | null
): string {
  if (!details) return "";

  return [
    trimValue(details.houseNumber),
    trimValue(details.streetAddress),
    trimValue(details.landmark),
    trimValue(details.city),
    trimValue(details.pincode),
  ]
    .filter(Boolean)
    .join(", ");
}

export function saveCheckoutAddressContext(context: CheckoutAddressContext) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      CHECKOUT_ADDRESS_CONTEXT_KEY,
      JSON.stringify({
        selectedAddress: context.selectedAddress,
        manualAddressDetails: normalizeManualAddressDetails(
          context.manualAddressDetails
        ),
      })
    );
  } catch {
    // Ignore storage failures and rely on router state.
  }
}

export function getCheckoutAddressContext(): CheckoutAddressContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_ADDRESS_CONTEXT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CheckoutAddressContext;
    return {
      selectedAddress: parsed.selectedAddress || null,
      manualAddressDetails: normalizeManualAddressDetails(
        parsed.manualAddressDetails
      ),
    };
  } catch {
    return null;
  }
}

export function clearCheckoutAddressContext() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(CHECKOUT_ADDRESS_CONTEXT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
