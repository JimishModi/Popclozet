import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, ArrowUp, ArrowDown, Search, RefreshCw, Package, QrCode } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';
import { getWashQueue, sendUnitToWash, returnUnitFromWash, getWashableUnits } from '../services/washService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeInventory } from '../hooks/useRealtimeInventory';

type Tab = 'queue' | 'manual';

export function WashCyclePage() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('queue');
    const [queue, setQueue] = useState<any[]>([]);
    const [washable, setWashable] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [q, w] = await Promise.all([getWashQueue(), getWashableUnits()]);
            setQueue(q);
            setWashable(w);
        } catch (err) {
            console.error('Wash data load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useRealtimeInventory({ onChange: loadData });

    const handleAction = async (unitId: string, action: 'send' | 'return') => {
        setProcessing(unitId);
        try {
            const actorId = user?.id || 'anonymous';
            if (action === 'send') {
                await sendUnitToWash(unitId, actorId);
                showToast(`Item ${unitId} sent to wash`);
            } else {
                await returnUnitFromWash(unitId, actorId);
                showToast(`Item ${unitId} returned from wash`);
            }
            await loadData();
        } catch (err: any) {
            showToast(err.message || 'Action failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const filteredQueue = queue.filter(i =>
        i.individual_id.toLowerCase().includes(search.toLowerCase()) ||
        i.inventory?.products?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredWashable = washable.filter(i =>
        i.individual_id.toLowerCase().includes(search.toLowerCase()) ||
        i.inventory?.products?.name?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(3)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-24 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <Droplets size={20} className="text-amber-400" /> Wash Cycle
                </h1>
                <p className="text-xs text-zinc-500">{queue.length} in wash • {washable.length} available</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-surface-card rounded-xl border border-surface-border p-1 gap-1">
                {[
                    { key: 'queue' as Tab, label: 'In Wash (Queue)', icon: ArrowDown },
                    { key: 'manual' as Tab, label: 'Manual Send', icon: ArrowUp },
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={clsx(
                            'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all',
                            tab === key
                                ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30'
                                : 'text-zinc-500 hover:text-zinc-300'
                        )}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ID or product..."
                    className="input-field pl-9 h-10 text-sm"
                />
            </div>

            <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                    {(tab === 'queue' ? filteredQueue : filteredWashable).length === 0 ? (
                        <div className="text-center py-12">
                            <Package size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">
                                {tab === 'queue' ? 'Queue is empty' : 'No items available to wash'}
                            </p>
                        </div>
                    ) : (
                        (tab === 'queue' ? filteredQueue : filteredWashable).map(item => {
                            const isProcessing = processing === item.individual_id;
                            return (
                                <motion.div
                                    key={item.individual_id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-surface-card border border-surface-border rounded-xl p-3.5 flex items-center gap-3"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0 border border-surface-border overflow-hidden">
                                        {item.inventory?.products?.images?.[0] ? (
                                            <img src={item.inventory.products.images[0]} alt="" className="object-cover w-full h-full" />
                                        ) : (
                                            <Package size={18} className="text-zinc-600" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-200 truncate">{item.inventory?.products?.name || 'Untitled'}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">
                                            Size: {item.inventory?.size} • <span className="font-mono">{item.individual_id}</span>
                                        </p>
                                    </div>

                                    <button
                                        disabled={!!processing}
                                        onClick={() => handleAction(item.individual_id, tab === 'queue' ? 'return' : 'send')}
                                        className={clsx(
                                            'shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all',
                                            isProcessing
                                                ? 'bg-zinc-800 text-zinc-600'
                                                : tab === 'queue'
                                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                    : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                                        )}
                                    >
                                        {isProcessing ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : tab === 'queue' ? (
                                            <ArrowDown size={18} />
                                        ) : (
                                            <ArrowUp size={18} />
                                        )}
                                    </button>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
