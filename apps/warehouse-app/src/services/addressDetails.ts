export interface ManualAddressDetails {
    contactName?: string | null;
    phoneNumber?: string | null;
    houseNumber?: string | null;
    streetAddress?: string | null;
    landmark?: string | null;
    city?: string | null;
    pincode?: string | null;
}

const trimValue = (value?: string | null) => (value || '').trim();

export function buildManualAddressSummary(details?: ManualAddressDetails | null) {
    if (!details) return '';

    return [
        trimValue(details.houseNumber),
        trimValue(details.streetAddress),
        trimValue(details.landmark),
        trimValue(details.city),
        trimValue(details.pincode),
    ]
        .filter(Boolean)
        .join(', ');
}
