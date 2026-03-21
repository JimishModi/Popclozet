/**
 * Product Profile Page
 * Full product details with inventory sub-profiles per size.
 * Workers can: view all info, add stock to existing size, add a new size, manage discounts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Package, Edit2, Plus, ChevronDown, ChevronRight, ChevronLeft,
    Tag, Percent, DollarSign, Calendar, Check, X, Loader,
    QrCode, Droplets, AlertTriangle, ToggleLeft, ToggleRight,
    Camera, Save, Trash2
} from 'lucide-react';
import { clsx } from 'clsx';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '@popclozet/auth';
import { useToast } from '../contexts/ToastContext';
import {
    getFullProductProfile,
    addStockToInventory,
    addNewSizeToProduct,
    saveProductDiscount,
    toggleDiscount,
    updateProductProfile,
    archivePhysicalUnit,
    type FullProductProfile,
    type InventorySubProfile,
    type ProductUpdate,
} from '../services/productProfileService';
import { supabase } from '@popclozet/api-client';

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const GENDERS = ['men', 'women', 'unisex'];

/* -----------------------------------------------------------
   Add Stock Modal (for existing size OR new size)
   ----------------------------------------------------------- */
function AddStockModal({
    productId,
    category,
    existingInventory,
    onClose,
    onDone,
    actorId,
}: {
    productId: string;
    category: string;
    existingInventory: InventorySubProfile[];
    onClose: () => void;
    onDone: (newIds: string[]) => void;
    actorId: string;
}) {
    const { showToast } = useToast();
    const existingSizes = existingInventory.map(i => i.size);
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [selectedInventoryId, setSelectedInventoryId] = useState(existingInventory[0]?.id ?? '');
    const [dynamicSizes, setDynamicSizes] = useState<string[]>(DEFAULT_SIZES);
    const [newSize, setNewSize] = useState('');
    const [qty, setQty] = useState(1);
    const [mrp, setMrp] = useState('');
    const [cost, setCost] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [createdIds, setCreatedIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!category) return;
            const { data } = await supabase
                .from('category_configs')
                .select('sizes')
                .eq('category', category.toLowerCase())
                .single();
            if (data?.sizes) {
                setDynamicSizes(data.sizes);
            }
        };
        fetchConfig();
    }, [category]);

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
                            <div className="bg-white p-2 rounded-lg relative">
                                <QRCodeCanvas id={`qr-${id}`} value={id} size={96} level="H" includeMargin={true} marginSize={2} />
                                {/* Hidden high-res version for PDF extraction */}
                                <div className="absolute opacity-0 pointer-events-none overflow-hidden h-0 w-0">
                                    <QRCodeCanvas id={`qr-highres-${id}`} value={id} size={1024} level="H" includeMargin={true} marginSize={4} />
                                </div>
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
                        {dynamicSizes.filter(s => !existingSizes.includes(s)).map(s => (
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
                        {dynamicSizes.filter(s => !existingSizes.includes(s)).length === 0 && (
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
function SizeCard({ product, inv }: { product: FullProductProfile; inv: InventorySubProfile }) {
    const [open, setOpen] = useState(false);
    const { showToast } = useToast();
    const { user } = useAuth();

    const statusColor = (s: string) => ({
        available: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        washing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        rented: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        returned: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
        archived: 'text-red-400 bg-red-500/10 border-red-500/20',
    }[s] || 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20');

    const handleDownloadUnitLabel = async (unit: any, size: string) => {
        try {
            const { generateQrLabelPdf } = await import('./ProductIntakePage');
            await generateQrLabelPdf(unit.individual_id);
            showToast('Label generated ✓');
        } catch (err: any) {
            showToast(err.message || 'Failed to generate PDF', 'error');
        }
    };

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
                                    <div key={unit.individual_id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-surface-hover group">
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
                                        <div className="flex items-center gap-2">
                                            {unit.status !== 'archived' && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Archive unit ${unit.individual_id}?`)) {
                                                            try {
                                                                await archivePhysicalUnit(unit.individual_id, user?.id);
                                                                showToast('Unit archived');
                                                                // Reload data
                                                                window.location.reload(); // Simple refresh for now
                                                            } catch (err: any) {
                                                                showToast(err.message || 'Failed to archive', 'error');
                                                            }
                                                        }
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                                    title="Archive Unit"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDownloadUnitLabel(unit, inv.size)}
                                                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                                                title="Download Label"
                                            >
                                                <QrCode size={14} />
                                            </button>
                                            <div className="shrink-0 bg-white p-1 rounded relative">
                                                <QRCodeCanvas id={`qr-${unit.individual_id}`} value={unit.individual_id} size={36} level="H" includeMargin={true} marginSize={1} />
                                                {/* Hidden high-res version for PDF extraction */}
                                                <div className="absolute opacity-0 pointer-events-none overflow-hidden h-0 w-0">
                                                    <QRCodeCanvas id={`qr-highres-${unit.individual_id}`} value={unit.individual_id} size={1024} level="H" includeMargin={true} marginSize={4} />
                                                </div>
                                            </div>
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [product, setProduct] = useState<FullProductProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [dbCategories, setDbCategories] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [modal, setModal] = useState<'stock' | 'discount' | null>(null);

    const fetchCategoryConfigs = async () => {
        const { data } = await supabase.from('category_configs').select('category');
        if (data) {
            setDbCategories(data.map(d => d.category).sort());
        }
    };

    useEffect(() => {
        fetchCategoryConfigs();
    }, []);

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

    const handleStartEdit = () => {
        if (!product) return;
        setEditForm({
            name: product.name,
            brand: product.brand || '',
            category: product.category,
            gender: product.gender,
            rental_price: product.rental_price ?? 0,
            deposit_amount: product.deposit_amount ?? 0,
            images: [...(product.images || [])],
            is_available: product.is_available,
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!editForm || !product) return;
        setLoading(true);
        try {
            await updateProductProfile(product.id, editForm);
            showToast('Changes saved successfully');
            setIsEditing(false);
            load();
        } catch (err: any) {
            showToast(err.message || 'Failed to save', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !editForm) return;

        setIsUploading(true);
        try {
            const newUrls: string[] = [];
            for (const file of Array.from(files)) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `products/${fileName}`;

                const { data, error } = await supabase.storage
                    .from('product-images')
                    .upload(filePath, file);

                if (error) throw error;
                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(filePath);
                
                newUrls.push(publicUrl);
            }

            setEditForm({
                ...editForm,
                images: [...(editForm.images || []), ...newUrls],
            });
            showToast(`Uploaded ${newUrls.length} photo(s)`);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = (index: number) => {
        if (!editForm) return;
        const newImages = [...(editForm.images || [])];
        newImages.splice(index, 1);
        setEditForm({ ...editForm, images: newImages });
        if (currentImgIndex >= newImages.length) {
            setCurrentImgIndex(Math.max(0, newImages.length - 1));
        }
    };

    useEffect(() => { load(); }, [load]);

    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [currentImgIndex, setCurrentImgIndex] = useState(0);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<ProductUpdate | null>(null);

    const nextImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!product?.images) return;
        setCurrentImgIndex((prev) => (prev + 1) % product.images.length);
    }, [product]);

    const prevImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!product?.images) return;
        setCurrentImgIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    }, [product]);

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
                        {isEditing ? (
                            <input
                                value={editForm?.name ?? ''}
                                onChange={e => setEditForm(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                                className="w-full bg-surface border border-warehouse-500/30 rounded-lg px-2 py-1 text-base font-bold text-white focus:outline-none focus:border-warehouse-500"
                            />
                        ) : (
                            <h1 className="text-base font-bold text-white truncate">{product.name}</h1>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {isEditing ? (
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        value={editForm?.brand ?? ''}
                                        onChange={e => setEditForm(prev => prev ? ({ ...prev, brand: e.target.value }) : null)}
                                        placeholder="Brand"
                                        className="w-24 bg-surface border border-surface-border rounded px-1.5 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-warehouse-500"
                                    />
                                    <select
                                        value={editForm?.category ?? ''}
                                        onChange={e => setEditForm(prev => prev ? ({ ...prev, category: e.target.value }) : null)}
                                        className="w-24 bg-surface border border-surface-border rounded px-1.5 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-warehouse-500"
                                    >
                                        <option value="">Category</option>
                                        {dbCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={editForm?.gender ?? ''}
                                        onChange={e => setEditForm(prev => prev ? ({ ...prev, gender: e.target.value }) : null)}
                                        className="w-24 bg-surface border border-surface-border rounded px-1.5 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-warehouse-500"
                                    >
                                        {GENDERS.map(g => (
                                            <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <p className="text-[10px] text-zinc-500">{product.brand} · {product.category} · {product.gender}</p>
                            )}
                        </div>
                    </div>
                    {isEditing ? (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsEditing(false)} 
                                className="h-9 px-3 rounded-xl bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                className="h-9 px-4 rounded-xl bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-emerald-400 transition-colors"
                            >
                                <Save size={14} /> Save
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleStartEdit}
                            className="w-9 h-9 rounded-xl bg-warehouse-500/10 border border-warehouse-500/20 flex items-center justify-center text-warehouse-400 hover:bg-warehouse-500 hover:text-black transition-all"
                        >
                            <Edit2 size={16} />
                        </button>
                    )}
                </div>

                {/* Product Image Carousel */}
                {(isEditing ? editForm?.images : product.images) && (
                    <div className="relative group w-full aspect-[4/3] rounded-2xl overflow-hidden bg-surface-card border border-surface-border">
                        <div className="w-full h-full cursor-pointer" onClick={() => !isEditing && setIsLightboxOpen(true)}>
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={isEditing ? (editForm?.images?.[currentImgIndex] || 'empty') : product.images?.[currentImgIndex]}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    src={isEditing ? editForm?.images?.[currentImgIndex] : product.images?.[currentImgIndex]}
                                    alt="Product"
                                    className="w-full h-full object-contain p-4"
                                />
                            </AnimatePresence>
                        </div>

                        {/* Edit Mode Overlays */}
                        {isEditing && (
                            <div className="absolute inset-0 bg-black/5 pointer-events-none border-2 border-warehouse-500/20 rounded-2xl" />
                        )}

                        {isEditing && (
                            <div className="absolute top-4 left-4 flex gap-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="h-8 px-3 rounded-lg bg-warehouse-500 text-black text-[10px] font-bold uppercase flex items-center gap-2 shadow-lg disabled:opacity-50"
                                >
                                    {isUploading ? <Loader size={12} className="animate-spin" /> : <Camera size={14} />}
                                    Add Photo
                                </button>
                                {editForm?.images && editForm.images.length > 0 && (
                                    <button
                                        onClick={() => handleRemoveImage(currentImgIndex)}
                                        className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-lg"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAddImage}
                            multiple
                            accept="image/*"
                            className="hidden"
                        />

                        {/* Navigation Arrows */}
                        {(isEditing ? (editForm?.images?.length ?? 0) : product.images?.length) > 1 && (
                            <>
                                <button 
                                    onClick={prevImage}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button 
                                    onClick={nextImage}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                >
                                    <ChevronRight size={16} />
                                </button>

                                {/* Pagination Dots */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {(isEditing ? editForm?.images : product.images)?.map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={clsx(
                                                "w-1.5 h-1.5 rounded-full transition-all",
                                                i === currentImgIndex ? "bg-warehouse-400 w-3" : "bg-white/30"
                                            )} 
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="absolute top-4 right-4 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                            {currentImgIndex + 1} / {isEditing ? editForm?.images?.length : product.images.length}
                        </div>
                    </div>
                )}

                {/* Pricing Card */}
                <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">💰 Pricing</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface rounded-lg p-3">
                            <p className="text-[10px] text-zinc-500">Rental / day</p>
                            {isEditing ? (
                                <div className="mt-1 flex items-center gap-1.5 bg-surface-hover rounded px-2 py-1 border border-surface-border">
                                    <span className="text-zinc-500 text-xs">₹</span>
                                    <input
                                        type="number"
                                        value={editForm?.rental_price ?? 0}
                                        onChange={e => setEditForm(prev => prev ? ({ ...prev, rental_price: parseFloat(e.target.value) || 0 }) : null)}
                                        className="w-full bg-transparent text-sm font-bold text-white focus:outline-none"
                                    />
                                </div>
                            ) : (
                                <>
                                    <p className="text-base font-bold text-white">₹{product.rental_price?.toLocaleString() ?? '—'}</p>
                                    {discountedPrice !== null && (
                                        <p className="text-[10px] text-emerald-400 font-semibold">After discount: ₹{discountedPrice.toFixed(0)}</p>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="bg-surface rounded-lg p-3">
                            <p className="text-[10px] text-zinc-500">Deposit</p>
                            {isEditing ? (
                                <div className="mt-1 flex items-center gap-1.5 bg-surface-hover rounded px-2 py-1 border border-surface-border">
                                    <span className="text-zinc-500 text-xs">₹</span>
                                    <input
                                        type="number"
                                        value={editForm?.deposit_amount ?? 0}
                                        onChange={e => setEditForm(prev => prev ? ({ ...prev, deposit_amount: parseFloat(e.target.value) || 0 }) : null)}
                                        className="w-full bg-transparent text-sm font-bold text-white focus:outline-none"
                                    />
                                </div>
                            ) : (
                                <p className="text-base font-bold text-white">₹{product.deposit_amount?.toLocaleString() ?? '—'}</p>
                            )}
                        </div>
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
                            <SizeCard key={inv.id} product={product} inv={inv} />
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
                                    category={product.category || ''}
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
            {/* Image Lightbox */}
            <AnimatePresence>
                {isLightboxOpen && product.images && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
                        onClick={() => setIsLightboxOpen(false)}
                    >
                        <button className="absolute top-6 right-6 text-zinc-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>

                        <div className="relative w-full max-w-4xl h-full flex items-center justify-center pointer-events-none">
                            <motion.img
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                src={product.images[currentImgIndex]}
                                className="max-w-full max-h-full object-contain pointer-events-auto"
                            />
                            
                            {/* Lightbox Nav */}
                            {product.images.length > 1 && (
                                <>
                                    <button 
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-auto"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button 
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-auto"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="mt-6 text-sm font-bold text-zinc-500 uppercase tracking-widest">
                            {currentImgIndex + 1} of {product.images.length}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
