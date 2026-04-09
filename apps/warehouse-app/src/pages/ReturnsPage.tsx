import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
    PackageCheck,
    KeyRound,
    X,
    Clock,
    AlertTriangle,
    Zap,
    Truck,
    Navigation,
    Phone,
    Droplets,
    User
} from 'lucide-react';
import { supabase } from '@popclozet/api-client';
import { clsx } from 'clsx';

import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import {
    approveReturn,
    getReturnRequests,
    receiveReturnAtWarehouse,
    completeReturnFlow
} from '../services/fulfillmentService';
import { buildManualAddressSummary } from '../services/addressDetails';
import { sendUnitToWash } from '../services/washService';
import { markUnitAsSold, setUnitStatus } from '../services/productProfileService';

type ReturnRequestRow = any;

const STATUS_BADGES: Record<string, string> = {
    requested: 'bg-orange-500/15 text-orange-400',
    approved: 'bg-blue-500/15 text-blue-400',
    dispatched: 'bg-indigo-500/15 text-indigo-400',
    picked_up: 'bg-violet-500/15 text-violet-400',
    completed: 'bg-emerald-500/15 text-emerald-400',
    rejected: 'bg-red-500/15 text-red-400',
};

const getOrderStatus = (order: { status?: string | null; lifecycle_state?: string | null } | null | undefined) =>
    order?.status || order?.lifecycle_state || 'unknown';

