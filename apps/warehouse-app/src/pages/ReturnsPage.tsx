import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@popclozet/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RotateCcw,
    Inbox,
    RefreshCw,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ScanLine,
    Droplets,
    PackageCheck,
    KeyRound,
    X,
} from 'lucide-react';
import { clsx } from 'clsx';

import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import {
    approveReturn,
    getReturnRequests,
    receiveReturnAtWarehouse,
} from '../services/fulfillmentService';
import { sendUnitToWash, returnUnitFromWash } from '../services/washService';

type ReturnRequestRow = any;

const STATUS_BADGES: Record<string, string> = {
    requested: 'bg-orange-500/15 text-orange-400',
    approved: 'bg-blue-500/15 text-blue-400',
    dispatched: 'bg-indigo-500/15 text-indigo-400',
    picked_up: 'bg-violet-500/15 text-violet-400',
    completed: 'bg-emerald-500/15 text-emerald-400',
    rejected: 'bg-red-500/15 text-red-400',
};

export function ReturnsPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [requests, setRequests] = useState<ReturnRequestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingKey, setProcessingKey] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [otpModalOrderId, setOtpModalOrderId] = useState<string | null>(null);
    const [otpValue, setOtpValue] = useState('');
    const [otpVerifying, setOtpVerifying] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const data = await getReturnRequests();
            setRequests(data);
        } catch (error) {
            console.error('Failed to load return requests:', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useRealtimeOrders({ onChange: loadData });

    const pendingCount = useMemo(
        () => requests.filter((request) => request.status !== 'completed').length,
        [requests],
    );

    const withActiveFlow = useMemo(
        () => requests.filter((request) => request.orders?.status !== 'return_completed'),
        [requests],
    );

    const handleApprove = async (requestId: string) => {
        if (!user?.id) return;
        setProcessingKey(`approve:${requestId}`);
        try {
            await approveReturn(requestId, user.id);
            showToast('Return request approved');
            await loadData();
        } catch (error: any) {
            console.error('approveReturn failed:', error);
            showToast(error?.message || 'Failed to approve return', 'error');
        } finally {
            setProcessingKey(null);
        }
    };

    const handleReceive = async (orderId: string) => {
        if (!user?.id) return;
        if (!otpValue || otpValue.length !== 6) {
            showToast('Please enter the 6-digit OTP from the rider', 'error');
            return;
        }
        setOtpVerifying(true);
        setProcessingKey(`receive:${orderId}`);
        try {
            await receiveReturnAtWarehouse(orderId, user.id, otpValue);
            showToast('Return received at warehouse');
            setOtpModalOrderId(null);
            setOtpValue('');
            await loadData();
        } catch (error: any) {
            console.error('receiveReturnAtWarehouse failed:', error);
            showToast(error?.message || 'Failed to receive return', 'error');
        } finally {
            setProcessingKey(null);
            setOtpVerifying(false);
        }
    };

    const handleUnitAction = async (individualId: string, currentStatus: string) => {
        if (!user?.id) return;
        const actionKey = `unit:${individualId}`;
        setProcessingKey(actionKey);
        try {
            if (currentStatus === 'washing') {
                await returnUnitFromWash(individualId, user.id);
                showToast(`Unit ${individualId} marked available`);
            } else {
                await sendUnitToWash(individualId, user.id);
                showToast(`Unit ${individualId} moved to washing`);
            }
            await loadData();
        } catch (error: any) {
            console.error('Unit wash action failed:', error);
            showToast(error?.message || 'Failed to update unit status', 'error');
        } finally {
            setProcessingKey(null);
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-5 space-y-4">
                <div className="h-8 w-48 bg-surface-card rounded-lg animate-pulse" />
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-surface-card rounded-xl h-28 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="px-4 py-5 space-y-4">
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <RotateCcw size={20} className="text-orange-400" /> Returns
                </h1>
                <p className="text-xs text-zinc-500">
                    {pendingCount} active return request{pendingCount === 1 ? '' : 's'}
                </p>
            </div>

            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {withActiveFlow.length === 0 ? (
                        <div className="text-center py-12">
                            <Inbox size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">No returns pending</p>
                        </div>
                    ) : (
                        withActiveFlow.map((request) => {
                            const order = request.orders;
                            const linkedUnits = order?.order_items?.filter((item: any) => item.individual_id) ?? [];
                            const expanded = expandedOrderId === order?.id;
                            const approveBusy = processingKey === `approve:${request.id}`;
                            const receiveBusy = processingKey === `receive:${order?.id}`;

                            return (
                                <motion.div
                                    key={request.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-surface-card border border-surface-border rounded-xl p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-zinc-500">
                                                    Order #{order?.id?.slice(0, 8)}
                                                </p>
                                                {request.reason === 'pre_scheduled' && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase tracking-wider">
                                                        Pre-scheduled
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-zinc-100 mt-1">
                                                ₹{order?.total_amount ?? 0} • {order?.order_items?.length ?? 0} item{(order?.order_items?.length ?? 0) === 1 ? '' : 's'}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                Pickup: {request.pickup_address?.full_address || 'Saved address'}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                Slot: {request.pickup_slot ? new Date(request.pickup_slot).toLocaleString() : 'Not set'}
                                            </p>
                                            {request.reason === 'pre_scheduled' && request.status === 'approved' && (
                                                <p className="text-[10px] text-purple-400/80 mt-1">
                                                    Auto-dispatch 60 min before pickup
                                                </p>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', STATUS_BADGES[request.status] || 'bg-zinc-800 text-zinc-400')}>
                                                {request.status?.replace(/_/g, ' ')}
                                            </span>
                                            <p className="text-[11px] text-zinc-500 mt-2">
                                                Order state: {order?.status?.replace(/_/g, ' ')}
                                            </p>
                                            {order?.rider_id && (
                                                <p className="text-[11px] text-zinc-500 mt-1">
                                                    Rider: {order.rider_id.slice(0, 8)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                                        {request.status === 'requested' && (
                                            <button
                                                disabled={approveBusy}
                                                onClick={() => handleApprove(request.id)}
                                                className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-all disabled:opacity-60"
                                            >
                                                {approveBusy ? <RefreshCw size={12} className="animate-spin" /> : <><CheckCircle2 size={12} /> Approve Request</>}
                                            </button>
                                        )}

                                        {order?.status === 'return_at_warehouse' && (
                                            <button
                                                disabled={receiveBusy}
                                                onClick={() => {
                                                    setOtpValue('');
                                                    setOtpModalOrderId(order.id);
                                                }}
                                                className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-60"
                                            >
                                                {receiveBusy ? <RefreshCw size={12} className="animate-spin" /> : <><PackageCheck size={12} /> Receive Return</>}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setExpandedOrderId(expanded ? null : order?.id ?? null)}
                                            className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all"
                                        >
                                            <ScanLine size={12} />
                                            {expanded ? 'Hide Linked Units' : 'Open Linked Units'}
                                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                    </div>

                                    {expanded && (
                                        <div className="mt-4 pt-4 border-t border-surface-border space-y-2">
                                            {linkedUnits.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">
                                                    No linked physical units yet. Pack the outbound order with assigned units before using the return wash workflow.
                                                </div>
                                            ) : (
                                                linkedUnits.map((item: any) => {
                                                    const unit = item.unit;
                                                    const unitStatus = unit?.status || 'unknown';
                                                    const unitActionBusy = processingKey === `unit:${item.individual_id}`;
                                                    const canWash = order?.status === 'returned' && ['rented', 'washing'].includes(unitStatus);

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-sm font-medium text-white">
                                                                        {item.product?.name || `Product ${item.product_id?.slice?.(0, 8)}`}
                                                                    </p>
                                                                    <p className="text-xs text-zinc-500 mt-1">
                                                                        Unit: {item.individual_id}
                                                                    </p>
                                                                    <p className="text-xs text-zinc-500 mt-1">
                                                                        Size: {item.size || unit?.inventory?.size || 'N/A'}
                                                                    </p>
                                                                </div>

                                                                <div className="text-right">
                                                                    <span className={clsx(
                                                                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                                                        unitStatus === 'available' && 'bg-emerald-500/15 text-emerald-400',
                                                                        unitStatus === 'washing' && 'bg-cyan-500/15 text-cyan-400',
                                                                        unitStatus === 'rented' && 'bg-amber-500/15 text-amber-400',
                                                                        !['available', 'washing', 'rented'].includes(unitStatus) && 'bg-zinc-800 text-zinc-400',
                                                                    )}>
                                                                        {unitStatus}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {canWash && (
                                                                <button
                                                                    disabled={unitActionBusy}
                                                                    onClick={() => handleUnitAction(item.individual_id, unitStatus)}
                                                                    className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition-all disabled:opacity-60"
                                                                >
                                                                    {unitActionBusy ? <RefreshCw size={12} className="animate-spin" /> : <Droplets size={12} />}
                                                                    {unitStatus === 'washing' ? 'Mark Available Again' : 'Send To Wash'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>

        {/* OTP Verification Modal */}
        <AnimatePresence>
            {otpModalOrderId && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <KeyRound size={18} className="text-emerald-400" />
                                Verify Return OTP
                            </h3>
                            <button
                                onClick={() => { if (!otpVerifying) { setOtpModalOrderId(null); setOtpValue(''); } }}
                                disabled={otpVerifying}
                                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5 text-center">
                            <p className="text-sm text-zinc-400">
                                Enter the 6-digit OTP shown on the rider's screen to confirm receipt of the return.
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={6}
                                value={otpValue}
                                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                                placeholder="000000"
                                className="w-full text-center text-4xl font-mono font-bold tracking-[0.2em] bg-black border border-zinc-800 rounded-xl py-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-800"
                            />
                            <button
                                onClick={() => handleReceive(otpModalOrderId)}
                                disabled={otpValue.length !== 6 || otpVerifying}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {otpVerifying ? (
                                    <><RefreshCw size={16} className="animate-spin" /> Verifying...</>
                                ) : (
                                    'Verify & Receive'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
    );
}
