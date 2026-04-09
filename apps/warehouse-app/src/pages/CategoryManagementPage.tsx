import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Plus, Camera, X, Loader, Save, ChevronRight, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { getAllCategoryConfigs, updateCategoryConfig, createCategoryConfig, uploadCategoryPhoto, type CategoryConfig } from '../services/categoryService';
import { useToast } from '../contexts/ToastContext';

export function CategoryManagementPage() {
    const { showToast } = useToast();
    const [configs, setConfigs] = useState<CategoryConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    
    // For creating new category
    const [isAdding, setIsAdding] = useState(false);
    const [newCat, setNewCat] = useState({ category: '', display_name: '', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const data = await getAllCategoryConfigs();
            setConfigs(data);
        } catch (err) {
            showToast('Failed to load categories', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, cat: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFor(cat);
        try {
            const url = await uploadCategoryPhoto(file, cat);
            if (url) {
                await updateCategoryConfig(cat, { image_url: url });
                setConfigs(prev => prev.map(c => c.category === cat ? { ...c, image_url: url } : c));
                showToast('Category photo updated');
            } else {
                throw new Error('Upload failed');
            }
        } catch (err) {
            showToast('Photo upload failed', 'error');
        } finally {
            setUploadingFor(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSaveConfig = async (config: CategoryConfig) => {
        setSaving(true);
        try {
            await updateCategoryConfig(config.category, { 
                display_name: config.display_name,
                sizes: config.sizes 
            });
            showToast('Category updated');
            setEditing(null);
        } catch (err) {
            showToast('Save failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCat.category.trim()) return showToast('Enter category key', 'error');
        setSaving(true);
        try {
            const config = { ...newCat, image_url: null };
            await createCategoryConfig(config);
            showToast('New category created');
            setIsAdding(false);
            setNewCat({ category: '', display_name: '', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] });
            loadData();
        } catch (err) {
            showToast('Creation failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <Loader className="animate-spin text-warehouse-500" />
            </div>
        );
    }

    return (
        <div className="px-4 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <LayoutGrid className="text-warehouse-400" size={24} />
                        Categories Management
                    </h1>
                    <p className="text-xs text-zinc-500">Manage collection photos & sizes</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="w-10 h-10 rounded-xl bg-warehouse-500 text-black flex items-center justify-center shadow-lg shadow-warehouse-500/20 active:scale-95 transition-transform"
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <AnimatePresence>
                    {isAdding && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-warehouse-500/5 border border-warehouse-500/30 rounded-2xl p-4 space-y-4 overflow-hidden"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-warehouse-400 uppercase tracking-widest">New Category</h2>
                                <button onClick={() => setIsAdding(false)} className="text-zinc-500"><X size={18} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Key (e.g. jackets)</label>
                                    <input 
                                        className="input-field h-10 text-sm" 
                                        placeholder="jackets"
                                        value={newCat.category}
                                        onChange={e => setNewCat(p => ({ ...p, category: e.target.value.toLowerCase() }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Display Name</label>
                                    <input 
                                        className="input-field h-10 text-sm" 
                                        placeholder="Jackets"
                                        value={newCat.display_name}
                                        onChange={e => setNewCat(p => ({ ...p, display_name: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleCreateCategory}
                                className="w-full py-3 bg-warehouse-500 text-black font-bold rounded-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader className="animate-spin" size={18} /> : 'Save Category'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {configs.map((config) => (
                    <div key={config.category} className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden group">
                        <div className="p-4 flex items-center gap-4">
                            {/* Category Thumbnail / Uploader */}
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface bg-center bg-cover border border-surface-border flex-shrink-0 group/img">
                                {config.image_url ? (
                                    <img src={config.image_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-zinc-800">
                                        <ImageIcon className="text-zinc-700" size={20} />
                                    </div>
                                )}
                                
                                <button 
                                    onClick={() => {
                                        setUploadingFor(config.category);
                                        fileInputRef.current?.click();
                                    }}
                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                >
                                    {uploadingFor === config.category ? <Loader className="animate-spin text-white" size={16} /> : <Camera className="text-white" size={16} />}
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-base font-bold text-white truncate">{config.display_name}</h3>
                                    <button 
                                        onClick={() => setEditing(editing === config.category ? null : config.category)}
                                        className="text-zinc-500 hover:text-warehouse-400"
                                    >
                                        <Settings size={18} />
                                    </button>
                                </div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Key: {config.category}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {config.sizes.slice(0, 4).map(s => (
                                        <span key={s} className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-surface-hover text-zinc-400 border border-surface-border">{s}</span>
                                    ))}
                                    {config.sizes.length > 4 && <span className="text-[8px] text-zinc-600">+{config.sizes.length - 4} more</span>}
                                </div>
                            </div>
                        </div>

                        {/* Edit Panel */}
                        <AnimatePresence>
                            {editing === config.category && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="px-4 pb-4 border-t border-surface-border mt-2 space-y-4 overflow-hidden pt-4"
                                >
                                    <div>
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Display Name</label>
                                        <input 
                                            className="input-field h-10 text-sm" 
                                            value={config.display_name}
                                            onChange={e => setConfigs(prev => prev.map(c => c.category === config.category ? { ...c, display_name: e.target.value } : c))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Sizes (comma separated)</label>
                                        <input 
                                            className="input-field h-10 text-sm" 
                                            value={config.sizes.join(', ')}
                                            onChange={e => setConfigs(prev => prev.map(c => c.category === config.category ? { ...c, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : c))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleSaveConfig(config)}
                                        disabled={saving}
                                        className="w-full h-12 rounded-xl bg-warehouse-500 text-black font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                    >
                                        {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                                        Save Changes
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Hidden Photo Uploader */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={e => {
                    if (uploadingFor) handlePhotoUpload(e, uploadingFor);
                }}
            />
        </div>
    );
}
