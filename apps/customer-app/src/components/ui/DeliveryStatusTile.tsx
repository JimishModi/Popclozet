import React, { useMemo } from 'react';
import { Clock, Truck } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';

interface DeliveryStatusTileProps {
    targetDate?: Date;
    deliveryTime?: string;
    className?: string;
}

const DeliveryStatusTile = ({
    targetDate,
    deliveryTime = "10:00 PM",
    className,
}: DeliveryStatusTileProps) => {
    // Default to 15 minutes from now if no target date provided (for demo)
    const effectiveTargetDate = useMemo(() => {
        if (targetDate) return targetDate;
        const date = new Date();
        date.setMinutes(date.getMinutes() + 15);
        return date;
    }, [targetDate]);

    const { formattedTime, isExpired } = useCountdown({
        targetDate: effectiveTargetDate,
    });

    return (
        <div
            className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors duration-300",
                isExpired
                    ? "bg-muted border-border text-muted-foreground"
                    : "bg-primary/5 border-primary/20 text-primary",
                className
            )}
        >
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        "p-2 rounded-full",
                        isExpired ? "bg-muted-foreground/10" : "bg-primary/10"
                    )}
                >
                    {isExpired ? (
                        <Clock className="h-4 w-4" />
                    ) : (
                        <Truck className="h-4 w-4 animate-pulse" />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-medium uppercase tracking-wider opacity-80">
                        {isExpired ? "Missed Slot" : "Order Within"}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                        {isExpired ? "Next Slot: Tomorrow" : formattedTime}
                    </span>
                </div>
            </div>

            {!isExpired && (
                <div className="text-right">
                    <span className="text-xs font-medium opacity-80 block">
                        Get it by
                    </span>
                    <span className="text-sm font-bold">{deliveryTime}</span>
                </div>
            )}
        </div>
    );
};

export default DeliveryStatusTile;
