// src/components/map/InteractiveMap.tsx

import React from 'react';
import { cn } from '@/lib/utils';
import { MapLocation } from '@/services/mapService';

interface InteractiveMapProps {
    className?: string;
    center?: MapLocation;
    zoom?: number;
    darkMode?: boolean;
    userLocation?: MapLocation | null;
    hubs?: any[];
    selectedHubId?: string;
    routePath?: [number, number][] | null;
    vehicleLocation?: MapLocation | null;
    trackerMode?: boolean;

    onMapClick?: (location: MapLocation) => void;
    onHubClick?: (hub: any) => void;
    onMarkerDrag?: (location: MapLocation) => void;
}

export function InteractiveMap({ className, center }: InteractiveMapProps) {
    return (
        <div className={cn('relative w-full h-full min-h-[400px] flex items-center justify-center bg-zinc-900 rounded-2xl', className)}>
            <div className="text-center px-6">
                <p className="text-zinc-400 text-sm mb-2">Visual map is temporarily unavailable.</p>
                {center && (
                    <p className="text-white text-xs font-medium">
                        Location: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                    </p>
                )}
            </div>
        </div>
    );
}

export default InteractiveMap;
