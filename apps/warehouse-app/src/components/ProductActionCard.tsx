import { motion } from 'framer-motion';
import { Package, CheckCircle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '@popclozet/api-client';
import { useToast } from '../contexts/ToastContext';
import { useState } from 'react';
import { useAuth } from '@popclozet/auth';

interface ProductActionCardProps {
    item: any;
    onClose: () => void;
    onActionComplete?: () => void;
}

export function ProductActionCard({ item, onClose, onActionComplete }: ProductActionCardProps) {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [processing, setProcessing] = useState(false);

    const handleMarkAvailable = async () => {
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('all_products')
                .update({ status: 'available', available: true })
                .eq('individual_id', item.individual_id);
            if (error) throw error;
            showToast(`Item ${item.individual_id} marked as available ✓`);
            onActionComplete?.();
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Action failed', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const statusColor = item.status === 'available'
        ? 'bg-emerald-500 text-black'
        : item.status === 'rented'
        ? 'bg-blue-500 text-white'
        : 'bg-red-500 text-white';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden w-[90vw] max-w-[400px]"
        >
            <div className="relative h-48 bg-surface">
                {item.inventory?.products?.images?.[0] ? (
                    <img src={item.inventory.products.images[0]} alt="" className="w-full h-full object-contain p-4" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Package size={48} />
                    </div>
                )}
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors">
                    <X size={16} />
                </button>
                <div className={clsx(
                    "absolute bottom-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                    statusColor
                )}>
                    {item.status}
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div>
                    <h3 className="text-white font-bold leading-tight">{item.inventory?.products?.name || 'Unknown Item'}</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">{item.inventory?.products?.brand} • Size: {item.inventory?.size}</p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-2">ID: {item.individual_id}</p>
                </div>

                {item.status !== 'available' && (
                    <button
                        onClick={handleMarkAvailable}
                        disabled={processing}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all font-bold text-sm disabled:opacity-50"
                    >
                        <CheckCircle size={16} />
                        Mark as Available
                    </button>
                )}

                {item.status === 'available' && (
                    <div className="px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium text-center">
                        ✓ Item is available in inventory
                    </div>
                )}
            </div>
        </motion.div>
    );
}
