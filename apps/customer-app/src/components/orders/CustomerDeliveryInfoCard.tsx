import { MapPin, Phone, User } from "lucide-react";

interface CustomerDeliveryInfoCardProps {
  title?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fetchedAddress?: string | null;
  manualAddressSummary?: string | null;
}

export function CustomerDeliveryInfoCard({
  title = "Your Delivery Information",
  customerName,
  customerPhone,
  fetchedAddress,
  manualAddressSummary,
}: CustomerDeliveryInfoCardProps) {
  return (
    <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl">
      <div className="space-y-4">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{title}</p>

        <div className="flex items-start gap-3">
          <User className="w-4 h-4 text-[#f2546d] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Name</p>
            <p className="text-sm text-white mt-1">{customerName || "Not available"}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Phone className="w-4 h-4 text-[#f2546d] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Phone</p>
            {customerPhone ? (
              <a href={`tel:${customerPhone}`} className="text-sm text-white mt-1 underline decoration-transparent hover:decoration-white">
                {customerPhone}
              </a>
            ) : (
              <p className="text-sm text-zinc-500 mt-1">Not available</p>
            )}
          </div>
        </div>

        {(fetchedAddress || manualAddressSummary) ? (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#f2546d] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Delivery Address</p>
              {fetchedAddress ? (
                <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{fetchedAddress}</p>
              ) : null}
              {manualAddressSummary ? (
                <p className="text-sm text-white mt-2 leading-relaxed">{manualAddressSummary}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
