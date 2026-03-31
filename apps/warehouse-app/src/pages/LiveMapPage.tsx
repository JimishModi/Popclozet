import React, { useState } from 'react';
import { LiveRiderMap } from '../components/LiveRiderMap';
import { WarehouseShell } from '../components/layout/WarehouseShell';
import { useMap } from '../contexts/MapContext';
import { Map as MapIcon, Users, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LiveMapPage: React.FC = () => {
    const { riders, loading } = useMap();
    const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    const handleRiderClick = (orderId: string) => {
        setSelectedOrderId(orderId);
        setViewMode('single');
    };

    return (
        <WarehouseShell className="flex flex-col h-screen overflow-hidden" hideBottomNav={false}>
            {/* Header / Stats Overlay */}
            <div className="absolute top-20 left-4 right-4 z-10 pointer-events-none">
                <div className="flex items-center justify-between">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-[#0f0f0f]/80 backdrop-blur-md border border-zinc-800 rounded-2xl px-4 py-2.5 shadow-2xl pointer-events-auto"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-warehouse-500/10 flex items-center justify-center text-warehouse-400">
                                <Users size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Live Riders</p>
                                <p className="text-sm text-white font-bold">{riders.length} active</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-[#0f0f0f]/80 backdrop-blur-md border border-zinc-800 rounded-2xl px-4 py-2.5 shadow-2xl pointer-events-auto"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                <Navigation size={16} className="animate-pulse" />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Updates</p>
                                <p className="text-sm text-emerald-400 font-bold">Real-time</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative">
                <LiveRiderMap 
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    selectedOrderId={selectedOrderId}
                    onRiderClick={handleRiderClick}
                />
            </div>

            {/* Rider List Overlay */}
            <AnimatePresence>
                {riders.length > 0 && (
                    <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="absolute bottom-24 left-4 right-4 z-10 pointer-events-none"
                    >
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pointer-events-auto">
                            {riders.map((rider) => (
                                <button
                                    key={rider.orderId}
                                    onClick={() => handleRiderClick(rider.orderId)}
                                    className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
                                        selectedOrderId === rider.orderId 
                                            ? 'bg-warehouse-500 border-warehouse-400 text-black shadow-lg shadow-warehouse-500/20' 
                                            : 'bg-[#0f0f0f]/90 backdrop-blur-md border-zinc-800 text-white'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                        selectedOrderId === rider.orderId ? 'bg-black/10' : 'bg-warehouse-500/20 text-warehouse-400'
                                    }`}>
                                        {rider.riderName[0]}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold truncate max-w-[80px]">{rider.riderName}</p>
                                        <p className={`text-[9px] font-medium ${selectedOrderId === rider.orderId ? 'text-black/60' : 'text-zinc-500'}`}>
                                            #{rider.orderId.slice(0, 6)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </WarehouseShell>
    );
};

export default LiveMapPage;
