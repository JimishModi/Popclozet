import { motion } from 'framer-motion';
import { Package, Droplets, ArrowUp, ArrowDown, X, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { sendUnitToWash, returnUnitFromWash } from '../services/washService';
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

    const handleAction = async (action: 'send' | 'return') => {
        setProcessing(true);
        try {
            const actorId = user?.id || 'anonymous';
            if (action === 'send') {
                if (item.status === 'washing') {
                    showToast('Item is already marked as washing', 'error');
                    return;
                }
                await sendUnitToWash(item.individual_id, actorId);
                showToast(`Item ${item.individual_id} sent to wash`);
            } else {
                if (item.status === 'available') {
                    showToast('Item is already marked as available', 'error');
                    return;
                }
                await returnUnitFromWash(item.individual_id, actorId);
                showToast(`Item ${item.individual_id} returned from wash`);
            }
            onActionComplete?.();
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Action failed', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const isWashing = item.status === 'washing';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden max-w-[90%] w-[400px]"
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
                    isWashing ? "bg-amber-500 text-black" : "bg-emerald-500 text-black"
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

                {isWashing && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-medium">
                        <AlertTriangle size={14} className="shrink-0" />
                        This item is currently in the wash cycle.
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={() => handleAction('send')}
                        disabled={processing || isWashing}
                        className={clsx(
                            "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all",
                            isWashing
                                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700"
                                : "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                        )}
                    >
                        <ArrowUp size={18} />
                        <span className="text-[10px] font-bold uppercase">Send to Wash</span>
                    </button>

                    <button
                        onClick={() => handleAction('return')}
                        disabled={processing || !isWashing}
                        className={clsx(
                            "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all",
                            !isWashing
                                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700"
                                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                        )}
                    >
                        <ArrowDown size={18} />
                        <span className="text-[10px] font-bold uppercase">Return</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