const formatDateTime = (value?: string | null) =>
    value
        ? new Date(value).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
        })
        : 'Not set';

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
    const [riders, setRiders] = useState<{ user_id: string; full_name: string }[]>([]);
    const [selectedReturnRiders, setSelectedReturnRiders] = useState<Record<string, string>>({});
    const [assigningRider, setAssigningRider] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [data, ridersRes] = await Promise.all([
                getReturnRequests(),
                supabase.from('profiles').select('user_id, full_name').eq('role', 'rider'),
            ]);
            setRequests(data);
            if (ridersRes.data) {
                setRiders(ridersRes.data.map((r: any) => ({
                    user_id: r.user_id,
                    full_name: r.full_name || 'Rider',
                })));
            }
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
        () => requests.filter((request) => request.status === 'requested' && request.reason === 'immediate').length,
        [requests],
    );

    const withActiveFlow = useMemo(
        () => requests.filter((request) => getOrderStatus(request.orders) !== 'return_completed'),
        [requests],
    );

    const instantReturns = useMemo(
        () => withActiveFlow
            .filter((r) => r.reason === 'immediate')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        [withActiveFlow],
    );

    const scheduledReturns = useMemo(
        () => withActiveFlow
            .filter((r) => r.reason !== 'immediate')
            .sort((a, b) => {
                // Sort by pickup_slot (date) first
                const dateA = a.pickup_slot ? new Date(a.pickup_slot).getTime() : 0;
                const dateB = b.pickup_slot ? new Date(b.pickup_slot).getTime() : 0;
                if (dateA !== dateB) return dateA - dateB;
                // Then by request time (created_at)
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }),
        [withActiveFlow],
    );

    // Group scheduled returns by date for better navigation
    const groupedScheduledReturns = useMemo(() => {
        const groups: Record<string, any[]> = {};
        scheduledReturns.forEach((r) => {
            const dateStr = r.pickup_slot ? new Date(r.pickup_slot).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            }) : 'No Slot';
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(r);
        });
        return groups;
    }, [scheduledReturns]);

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

    const handleSendToWash = async (individualId: string, order: any, requestId: string, allUnits: any[]) => {
        if (!user?.id) return;
        const actionKey = `unit:${individualId}`;
        setProcessingKey(actionKey);
        try {
            await sendUnitToWash(individualId, user.id);
            showToast(`Unit ${individualId} sent to wash`);

            // Check if all units are now washing/sold/available
            // (Note: completeReturnFlow might need to be deferred until available, 
            // but for now we follow the user's lead on when the return flow is "processed")
            const allItemsProcessed = allUnits.every((item: any) => {
                if (item.individual_id === individualId) return true;
                const status = item.unit?.status;
                return ['washing', 'available', 'sold'].includes(status);
            });

            if (allItemsProcessed && order) {
                await completeReturnFlow(order.id, requestId);
                showToast('All units processed! Order completed and moved to History.');
            }
            await loadData();
        } catch (error: any) {
            showToast(error?.message || 'Failed to send to wash', 'error');
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

    const renderCard = (request: ReturnRequestRow) => {
        const order = request.orders;
        const orderStatus = getOrderStatus(order);
        const linkedUnits = order?.order_items?.filter((item: any) => item.individual_id) ?? [];
        const expanded = expandedOrderId === order?.id;
        const approveBusy = processingKey === `approve:${request.id}`;
        const receiveBusy = processingKey === `receive:${order?.id}`;
        const customerName = order?.customer_profile?.full_name || 'Customer';
        const customerPhone = order?.customer_profile?.phone;
        const fetchedAddress = order?.delivery_address_snapshot?.full_address || order?.addresses?.full_address || '';
        const manualAddressSummary = buildManualAddressSummary(order?.manual_address_details);
        const requestCreatedAt = formatDateTime(request.created_at);
        const pickupSlot = formatDateTime(request.pickup_slot);

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
                        <p className="text-xs text-zinc-500">Order #{order?.id?.slice(0, 8)}</p>
                        <p className="text-sm font-medium text-zinc-100 mt-1">
                            ₹{order?.total_amount ?? 0} • {order?.order_items?.length ?? 0} item{(order?.order_items?.length ?? 0) === 1 ? '' : 's'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                            Pickup: {request.pickup_address?.full_address || 'Saved address'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                            Slot: {pickupSlot}
                        </p>
                        <div className="flex gap-2 mt-2">
                           <span className={clsx(
                               'text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1',
                               request.reason === 'immediate' 
                               ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                               : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                           )}>
                                {request.reason === 'immediate' ? <Zap size={10} /> : <Clock size={10} />}
                                {request.reason === 'immediate' ? 'INSTANT' : 'SCHEDULED'}
                           </span>
                        </div>
                        {request.reason !== 'immediate' && request.status === 'approved' && (
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
                            Order state: {orderStatus.replace(/_/g, ' ')}
                        </p>
                        {order?.rider_id && (
                            <div className="mt-2 text-right flex flex-col items-end gap-1 border-t border-surface-border/50 pt-2">
                                <p className="text-[11px] font-medium text-zinc-300">
                                    {order.riders?.full_name || order.riders?.name || 'Assigned Rider'}
                                </p>
                                {order.riders?.phone && (
                                    <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                                        <Phone size={10} />
                                        <a href={`tel:${order.riders.phone}`} className="hover:text-purple-400 decoration-transparent underline hover:decoration-purple-400 transition-colors">{order.riders.phone}</a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <div className="rounded-lg border border-surface-border/70 bg-zinc-950/30 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Requested At</p>
                        <p className="text-xs text-zinc-200 mt-1">{requestCreatedAt}</p>
                    </div>

                    <div className="rounded-lg border border-surface-border/70 bg-zinc-950/30 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Customer</p>
                        <div className="mt-1 flex items-start gap-2 text-xs text-zinc-200">
                            <User size={12} className="mt-0.5 shrink-0 text-zinc-500" />
                            <div className="min-w-0">
                                <p className="truncate">{customerName}</p>
                                {customerPhone ? (
                                    <a
                                        href={`tel:${customerPhone}`}
                                        className="text-[11px] text-zinc-400 underline decoration-transparent hover:text-purple-400 hover:decoration-purple-400 transition-colors"
                                    >
                                        {customerPhone}
                                    </a>
                                ) : (
                                    <p className="text-[11px] text-zinc-500">Phone not available</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {order?.payment_method && (
                        <div className="rounded-lg border border-surface-border/70 bg-zinc-950/30 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Payment</p>
                            <span className={clsx(
                                'inline-flex mt-1 text-[10px] font-bold uppercase px-2 py-1 rounded border',
                                order.payment_method === 'cod'
                                    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            )}>
                                {order.payment_method === 'cod' ? 'COD' : 'PAID'}
                            </span>
                        </div>
                    )}

                    {fetchedAddress && (
                        <div className="rounded-lg border border-surface-border/70 bg-zinc-950/30 px-3 py-2 sm:col-span-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Fetched Address</p>
                            <p className="text-xs text-zinc-300 mt-1 line-clamp-2">{fetchedAddress}</p>
                        </div>
                    )}

                    {manualAddressSummary && (
                        <div className="rounded-lg border border-surface-border/70 bg-zinc-950/30 px-3 py-2 sm:col-span-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Manual Address</p>
                            <p className="text-xs text-zinc-200 mt-1 line-clamp-3">{manualAddressSummary}</p>
                            {(order?.manual_address_details?.contactName || order?.manual_address_details?.phoneNumber) && (
                                <p className="text-[11px] text-zinc-500 mt-1">
                                    {[order.manual_address_details?.contactName, order.manual_address_details?.phoneNumber].filter(Boolean).join(' • ')}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {orderStatus === 'return_scheduled' && !order?.rider_id && (
                    <div className="flex items-center justify-center gap-2 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <Zap size={14} className="text-amber-400 animate-pulse shrink-0" />
                        <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest text-center">
                            Broadcasting to Riders...
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    {['return_dispatched', 'return_picked_up'].includes(orderStatus) && (
                        <a
                            href={`/track/${order?.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all"
                        >
                            <Navigation size={12} /> Live Tracker
                        </a>
                    )}

                    {request.status === 'requested' && (
                        <button
                            disabled={approveBusy}
                            onClick={() => handleApprove(request.id)}
                            className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-all disabled:opacity-60"
                        >
                            {approveBusy ? <RefreshCw size={12} className="animate-spin" /> : <><CheckCircle2 size={12} /> Approve Request</>}
                        </button>
                    )}

                    {orderStatus === 'return_at_warehouse' && (
                        <button
                            disabled={receiveBusy}
                            onClick={() => { setOtpValue(''); setOtpModalOrderId(order.id); }}
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
                                No linked physical units yet.
                            </div>
                        ) : (
                            linkedUnits.map((item: any) => {
                                const unit = item.unit;
                                const unitStatus = unit?.status || 'unknown';
                                const unitActionBusy = processingKey === `unit:${item.individual_id}`;
                                const isReturned = orderStatus === 'returned';
                                const canMarkAvailable = isReturned && unitStatus === 'rented';
                                const canMarkSold = isReturned && unitStatus !== 'sold';

                                return (
                                    <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">
                                                    {item.product?.name || `Product ${item.product_id?.slice?.(0, 8)}`}
                                                </p>
                                                <p className="text-xs text-zinc-500 mt-1">Unit: {item.individual_id}</p>
                                                <p className="text-xs text-zinc-500 mt-1">Size: {item.size || unit?.inventory?.size || 'N/A'}</p>
                                            </div>
                                            <span className={clsx(
                                                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                                unitStatus === 'available' && 'bg-emerald-500/15 text-emerald-400',
                                                unitStatus === 'washing' && 'bg-amber-500/15 text-amber-400',
                                                unitStatus === 'rented' && 'bg-blue-500/15 text-blue-400',
                                                unitStatus === 'sold' && 'bg-red-500/15 text-red-400',
                                                !['available', 'washing', 'rented', 'sold'].includes(unitStatus) && 'bg-zinc-800 text-zinc-400',
                                            )}>
                                                {unitStatus}
                                            </span>
                                        </div>

                                        {(canMarkAvailable || canMarkSold) && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {unitStatus === 'rented' && isReturned && (
                                                    <button
                                                        disabled={unitActionBusy}
                                                        onClick={() => handleSendToWash(item.individual_id, order, request.id, linkedUnits)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/10 transition-all disabled:opacity-60"
                                                    >
                                                        {unitActionBusy ? <RefreshCw size={12} className="animate-spin" /> : <Droplets size={12} />}
                                                        Send to Wash
                                                    </button>
                                                )}
                                                {unitStatus === 'washing' && (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
                                                        <RefreshCw size={12} className="animate-spin" />
                                                        In Wash Cycle...
                                                    </div>
                                                )}
                                                {canMarkSold && (
                                                    <button
                                                        disabled={unitActionBusy}
                                                        onClick={async () => {
                                                            if (!user?.id) return;
                                                            setProcessingKey(`unit:${item.individual_id}`);
                                                            try {
                                                                await markUnitAsSold(item.individual_id, user.id);
                                                                showToast(`Unit ${item.individual_id} marked as sold`);
                                                                await loadData();
                                                            } catch (e: any) {
                                                                showToast(e.message || 'Failed', 'error');
                                                            } finally {
                                                                setProcessingKey(null);
                                                            }
                                                        }}
                                                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-60"
                                                    >
                                                        <AlertTriangle size={12} />
                                                        Mark as Sold
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <div className="px-4 py-5 space-y-4">
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <RotateCcw size={20} className="text-orange-400" /> Returns
                </h1>
                <p className="text-xs text-zinc-500">
                    {pendingCount} instant return{pendingCount === 1 ? '' : 's'} awaiting approval
                </p>
            </div>

            {withActiveFlow.length === 0 ? (
                <div className="text-center py-12">
                    <Inbox size={32} className="mx-auto text-zinc-600 mb-2" />
                    <p className="text-zinc-500 text-sm">No returns pending</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* ── Instant Returns ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={14} className="text-amber-400" />
                            <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest">Instant Returns</h2>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{instantReturns.length}</span>
                        </div>
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {instantReturns.length === 0 ? (
                                    <p key="empty-instant" className="text-xs text-zinc-600 pl-1">No instant returns</p>
                                ) : (
                                    instantReturns.map(renderCard)
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* ── Pre-scheduled Returns ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Clock size={14} className="text-purple-400" />
                            <h2 className="text-xs font-black text-purple-400 uppercase tracking-widest">Pre-scheduled Returns</h2>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">{scheduledReturns.length}</span>
                        </div>
                        <div className="space-y-6">
                            {scheduledReturns.length === 0 ? (
                                <p className="text-xs text-zinc-600 pl-1">No scheduled returns</p>
                            ) : (
                                Object.entries(groupedScheduledReturns).map(([date, items]) => (
                                    <div key={date} className="space-y-3">
                                        <div className="flex items-center gap-3 px-1">
                                            <div className="h-px flex-1 bg-zinc-800" />
                                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{date}</span>
                                            <div className="h-px flex-1 bg-zinc-800" />
                                        </div>
                                        <div className="space-y-3">
                                            <AnimatePresence mode="popLayout">
                                                {items.map(renderCard)}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

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
