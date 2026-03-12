/**
 * Product Profile Page
 * Full product details with inventory sub-profiles per size.
 * Workers can: view all info, add stock to existing size, add a new size, manage discounts.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Package, Edit2, Plus, ChevronDown, ChevronRight,
    Tag, Percent, DollarSign, Calendar, Check, X, Loader,
    QrCode, Droplets, AlertTriangle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@popclozet/auth';
import { useToast } from '../contexts/ToastContext';
import {
    getFullProductProfile,
    addStockToInventory,
    addNewSizeToProduct,
    saveProductDiscount,
    toggleDiscount,
    type FullProductProfile,
    type InventorySubProfile,
} from '../services/productProfileService';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/* -----------------------------------------------------------
   Add Stock Modal (for existing size OR new size)
   ----------------------------------------------------------- */
function AddStockModal({
    productId,
    existingInventory,
    onClose,
    onDone,
    actorId,
}: {
    productId: string;
    existingInventory: InventorySubProfile[];
    onClose: () => void;
    onDone: (newIds: string[]) => void;
    actorId: string;
}) {
    const { showToast } = useToast();
    const existingSizes = existingInventory.map(i => i.size);
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [selectedInventoryId, setSelectedInventoryId] = useState(existingInventory[0]?.id ?? '');
    const [newSize, setNewSize] = useState('');
    const [qty, setQty] = useState(1);
    const [mrp, setMrp] = useState('');
    const [cost, setCost] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [createdIds, setCreatedIds] = useState<string[]>([]);

    const handleSubmit = async () => {
        if (qty <= 0) { showToast('Qty must be > 0', 'error'); return; }
        setSubmitting(true);
        try {
            let ids: string[] = [];
            if (mode === 'existing') {
                ids = await addStockToInventory(
                    selectedInventoryId,
                    productId,
                    existingInventory.find(i => i.id === selectedInventoryId)?.size || '',
                    qty,
                    mrp ? parseFloat(mrp) : undefined,
                    cost ? parseFloat(cost) : undefined,
                    actorId
                );
            } else {
                if (!newSize) { showToast('Select a size', 'error'); setSubmitting(false); return; }
                const res = await addNewSizeToProduct(productId, newSize, qty,
                    mrp ? parseFloat(mrp) : undefined,
                    cost ? parseFloat(cost) : undefined,
                    actorId);
                ids = res.unitIds;
            }
            setCreatedIds(ids);
            showToast(`Added ${ids.length} unit(s) ✓`);
        } catch (err: any) {
            showToast(err.message || 'Failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (createdIds.length > 0) {
        return (
            <div className="flex flex-col gap-4">
                <div className="text-center">
                    <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Check size={28} />
                    </div>
                    <p className="text-white font-bold">{createdIds.length} unit(s) added</p>
                    <p className="text-zinc-500 text-xs mt-0.5">New QR labels generated below</p>
                </div>
                <div className="space-y-3 max-h-[260px] overflow-y-auto">
                    {createdIds.map(id => (
                        <div key={id} className="bg-surface rounded-xl p-3 flex flex-col items-center gap-2 border border-surface-border">
                            <div className="bg-white p-2 rounded-lg">
                                <QRCodeSVG value={id} size={96} level="H" />
                            </div>
                            <p className="text-[10px] font-mono text-zinc-400">{id}</p>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex-1 h-10 rounded-xl bg-zinc-800 text-white text-xs font-bold">
                        Print Labels
                    </button>
                    <button onClick={() => onDone(createdIds)} className="flex-1 h-10 rounded-xl bg-warehouse-500 text-black text-xs font-bold">
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Mode Toggle */}
            <div className="flex bg-surface rounded-xl border border-surface-border p-1 gap-1">
                {[{ key: 'existing', label: 'Add to Existing Size' }, { key: 'new', label: 'Add New Size' }].map(m => (
                    <button
                        key={m.key}
                        onClick={() => setMode(m.key as any)}
                        className={clsx(
                            'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                            mode === m.key ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30' : 'text-zinc-500'
                        )}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {mode === 'existing' ? (
                <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Select Size</label>
                    <select
                        value={selectedInventoryId}
                        onChange={e => setSelectedInventoryId(e.target.value)}
                        className="input-field h-10 text-sm"
                    >
                        {existingInventory.map(inv => (
                            <option key={inv.id} value={inv.id}>
                                {inv.size} — {inv.total_stock} total, {inv.available_stock} available
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <div>
                    <label className="text-xs text-zinc-400 mb-1 block">New Size</label>
                    <div className="flex flex-wrap gap-2">
                        {SIZES.filter(s => !existingSizes.includes(s)).map(s => (
                            <button
                                key={s}
                                onClick={() => setNewSize(s)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                    newSize === s
                                        ? 'bg-warehouse-500/15 text-warehouse-300 border-warehouse-500/30'
                                        : 'bg-surface-card text-zinc-500 border-surface-border'
                                )}
                            >
                                {s}
                            </button>
                        ))}
                        {SIZES.filter(s => !existingSizes.includes(s)).length === 0 && (
                            <p className="text-xs text-zinc-500">All sizes already added.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Quantity */}
            <div>
                <label className="text-xs text-zinc-400 mb-1 block">Quantity to Add</label>
                <div className="flex items-center gap-3">
                    <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-surface text-zinc-300 flex items-center justify-center font-bold">−</button>
                    <span className="text-white font-mono text-lg w-8 text-center">{qty}</span>
                    <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-warehouse-500/20 text-warehouse-300 flex items-center justify-center font-bold">+</button>
                </div>
            </div>

            {/* Price info per unit (optional) */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-zinc-400 mb-1 block">MRP ₹ <span className="text-zinc-600">(optional)</span></label>
                    <input type="number" value={mrp} onChange={e => setMrp(e.target.value)} placeholder="e.g. 8000" className="input-field h-10 text-sm" />
                </div>
                <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Actual Cost ₹ <span className="text-zinc-600">(optional)</span></label>
                    <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 5000" className="input-field h-10 text-sm" />
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-surface-border text-zinc-400 text-sm">Cancel</button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting || (mode === 'new' && !newSize)}
                    className="flex-1 h-11 rounded-xl bg-warehouse-500 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {submitting ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                    Add Units
                </button>
            </div>
        </div>
    );
}

/* -----------------------------------------------------------
   Add Discount Modal
   ----------------------------------------------------------- */
function AddDiscountModal({
    productId,
    onClose,
    onDone,
}: {
    productId: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const { showToast } = useToast();
    const [type, setType] = useState<'percentage' | 'fixed_amount'>('percentage');
    const [value, setValue] = useState('');
    const [expires, setExpires] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handle = async () => {
        const v = parseFloat(value);
        if (!v || v <= 0) { showToast('Enter a valid value', 'error'); return; }
        if (type === 'percentage' && v > 100) { showToast('Percentage cannot exceed 100', 'error'); return; }
        setSubmitting(true);
        try {
            await saveProductDiscount(productId, type, v, expires || null);
            showToast('Discount added ✓');
            onDone();
        } catch (err: any) {
            showToast(err.message || 'Failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex bg-surface rounded-xl border border-surface-border p-1 gap-1">
                {[{ key: 'percentage', label: '% Off' }, { key: 'fixed_amount', label: 'Fixed ₹' }].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setType(t.key as any)}
                        className={clsx(
                            'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                            type === t.key ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30' : 'text-zinc-500'
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div>
                <label className="text-xs text-zinc-400 mb-1 block">{type === 'percentage' ? 'Discount %' : 'Discount ₹'}</label>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'percentage' ? 'e.g. 15' : 'e.g. 200'} className="input-field h-10 text-sm" />
            </div>
            <div>
                <label className="text-xs text-zinc-400 mb-1 block">Expires on <span className="text-zinc-600">(optional)</span></label>
                <input type="date" value={expires} onChange={e => setExpires(e.target.value)} className="input-field h-10 text-sm" />
            </div>
            <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-surface-border text-zinc-400 text-sm">Cancel</button>
                <button onClick={handle} disabled={submitting} className="flex-1 h-11 rounded-xl bg-warehouse-500 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {submitting ? <Loader size={16} className="animate-spin" /> : <Tag size={16} />}
                    Add Discount
                </button>
            </div>
        </div>
    );
}

/* -----------------------------------------------------------
   Size Sub-Profile Card
   ----------------------------------------------------------- */
function SizeCard({ inv }: { inv: InventorySubProfile }) {
    const [open, setOpen] = useState(false);

    const statusColor = (s: string) => ({
        available: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        washing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        rented: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        returned: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    }[s] || 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20');

    return (
        <div className="bg-surface border border-surface-border rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-surface-hover transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30">
                        {inv.size}
                    </span>
                    <div className="text-left">
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-zinc-400">Total: <span className="text-white font-mono font-bold">{inv.total_stock}</span></span>
                            <span className="text-emerald-400">Avail: <span className="font-mono font-bold">{inv.available_stock}</span></span>
                            {inv.went_for_wash > 0 && (
                                <span className="text-amber-400 flex items-center gap-1">
                                    <Droplets size={10} /> <span className="font-mono font-bold">{inv.went_for_wash}</span>
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{inv.units.length} physical units</p>
                    </div>
                </div>
                {open ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3.5 pb-3.5 space-y-2 border-t border-surface-border pt-3">
                            {inv.units.length === 0 ? (
                                <p className="text-xs text-zinc-600 text-center py-3">No physical units recorded yet.</p>
                            ) : (
                                inv.units.map(unit => (
                                    <div key={unit.individual_id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-surface-hover">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-mono text-zinc-300 truncate">{unit.individual_id}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase', statusColor(unit.status))}>
                                                    {unit.status}
                                                </span>
                                                <span className="text-[9px] text-zinc-600">×{unit.times_rented} rented</span>
                                                {unit.mrp_price && <span className="text-[9px] text-zinc-600">MRP ₹{unit.mrp_price.toLocaleString()}</span>}
                                            </div>
                                        </div>
                                        <div className="shrink-0 bg-white p-1 rounded">
                                            <QRCodeSVG value={unit.individual_id} size={36} level="M" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* -----------------------------------------------------------
   Main Product Profile Page
   ----------------------------------------------------------- */
export function ProductProfilePage() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [product, setProduct] = useState<FullProductProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<'stock' | 'discount' | null>(null);

    const load = useCallback(async () => {
        if (!productId) return;
        try {
            const data = await getFullProductProfile(productId);
            setProduct(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => { load(); }, [load]);

    const handleToggleDiscount = async (id: string, current: boolean) => {
        try {
            await toggleDiscount(id, !current);
            showToast(!current ? 'Discount activated' : 'Discount deactivated');
            load();
        } catch (err: any) {
            showToast(err.message || 'Failed', 'error');
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-surface-card rounded-lg animate-pulse" />
                    <div className="h-5 w-40 bg-surface-card rounded animate-pulse" />
                </div>
                {[...Array(5)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-16 animate-pulse" />)}
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <Package size={40} className="text-zinc-600 mb-3" />
                <p className="text-white font-bold">Product Not Found</p>
                <button onClick={() => navigate(-1)} className="mt-4 text-xs text-warehouse-400 underline">Go Back</button>
            </div>
        );
    }

    const totalStock = product.inventory.reduce((s, i) => s + i.total_stock, 0);
    const totalAvail = product.inventory.reduce((s, i) => s + i.available_stock, 0);
    const totalWash = product.inventory.reduce((s, i) => s + i.went_for_wash, 0);
    const activeDiscount = product.discounts.find(d => d.is_active);

    const discountedPrice = activeDiscount
        ? activeDiscount.discount_type === 'percentage'
            ? (product.rental_price ?? 0) * (1 - activeDiscount.discount_value / 100)
            : (product.rental_price ?? 0) - activeDiscount.discount_value
        : null;

    return (
        <>
            <div className="px-4 py-5 space-y-5 pb-10">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-surface-card border border-surface-border flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-bold text-white truncate">{product.name}</h1>
                        <p className="text-[10px] text-zinc-500">{product.brand} · {product.category} · {product.gender}</p>
                    </div>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', product.is_available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20')}>
                        {product.is_available ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </div>

                {/* Product Image */}
                {product.images && product.images[0] && (
                    <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-surface-card border border-surface-border">
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain p-4" />
                    </div>
                )}

                {/* Pricing Card */}
                <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">💰 Pricing</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface rounded-lg p-3">
                            <p className="text-[10px] text-zinc-500">Rental / day</p>
                            <p className="text-base font-bold text-white">₹{product.rental_price?.toLocaleString() ?? '—'}</p>
                            {discountedPrice !== null && (
                                <p className="text-[10px] text-emerald-400 font-semibold">After discount: ₹{discountedPrice.toFixed(0)}</p>
                            )}
                        </div>
                        <div className="bg-surface rounded-lg p-3">
                            <p className="text-[10px] text-zinc-500">Deposit</p>
                            <p className="text-base font-bold text-white">₹{product.deposit_amount?.toLocaleString() ?? '—'}</p>
                        </div>
                        <div className="bg-surface rounded-lg p-3">
                            <p className="text-[10px] text-zinc-500">MRP (Market Value)</p>
                            <p className="text-base font-bold text-zinc-200">₹{product.mrp?.toLocaleString() ?? '—'}</p>
                        </div>
                        {product.mrp && product.rental_price && (
                            <div className="bg-surface rounded-lg p-3">
                                <p className="text-[10px] text-zinc-500">Savings vs MRP</p>
                                <p className="text-base font-bold text-emerald-400">
                                    {Math.round((1 - product.rental_price / product.mrp) * 100)}% off
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stock Summary */}
                <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">📦 Stock Summary</p>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-zinc-500">Total</p>
                            <p className="text-lg font-mono font-bold text-white">{totalStock}</p>
                        </div>
                        <div className="bg-surface rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-zinc-500">Available</p>
                            <p className={clsx('text-lg font-mono font-bold', totalAvail > 0 ? 'text-emerald-400' : 'text-red-400')}>{totalAvail}</p>
                        </div>
                        <div className="bg-surface rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-zinc-500">In Wash</p>
                            <p className={clsx('text-lg font-mono font-bold', totalWash > 0 ? 'text-amber-400' : 'text-zinc-500')}>{totalWash}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setModal('stock')}
                        className="w-full h-10 rounded-xl bg-warehouse-500/15 border border-warehouse-500/30 text-warehouse-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-warehouse-500/25 transition-all"
                    >
                        <Plus size={14} /> Add More Inventory
                    </button>
                </div>

                {/* Inventory Sub-Profiles */}
                {product.inventory.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">📐 Inventory by Size</p>
                        {product.inventory.map(inv => (
                            <SizeCard key={inv.id} inv={inv} />
                        ))}
                    </div>
                )}

                {/* Product Details */}
                <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">📋 Product Details</p>
                    {product.description && (
                        <div>
                            <p className="text-[10px] text-zinc-500 mb-0.5">Description</p>
                            <p className="text-xs text-zinc-300">{product.description}</p>
                        </div>
                    )}
                    {product.occasion && product.occasion.length > 0 && (
                        <div>
                            <p className="text-[10px] text-zinc-500 mb-1">Occasion</p>
                            <div className="flex flex-wrap gap-1.5">
                                {product.occasion.map(o => (
                                    <span key={o} className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-surface-border text-zinc-400">{o}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-zinc-500">Gender</p><p className="text-zinc-200 capitalize">{product.gender}</p></div>
                        <div><p className="text-zinc-500">Category</p><p className="text-zinc-200 capitalize">{product.category}</p></div>
                        <div><p className="text-zinc-500">Brand</p><p className="text-zinc-200">{product.brand || '—'}</p></div>
                        <div><p className="text-zinc-500">Added</p><p className="text-zinc-200">{new Date(product.created_at).toLocaleDateString('en-IN')}</p></div>
                    </div>
                </div>

                {/* Discounts */}
                <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">🏷️ Discounts</p>
                        <button
                            onClick={() => setModal('discount')}
                            className="flex items-center gap-1 text-xs text-warehouse-400 font-semibold hover:text-warehouse-300"
                        >
                            <Plus size={12} /> Add
                        </button>
                    </div>

                    {product.discounts.length === 0 ? (
                        <div className="text-center py-4">
                            <Tag size={24} className="mx-auto text-zinc-700 mb-1" />
                            <p className="text-xs text-zinc-600">No discounts configured</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {product.discounts.map(d => {
                                const expired = d.expires_at && new Date(d.expires_at) < new Date();
                                return (
                                    <div key={d.id} className={clsx(
                                        'flex items-center gap-3 p-3 rounded-xl border',
                                        d.is_active && !expired
                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                            : 'bg-surface border-surface-border opacity-60'
                                    )}>
                                        <div className={clsx(
                                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                            d.discount_type === 'percentage' ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-400'
                                        )}>
                                            {d.discount_type === 'percentage' ? <Percent size={14} /> : <DollarSign size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white">
                                                {d.discount_type === 'percentage' ? `${d.discount_value}% off` : `₹${d.discount_value} off`}
                                            </p>
                                            {d.expires_at && (
                                                <p className={clsx('text-[10px] flex items-center gap-1', expired ? 'text-red-400' : 'text-zinc-500')}>
                                                    <Calendar size={9} />
                                                    {expired ? 'Expired' : 'Expires'} {new Date(d.expires_at).toLocaleDateString('en-IN')}
                                                </p>
                                            )}
                                        </div>
                                        {expired ? (
                                            <span className="text-[10px] text-red-400 font-bold">EXPIRED</span>
                                        ) : (
                                            <button onClick={() => handleToggleDiscount(d.id, d.is_active)} className="shrink-0 text-zinc-500 hover:text-warehouse-400 transition-colors">
                                                {d.is_active ? <ToggleRight size={22} className="text-emerald-400" /> : <ToggleLeft size={22} />}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {modal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setModal(null)}
                    >
                        <motion.div
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 60, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 380 }}
                            className="w-full max-w-[430px] bg-surface-card border-t border-surface-border rounded-t-3xl p-5 space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-white">
                                    {modal === 'stock' ? '📦 Add Inventory' : '🏷️ Add Discount'}
                                </h2>
                                <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
                            </div>

                            {modal === 'stock' && (
                                <AddStockModal
                                    productId={product.id}
                                    existingInventory={product.inventory}
                                    onClose={() => setModal(null)}
                                    onDone={() => { setModal(null); load(); }}
                                    actorId={user?.id || 'anonymous'}
                                />
                            )}
                            {modal === 'discount' && (
                                <AddDiscountModal
                                    productId={product.id}
                                    onClose={() => setModal(null)}
                                    onDone={() => { setModal(null); load(); }}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
