import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, CheckCircle, Camera, X, Loader, QrCode, Download, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@popclozet/api-client';
import { useToast } from '../contexts/ToastContext';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Ethnic', 'Accessories'];
const GENDERS = ['men', 'women', 'unisex'];

interface SizeQty {
    size: string;
    qty: number;
    selected: boolean;
}

interface CreatedUnit {
    id: string;
    size: string;
    name: string;
}

/**
 * Upload image to Supabase Storage → public URL.
 */
async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `items/${fileName}`;

    try {
        const { error } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.warn('Storage upload failed:', error.message);
            return null;
        }

        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
        return data.publicUrl;
    } catch {
        return null;
    }
}

export function ProductIntakePage() {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [successUnits, setSuccessUnits] = useState<CreatedUnit[]>([]);

    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState('');
    const [gender, setGender] = useState('women');
    const [rentalPrice, setRentalPrice] = useState('');
    const [deposit, setDeposit] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [sizes, setSizes] = useState<SizeQty[]>(
        SIZES.map(s => ({ size: s, qty: 0, selected: false }))
    );

    const toggleSize = (size: string) => {
        setSizes(prev => prev.map(s =>
            s.size === size ? { ...s, selected: !s.selected, qty: s.selected ? 0 : 1 } : s
        ));
    };

    const updateQty = (size: string, qty: number) => {
        setSizes(prev => prev.map(s =>
            s.size === size ? { ...s, qty: Math.max(0, qty) } : s
        ));
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5 MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);

        setUploading(true);
        const url = await uploadImage(file);
        if (url) {
            setImageUrl(url);
            showToast('Image uploaded ✓');
        } else {
            showToast('Storage not configured', 'error');
        }
        setUploading(false);
    };

    const removeImage = () => {
        setImageUrl('');
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            showToast('Enter product name', 'error');
            return;
        }

        const selectedSizes = sizes.filter(s => s.selected && s.qty > 0);
        if (selectedSizes.length === 0) {
            showToast('Add at least one size with quantity', 'error');
            return;
        }

        setSubmitting(true);
        const created: CreatedUnit[] = [];
        try {
            const productData: Record<string, any> = {
                name: name.trim(),
                brand: brand.trim() || 'Unknown',
                description: '',
                category: category || 'tops',
                gender,
                rental_price: parseFloat(rentalPrice) || 299,
                deposit_amount: parseFloat(deposit) || 500,
                images: imageUrl ? [imageUrl] : [],
                is_available: true,
            };

            const { data: product, error: insertError } = await supabase
                .from('products')
                .insert(productData)
                .select('id')
                .single();

            if (insertError) throw insertError;

            // Create inventory rows + Individual Items (all_products)
            if (product) {
                for (const s of selectedSizes) {
                    // 1. Create/Update inventory row
                    const { data: inv, error: invError } = await supabase
                        .from('inventory')
                        .upsert({
                            product_id: product.id,
                            size: s.size,
                            total_stock: 0, // Trigger will help manage this
                            available_stock: 0,
                            went_for_wash: 0,
                        }, { onConflict: 'product_id,size' })
                        .select('id')
                        .single();

                    if (invError) throw invError;

                    // 2. Create individual units
                    for (let i = 0; i < s.qty; i++) {
                        const individualId = `PC-${product.id.split('-')[0].toUpperCase()}-${s.size}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
                        const { error: unitError } = await supabase
                            .from('all_products')
                            .insert({
                                individual_id: individualId,
                                inventory_id: inv.id,
                                status: 'available',
                                available: true
                            });

                        if (unitError) throw unitError;
                        created.push({ id: individualId, size: s.size, name: name.trim() });
                    }
                }
            }

            setSuccessUnits(created);
            showToast(`Registered "${name}" with ${created.length} individual items`);
        } catch (err: any) {
            console.error('Intake error:', err);
            showToast(err.message || 'Failed to add product', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setName('');
        setBrand('');
        setCategory('');
        setRentalPrice('');
        setDeposit('');
        setImageUrl('');
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSizes(SIZES.map(s => ({ size: s, qty: 0, selected: false })));
        setSuccessUnits([]);
    };

    if (successUnits.length > 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-8 space-y-6 text-center"
            >
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={40} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Intake Successful!</h1>
                    <p className="text-zinc-500 text-sm mt-1">Generated {successUnits.length} unique labels</p>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto px-2">
                    {successUnits.map(unit => (
                        <div key={unit.id} className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col items-center gap-3">
                            <div className="bg-white p-3 rounded-xl shadow-lg">
                                <QRCodeSVG value={unit.id} size={120} level="H" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-warehouse-400">{unit.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">Size: {unit.size}</p>
                                <p className="text-sm font-mono text-white mt-1 border-t border-zinc-800 pt-1">{unit.id}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => window.print()}
                        className="flex-1 h-12 rounded-xl bg-zinc-800 text-white font-bold flex items-center justify-center gap-2"
                    >
                        <Download size={18} /> Print All
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex-1 h-12 rounded-xl bg-warehouse-500 text-black font-bold flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} /> New Intake
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-5">
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <PlusCircle size={20} className="text-warehouse-400" /> Product Intake
                </h1>
                <p className="text-xs text-zinc-500">Register new items & generate QR labels</p>
            </div>

            <div className="space-y-4">
                {/* Image Upload */}
                <div>
                    <label className="text-xs text-zinc-400 mb-1.5 block">Product Image</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImagePick}
                        className="hidden"
                    />

                    {imagePreview || imageUrl ? (
                        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-card border border-surface-border">
                            <img
                                src={imagePreview || imageUrl}
                                alt="Product preview"
                                className="w-full h-full object-cover"
                            />
                            {uploading && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Loader size={24} className="text-warehouse-400 animate-spin" />
                                    <span className="ml-2 text-xs text-white">Uploading…</span>
                                </div>
                            )}
                            <button
                                onClick={removeImage}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-surface-border hover:border-warehouse-500/40 bg-surface-card flex flex-col items-center justify-center gap-2 transition-all group"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-warehouse-500/10 flex items-center justify-center group-hover:bg-warehouse-500/20 transition-all">
                                <Camera size={24} className="text-warehouse-400" />
                            </div>
                            <span className="text-xs text-zinc-400 font-medium">Tap to upload photo</span>
                            <span className="text-[10px] text-zinc-600">JPG, PNG, WebP • Max 5 MB</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="text-xs text-zinc-400 mb-1 block">Product Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Navy Wool Blazer"
                            className="input-field h-10 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Brand</label>
                            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Zara" className="input-field h-10 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field h-10 text-sm appearance-none">
                                <option value="">Select...</option>
                                {CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Gender</label>
                        <div className="flex gap-2">
                            {GENDERS.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGender(g)}
                                    className={clsx(
                                        'flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all',
                                        gender === g
                                            ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30'
                                            : 'bg-surface-card text-zinc-500 border border-surface-border'
                                    )}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Rental ₹/day</label>
                            <input type="number" value={rentalPrice} onChange={(e) => setRentalPrice(e.target.value)} placeholder="299" className="input-field h-10 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Deposit ₹</label>
                            <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="500" className="input-field h-10 text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 mb-2 block">Sizes & Quantities</label>
                        <div className="space-y-2">
                            {sizes.map(s => (
                                <motion.div
                                    key={s.size}
                                    layout
                                    className={clsx(
                                        'flex items-center gap-3 p-3 rounded-xl border transition-all',
                                        s.selected
                                            ? 'bg-warehouse-500/5 border-warehouse-500/30'
                                            : 'bg-surface-card border-surface-border'
                                    )}
                                >
                                    <button
                                        onClick={() => toggleSize(s.size)}
                                        className={clsx(
                                            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all shrink-0',
                                            s.selected
                                                ? 'bg-warehouse-500 text-white'
                                                : 'bg-surface-hover text-zinc-500'
                                        )}
                                    >
                                        {s.size}
                                    </button>
                                    <span className="text-sm text-zinc-300 flex-1">{s.size}</span>
                                    {s.selected && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQty(s.size, s.qty - 1)}
                                                className="w-7 h-7 rounded-lg bg-surface text-zinc-300 flex items-center justify-center text-sm font-bold"
                                            >−</button>
                                            <span className="w-8 text-center text-sm font-mono text-white">{s.qty}</span>
                                            <button
                                                onClick={() => updateQty(s.size, s.qty + 1)}
                                                className="w-7 h-7 rounded-lg bg-warehouse-500/20 text-warehouse-300 flex items-center justify-center text-sm font-bold"
                                            >+</button>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
                className={clsx(
                    'w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                    submitting || !name.trim()
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-warehouse-500 to-warehouse-600 text-white hover:opacity-90 shadow-lg shadow-warehouse-500/20'
                )}
            >
                {submitting ? (
                    <><Loader size={16} className="animate-spin" /> Adding Products...</>
                ) : (
                    <><CheckCircle size={16} /> Complete Intake</>
                )}
            </button>
        </div>
    );
}
