import { X, MapPin } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectCity?: () => void;
}

export function CheckoutBlockedModal({
  open,
  onClose,
  onSelectCity,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-blocked-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 p-6 text-white text-center border border-zinc-800">

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <h2
          id="checkout-blocked-title"
          className="text-lg font-semibold mb-2"
        >
          Checkout unavailable
        </h2>

        <p className="text-sm text-zinc-400 mb-6">
          Delivery isn’t available in your area yet.
          You can keep browsing, or select your city to check availability.
        </p>

        {/* Primary action */}
        <button
          onClick={onSelectCity || onClose}
          className="w-full py-3 rounded-full bg-[#ff4d6d] font-semibold flex items-center justify-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          Select your city
        </button>

        {/* Secondary action */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-full bg-zinc-800 font-semibold mt-3"
        >
          Continue browsing
        </button>
      </div>
    </div>
  );
}
