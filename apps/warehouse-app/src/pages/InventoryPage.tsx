/**
 * Inventory Page — Mobile Layout
 * Uses `products` table (name, brand, category) via inventory join.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Edit2, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';
import { getAllInventory, updateStock, type InventoryWithProduct } from '../services/inventoryService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeInventory } from '../hooks/useRealtimeInventory';

export function InventoryPage() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [inventory, setInventory] = useState<InventoryWithProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ available_stock: number; went_for_wash: number }>({ available_stock: 0, went_for_wash: 0 });

    const loadInventory = useCallback(async () => {
        try {
            const data = await getAllInventory();
            setInventory(data);
        } catch (err) {
            console.error('Failed to load inventory:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadInventory(); }, [loadInventory]);
    useRealtimeInventory({ onChange: loadInventory });

    const filtered = inventory.filter(item => {
        const name = (item as any).products?.name?.toLowerCase() || '';
        const brand = (item as any).products?.brand?.toLowerCase() || '';
        const q = search.toLowerCase();
        return name.includes(q) || brand.includes(q) || (item.size || '').toLowerCase().includes(q);
    });

    const startEdit = (item: InventoryWithProduct) => {
        setEditingId(item.id);
        setEditValues({ available_stock: item.available_stock ?? 0, went_for_wash: item.went_for_wash ?? 0 });
    };

    const saveEdit = async (id: string) => {
        try {
            await updateStock(id, editValues, user?.id || 'anonymous');
            showToast('Stock updated successfully');
            setEditingId(null);
            await loadInventory();
        } catch (err: any) {
            console.error('Stock update error:', err);
            showToast(err.message || 'Failed to update stock', 'error');
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(5)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-20 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white">Inventory</h1>
                    <p className="text-xs text-zinc-500">{inventory.length} entries</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="input-field pl-9 h-10 text-sm"
                />
            </div>

            {/* Card List */}
            <div className="space-y-2.5">
                {filtered.length === 0 ? (
                    <div className="text-center py-12">
                        <Package size={32} className="mx-auto text-zinc-600 mb-2" />
                        <p className="text-zinc-500 text-sm">{search ? 'No matches' : 'No inventory data'}</p>
                    </div>
                ) : (
                    filtered.map((item) => {
                        const isEditing = editingId === item.id;
                        const available = item.available_stock ?? 0;
                        const wash = (item as any).went_for_wash ?? 0;

                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-surface-card border border-surface-border rounded-xl p-3.5"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-200 truncate">{(item as any).products?.name || '—'}</p>
                                        <p className="text-[10px] text-zinc-500">{(item as any).products?.brand || ''} • {(item as any).products?.category || ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warehouse-500/10 text-warehouse-300 border border-warehouse-500/20">
                                            {item.size || '—'}
                                        </span>
                                        {!isEditing && (
                                            <button onClick={() => startEdit(item)} className="p-1 rounded-lg hover:bg-surface-hover text-zinc-500">
                                                <Edit2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-zinc-500">In Wash</label>
                                                <input
                                                    type="number"
                                                    value={editValues.went_for_wash}
                                                    onChange={(e) => setEditValues(v => ({ ...v, went_for_wash: parseInt(e.target.value) || 0 }))}
                                                    className="w-full h-8 text-center rounded-lg bg-surface border border-warehouse-500/40 text-white text-sm"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-zinc-500">Available</label>
                                                <input
                                                    type="number"
                                                    value={editValues.available_stock}
                                                    onChange={(e) => setEditValues(v => ({ ...v, available_stock: parseInt(e.target.value) || 0 }))}
                                                    className="w-full h-8 text-center rounded-lg bg-surface border border-warehouse-500/40 text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => saveEdit(item.id)} className="flex-1 btn-success text-xs py-1.5 flex items-center justify-center gap-1">
                                                <Check size={12} /> Save
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="flex-1 btn-danger text-xs py-1.5 flex items-center justify-center gap-1">
                                                <X size={12} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-xs">
                                        <div className="flex-1 text-center py-1.5 rounded-lg bg-surface-hover">
                                            <span className="text-zinc-500">Total</span>
                                            <p className="font-mono font-bold text-zinc-200">{item.total_stock ?? 0}</p>
                                        </div>
                                        <div className="flex-1 text-center py-1.5 rounded-lg bg-surface-hover">
                                            <span className="text-zinc-500">Avail</span>
                                            <p className={clsx('font-mono font-bold', available > 0 ? 'text-emerald-400' : 'text-red-400')}>{available}</p>
                                        </div>
                                        <div className="flex-1 text-center py-1.5 rounded-lg bg-surface-hover">
                                            <span className="text-zinc-500">Wash</span>
                                            <p className={clsx('font-mono font-bold', wash > 0 ? 'text-amber-400' : 'text-zinc-500')}>{wash}</p>
                                        </div>
                                        <div className="flex-1 text-center">
                                            {available === 0 ? (
                                                <span className="text-[10px] font-bold text-red-400">OUT</span>
                                            ) : available <= 2 ? (
                                                <span className="text-[10px] font-bold text-amber-400">LOW</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-emerald-400">OK</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
