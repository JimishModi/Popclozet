import { useMemo } from "react";
import useCountdown from "@/hooks/useCountdown";
import { Timer } from "lucide-react";

interface DeliveryCountdownProps {
  cutoffMinutesFromNow?: number;
}

export const DeliveryCountdown = ({ cutoffMinutesFromNow = 90 }: DeliveryCountdownProps) => {
  const target = useMemo(() => Date.now() + cutoffMinutesFromNow * 60 * 1000, [cutoffMinutesFromNow]);
  const { formatted, done } = useCountdown(target);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 bg-muted/50">
      <Timer className="w-4 h-4 text-primary" aria-hidden="true" />
      <div className="text-sm">
        <div className="font-semibold">Delivery countdown</div>
        <p className="text-muted-foreground text-xs">{done ? "Next slot opens soon" : `Order in ${formatted} for fastest delivery.`}</p>
      </div>
    </div>
  );
};

export default DeliveryCountdown;
