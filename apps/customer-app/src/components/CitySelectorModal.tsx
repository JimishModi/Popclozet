// src/components/CitySelectorModal.tsx
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectCity?: (city: CityOption) => void;
}

type CityOption = "Mumbai" | "Other";

export function CitySelectorModal({ open, onClose }: Props) {
  if (!open) return null;

  const selectCity = (city: CityOption) => {
    localStorage.setItem(
      "service_availability",
      JSON.stringify({
        city,
        source: "manual",
      })
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 p-6 text-white border border-zinc-800">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-white/10"
          aria-label="Close city selector"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold mb-2">
          Select your city
        </h2>

        <p className="text-sm text-zinc-400 mb-6">
          We currently deliver only in select cities.
          You can still browse if delivery isn’t available.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => selectCity("Mumbai")}
            className="w-full py-3 rounded-full bg-[#ff4d6d] font-semibold"
          >
            Mumbai
          </button>

          <button
            onClick={() => selectCity("Other")}
            className="w-full py-3 rounded-full bg-zinc-800 font-semibold"
          >
            Other city
          </button>
        </div>
      </div>
    </div>
  );
}
