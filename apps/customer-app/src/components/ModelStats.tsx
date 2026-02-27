// src/components/ModelStats.tsx
import { cn } from "@/lib/utils";
import { Ruler, User } from "lucide-react";

interface ModelStatsProps {
    height: string;
    size: string;
    measurements?: {
        bust?: string;
        waist?: string;
        hips?: string;
    };
    className?: string;
    compact?: boolean;
}

export default function ModelStats({
    height,
    size,
    measurements,
    className,
    compact = false,
}: ModelStatsProps) {
    if (compact) {
        return (
            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
                <User className="w-4 h-4" />
                <span>
                    Model is <span className="font-medium text-foreground">{height}</span> wearing size{" "}
                    <span className="font-medium text-foreground">{size}</span>
                </span>
            </div>
        );
    }

    return (
        <div className={cn("p-4 rounded-xl bg-muted/50 border border-border", className)}>
            <div className="flex items-center gap-2 mb-3">
                <Ruler className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">Model Information</h4>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <span className="text-muted-foreground">Height</span>
                    <p className="font-medium">{height}</p>
                </div>
                <div>
                    <span className="text-muted-foreground">Wearing Size</span>
                    <p className="font-medium">{size}</p>
                </div>

                {measurements && (
                    <>
                        {measurements.bust && (
                            <div>
                                <span className="text-muted-foreground">Bust</span>
                                <p className="font-medium">{measurements.bust}</p>
                            </div>
                        )}
                        {measurements.waist && (
                            <div>
                                <span className="text-muted-foreground">Waist</span>
                                <p className="font-medium">{measurements.waist}</p>
                            </div>
                        )}
                        {measurements.hips && (
                            <div>
                                <span className="text-muted-foreground">Hips</span>
                                <p className="font-medium">{measurements.hips}</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
                Use this as a reference for fit. Actual fit may vary.
            </p>
        </div>
    );
}
