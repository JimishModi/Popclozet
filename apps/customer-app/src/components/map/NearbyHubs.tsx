// src/components/map/NearbyHubs.tsx
// List of nearby rental hubs with distance and availability

import { motion } from 'framer-motion';
import { MapPin, Clock, Truck, ChevronRight } from 'lucide-react';
import { HubWithDistance } from '@/services/hubService';
import { cn } from '@/lib/utils';

interface NearbyHubsProps {
    hubs: HubWithDistance[];
    selectedHubId?: string;
    onHubSelect: (hub: HubWithDistance) => void;
    isLoading?: boolean;
    className?: string;
}

export function NearbyHubs({
    hubs,
    selectedHubId,
    onHubSelect,
    isLoading = false,
    className,
}: NearbyHubsProps) {
    if (isLoading) {
        return (
            <div className={cn('space-y-3', className)}>
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="animate-pulse p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50"
                    >
                        <div className="h-5 w-2/3 bg-zinc-700 rounded mb-2" />
                        <div className="h-4 w-1/2 bg-zinc-700/50 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (hubs.length === 0) {
        return (
            <div className={cn('text-center py-8', className)}>
                <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">No hubs nearby</p>
                <p className="text-zinc-500 text-sm mt-1">
                    We don't have any rental hubs within 50km of your location yet.
                </p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-3', className)}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-400">
                    {hubs.length} hub{hubs.length !== 1 ? 's' : ''} nearby
                </h3>
            </div>

            {hubs.map((hub, index) => (
                <motion.button
                    key={hub.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onHubSelect(hub)}
                    className={cn(
                        'w-full text-left p-4 rounded-2xl border transition-all',
                        selectedHubId === hub.id
                            ? 'bg-[#f2546d]/10 border-[#f2546d]/50'
                            : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                    )}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-white truncate">{hub.name}</h4>
                                {selectedHubId === hub.id && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#f2546d] text-white text-[10px] font-bold">
                                        SELECTED
                                    </span>
                                )}
                            </div>

                            {/* Status badges */}
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className={cn(
                                        'px-2 py-0.5 rounded-full text-[10px] font-medium',
                                        hub.is_open
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                    )}
                                >
                                    {hub.is_open ? 'Open' : 'Closed'}
                                </span>
                                {hub.availability_status === 'busy' && (
                                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-medium">
                                        Busy
                                    </span>
                                )}
                            </div>

                            {/* Info row */}
                            <div className="flex items-center gap-4 text-xs text-zinc-400">
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>{hub.distance_km} km</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>{hub.estimated_minutes} mins</span>
                                </div>
                            </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                    </div>
                </motion.button>
            ))}
        </div>
    );
}

export default NearbyHubs;
