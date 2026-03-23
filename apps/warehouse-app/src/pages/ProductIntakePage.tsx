import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, CheckCircle, Camera, X, Loader, QrCode, Download, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '@popclozet/api-client';
import { useToast } from '../contexts/ToastContext';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const GENDERS = ['men', 'women', 'unisex'];
const PRINT_STYLES = `
@media print {
    body * { visibility: hidden; margin: 0; padding: 0; }
    #qr-print-area, #qr-print-area * { visibility: visible; }
    #qr-print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 0;
    }
    .qr-print-card {
        page-break-after: always;
        break-after: page;
        height: 100vh;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        border: none !important;
        background: white !important;
    }
    .qr-print-card p { color: black !important; }
    .qr-id-text { border-top: 1px solid #eee !important; padding-top: 8px !important; margin-top: 8px !important; }
    .no-print { display: none !important; }
}
`;

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
            console.error('Storage upload failed:', error);
            throw error;
        }

        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
        return data.publicUrl;
    } catch {
        return null;
    }
}

/**
 * Common Label Printer Utility (Standardizes QR across pages)
 */
export async function generateQrLabelPdf(individualId: string, options: { brand?: string; size?: string } = {}) {
    const { jsPDF } = await import('jspdf');
    // Square label (100x100mm)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 100] });

    // 1. Get High-Res QR Data
    const canvas = document.getElementById(`qr-highres-${individualId}`) as HTMLCanvasElement;
    if (canvas) {
        const qrData = canvas.toDataURL('image/png');
        // Stretch QR to cover most of the page (keeping 10mm margins for a large quiet zone)
        doc.addImage(qrData, 'PNG', 10, 10, 80, 80);
    } else {
        throw new Error('QR Renderer not ready. Please try again.');
    }

    doc.save(`Label-${individualId}.pdf`);
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
    const [rentalPrice1d, setRentalPrice1d] = useState('');
    const [rentalPrice2d, setRentalPrice2d] = useState('');
    const [rentalPrice3d, setRentalPrice3d] = useState('');
    const [buyPrice, setBuyPrice] = useState('');
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [previews, setPreviews] = useState<{ id: string; url: string; uploading: boolean }[]>([]);
    const [dbCategories, setDbCategories] = useState<string[]>([]);
    const [categoryConfigs, setCategoryConfigs] = useState<Record<string, string[]>>({});
    const [customCategory, setCustomCategory] = useState('');
    const [customSizes, setCustomSizes] = useState('');
    const [isCustomCat, setIsCustomCat] = useState(false);
    const [sizes, setSizes] = useState<SizeQty[]>([]);

    const toggleSize = (size: string) => {
        setSizes(prev => prev.map(s =>
            s.size === size ? { ...s, selected: !s.selected, qty: s.selected ? 0 : 1 } : s
        ));
    };

    const fetchCategoryConfigs = async () => {
        const { data } = await supabase.from('category_configs').select('*');
        if (data) {
            const configMap = data.reduce((acc, curr) => ({ 
                ...acc, 
                [curr.category]: curr.sizes 
            }), {});
            setCategoryConfigs(configMap);
            setDbCategories(Object.keys(configMap).sort());

            // Default initial sizes if no category selected
            if (!category) {
                setSizes(SIZES.map(s => ({ size: s, qty: 0, selected: false })));
            }
        }
    };

    useEffect(() => {
        fetchCategoryConfigs();
    }, []);

    // Update size chart when category changes
    useEffect(() => {
        if (!isCustomCat && category && categoryConfigs[category]) {
            setSizes(categoryConfigs[category].map(s => ({ 
                size: s, 
                qty: 0, 
                selected: false 
            })));
        } else if (isCustomCat) {
            // Live update sizes from customSizes input
            const sArr = customSizes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            if (sArr.length > 0) {
                setSizes(sArr.map(s => ({ size: s, qty: 0, selected: false })));
            } else {
                setSizes([]);
            }
        }
    }, [category, categoryConfigs, isCustomCat, customSizes]);

    const updateQty = (size: string, qty: number) => {
        setSizes(prev => prev.map(s =>
            s.size === size ? { ...s, qty: Math.max(0, qty) } : s
        ));
    };

    const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // 1. Add to previews with uploading state
        const newPreviews = files.map(file => ({
            id: Math.random().toString(36).slice(2, 9),
            url: URL.createObjectURL(file),
            uploading: true
        }));
        setPreviews(prev => [...prev, ...newPreviews]);

        // 2. Upload them in parallel
        files.forEach(async (file, idx) => {
            const previewId = newPreviews[idx].id;
            try {
                const url = await uploadImage(file);
                if (url) {
                    setImageUrls(prev => [...prev, url]);
                    setPreviews(prev => prev.map(p => p.id === previewId ? { ...p, uploading: false, url } : p));
                }
            } catch (err: any) {
                showToast(`Failed to upload ${file.name}`, 'error');
                setPreviews(prev => prev.filter(p => p.id !== previewId));
            }
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (id: string, url: string) => {
        setPreviews(prev => prev.filter(p => p.id !== id));
        setImageUrls(prev => prev.filter(u => u !== url));
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
        const finalCategory = isCustomCat ? customCategory.trim().toLowerCase() : category;
        const created: CreatedUnit[] = [];
        try {
            // 1. If custom category, save the config first
            if (isCustomCat) {
                const sizeArr = customSizes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                if (sizeArr.length === 0) throw new Error('Specify at least one size for the new category');
                
                const { error: configError } = await supabase
                    .from('category_configs')
                    .upsert({ category: finalCategory, sizes: sizeArr });
                
                if (configError) throw configError;
            }

            const productData: Record<string, any> = {
                name: name.trim(),
                brand: brand.trim() || 'Unknown',
                description: '',
                category: finalCategory || 'tops',
                gender,
                rental_price: parseFloat(rentalPrice3d) || 299,
                rental_price_1d: parseFloat(rentalPrice1d) || null,
                rental_price_2d: parseFloat(rentalPrice2d) || null,
                rental_price_3d: parseFloat(rentalPrice3d) || null,
                buy_price: parseFloat(buyPrice) || null,
                images: imageUrls,
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

    const handleDownloadPDF = async () => {
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Helper to convert image URL to Base64 for PDF
            const getBase64Image = async (url: string): Promise<string | null> => {
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } catch { return null; }
            };

            const productBase64 = imageUrls[0] ? await getBase64Image(imageUrls[0]) : null;

            successUnits.forEach((unit, index) => {
                if (index > 0) doc.addPage();

                // 1. BRAND & NAME HEADER
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(26);
                doc.setTextColor(0, 0, 0);
                doc.text(brand.toUpperCase() || 'POP CLOZET', 20, 25);
                
                doc.setFontSize(16);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                doc.text(name, 20, 33);

                // 2. PRODUCT IMAGE (Left Side)
                if (productBase64) {
                    // Maintain aspect ratio or force fit
                    doc.addImage(productBase64, 'JPEG', 20, 45, 85, 110);
                } else {
                    doc.setDrawColor(240, 240, 240);
                    doc.setFillColor(250, 250, 250);
                    doc.rect(20, 45, 85, 110, 'F');
                    doc.setFontSize(10);
                    doc.text('IMAGE NOT AVAILABLE', 62.5, 100, { align: 'center' });
                }

                // 3. QR CODE (Right Side)
                const canvas = document.querySelector(`canvas[data-id="${unit.id}"]`) as HTMLCanvasElement;
                if (canvas) {
                    const qrData = canvas.toDataURL('image/png');
                    doc.setDrawColor(240, 240, 240);
                    doc.rect(120, 45, 70, 70); // Frame for QR
                    doc.addImage(qrData, 'PNG', 125, 50, 60, 60);
                    
                    doc.setFont('courier', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(0, 0, 0);
                    doc.text(unit.id, 155, 122, { align: 'center' });
                }

                // 4. SPECIFICATION TABLE
                doc.setDrawColor(230);
                doc.line(20, 165, 190, 165); // Divider

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Unit Specifications', 20, 175);

                const specs = [
                    ['Unique ID', unit.id],
                    ['Size', unit.size],
                    ['Category', category.charAt(0).toUpperCase() + category.slice(1)],
                    ['Target Gender', gender.charAt(0).toUpperCase() + gender.slice(1)],
                    ['Rental (3D)', `Rs. ${rentalPrice3d}`],
                    ['Registration Date', new Date().toLocaleDateString()],
                ];

                doc.setFontSize(11);
                specs.forEach(([label, value], i) => {
                    const y = 188 + (i * 10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(80, 80, 80);
                    doc.text(label, 25, y);
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(0, 0, 0);
                    doc.text(String(value), 85, y);
                    
                    // Subtle row line
                    doc.setDrawColor(245, 245, 245);
                    doc.line(20, y + 3, 190, y + 3);
                });

                // Footer
                doc.setFontSize(9);
                doc.setTextColor(180, 180, 180);
                doc.text('Authenticated Warehouse Intake Document • PopClozet', 105, 285, { align: 'center' });
            });

            doc.save(`${name.replace(/\s+/g, '_')}_SpecSheet.pdf`);
            showToast('Spec Sheet Generated ✓');
        } catch (err) {
            console.error('PDF Error:', err);
            showToast('Failed to generate PDF', 'error');
        }
    };

    const handleReset = () => {
        setName('');
        setBrand('');
        setCategory('');
        setRentalPrice1d('');
        setRentalPrice2d('');
        setRentalPrice3d('');
        setBuyPrice('');
        setImageUrls([]);
        setPreviews([]);
        setCustomCategory('');
        setCustomSizes('');
        setIsCustomCat(false);
        setSuccessUnits([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSizes(SIZES.map(s => ({ size: s, qty: 0, selected: false })));
        
        // Refresh categories list immediately
        fetchCategoryConfigs();
    };

    if (successUnits.length > 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-8 space-y-6 text-center"
            >
                <style>{PRINT_STYLES}</style>
                <div className="no-print">
                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Intake Successful!</h1>
                        <p className="text-zinc-500 text-sm mt-1">Generated {successUnits.length} unique labels</p>
                    </div>
                </div>

                <div id="qr-print-area" className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto px-2">
                    {successUnits.map(unit => (
                        <div key={unit.id} className="qr-print-card bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col items-center gap-3">
                            <div className="bg-white p-3 rounded-xl shadow-lg">
                                <QRCodeCanvas 
                                    value={unit.id} 
                                    size={160} 
                                    level="H" 
                                    data-id={unit.id} // Added for PDF selector
                                />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-warehouse-400">{unit.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">Size: {unit.size}</p>
                                <p className="text-sm font-mono text-white qr-id-text">{unit.id}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 no-print">
                    <button
                        onClick={handleDownloadPDF}
                        className="w-full h-14 rounded-xl bg-warehouse-500 text-black font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-warehouse-500/20 active:scale-95 transition-transform"
                    >
                        <Download size={20} /> Download PDF Labels
                    </button>
                    <button
                        onClick={handleReset}
                        className="w-full h-12 rounded-xl bg-zinc-800 text-white font-bold flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} /> New Intake
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
                    >
                        Alternative: Browser Print
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
                {/* Images Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                            <Camera size={14} className="text-warehouse-400" />
                            Product Photos
                        </label>
                        <span className="text-[10px] text-zinc-500 font-mono">{previews.length} Files</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <AnimatePresence>
                            {previews.map((img) => (
                                <motion.div
                                    key={img.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="relative aspect-[3/4] rounded-xl overflow-hidden border border-surface-border bg-surface-card group"
                                >
                                    <img src={img.url} className={clsx("w-full h-full object-cover transition-opacity", img.uploading && "opacity-40")} />
                                    
                                    {img.uploading ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px]">
                                            <Loader size={20} className="animate-spin text-warehouse-400 mb-2" />
                                            <span className="text-[8px] text-white font-bold uppercase tracking-widest">Uploading</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => removeImage(img.id, img.url)}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Dropzone/Add Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-[3/4] rounded-xl border-2 border-dashed border-surface-border bg-surface/30 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-warehouse-500/30 hover:text-warehouse-400 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center group-hover:bg-warehouse-500/10 transition-colors">
                                <PlusCircle size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Add Photo</span>
                        </button>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImagePick}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
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
                            <select 
                                value={isCustomCat ? 'other' : category} 
                                onChange={(e) => {
                                    if (e.target.value === 'other') {
                                        setIsCustomCat(true);
                                        setCategory('');
                                    } else {
                                        setIsCustomCat(false);
                                        setCategory(e.target.value);
                                    }
                                }} 
                                className="input-field h-10 text-sm appearance-none"
                            >
                                <option value="">Select...</option>
                                {dbCategories.map(c => (
                                    <option key={c} value={c}>{c.toUpperCase()}</option>
                                ))}
                                <option value="other">+ ADD NEW...</option>
                            </select>
                        </div>
                    </div>

                    {isCustomCat && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3"
                        >
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Specify New Category *</label>
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    placeholder="e.g. Footwear"
                                    className="input-field h-10 text-sm border-warehouse-500/30 bg-warehouse-500/5"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Define Size Chart (comma separated) *</label>
                                <input
                                    type="text"
                                    value={customSizes}
                                    onChange={(e) => setCustomSizes(e.target.value)}
                                    placeholder="e.g. 7UK, 8UK, 9UK, 10UK"
                                    className="input-field h-10 text-sm border-warehouse-500/30 bg-warehouse-500/5"
                                />
                                <p className="text-[10px] text-zinc-500 mt-1">Typing here will instantly create the buttons below.</p>
                            </div>
                        </motion.div>
                    )}

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
                            <label className="text-xs text-zinc-400 mb-1 block">Rental 1D (₹)</label>
                            <input type="number" value={rentalPrice1d} onChange={(e) => setRentalPrice1d(e.target.value)} placeholder="199" className="input-field h-10 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Rental 2D (₹)</label>
                            <input type="number" value={rentalPrice2d} onChange={(e) => setRentalPrice2d(e.target.value)} placeholder="249" className="input-field h-10 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Rental 3D (₹) *</label>
                            <input type="number" value={rentalPrice3d} onChange={(e) => setRentalPrice3d(e.target.value)} placeholder="299" className="input-field h-10 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Buy Price (₹)</label>
                            <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="999" className="input-field h-10 text-sm" />
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
                                    <div key={s.size} className="no-print hidden">
                                        {/* Hidden high-res canvases for PDF generation */}
                                        {Array.from({ length: Math.max(1, s.qty) }).map((_, i) => {
                                            const id = `PC-PREVIEW-${s.size}-${i}`;
                                            return <QRCodeCanvas key={id} id={`qr-highres-${id}`} value={id} size={1024} level="H" includeMargin={true} marginSize={4} />;
                                        })}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={submitting || previews.some(p => p.uploading) || !name.trim()}
                className={clsx(
                    'w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                    submitting || previews.some(p => p.uploading) || !name.trim()
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-surface-border'
                        : 'bg-gradient-to-r from-warehouse-500 to-warehouse-600 text-white hover:opacity-90 shadow-lg shadow-warehouse-500/20'
                )}
            >
                {submitting ? (
                    <><Loader size={16} className="animate-spin" /> Adding Products...</>
                ) : previews.some(p => p.uploading) ? (
                    <><Loader size={16} className="animate-spin" /> Uploading Photos...</>
                ) : (
                    <><CheckCircle size={16} /> Complete Intake</>
                )}
            </button>
        </div>
    );
}
