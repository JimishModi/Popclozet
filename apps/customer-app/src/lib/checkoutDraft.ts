export type CheckoutOrderType = "rental" | "home_try_on";

export interface CheckoutReturnSchedule {
  pickupSlotIso: string;
}

export interface CheckoutDraft {
  appliedCouponCode: string | null;
  agreedToTerms: boolean;
  agreedToSizing: boolean;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  selectedOrderType: CheckoutOrderType;
  returnSchedule: CheckoutReturnSchedule | null;
}

const CHECKOUT_DRAFT_KEY = "popclozet_checkout_draft";

export function readCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    return {
      appliedCouponCode: parsed.appliedCouponCode ?? null,
      agreedToTerms: Boolean(parsed.agreedToTerms),
      agreedToSizing: Boolean(parsed.agreedToSizing),
      recipientName: parsed.recipientName ?? "",
      recipientPhone: parsed.recipientPhone ?? "",
      recipientEmail: parsed.recipientEmail ?? "",
      selectedOrderType:
        parsed.selectedOrderType === "home_try_on" ? "home_try_on" : "rental",
      returnSchedule:
        parsed.returnSchedule?.pickupSlotIso
          ? { pickupSlotIso: parsed.returnSchedule.pickupSlotIso }
          : null,
    };
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(draft: CheckoutDraft) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures and keep the flow usable.
  }
}

export function clearCheckoutDraft() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
