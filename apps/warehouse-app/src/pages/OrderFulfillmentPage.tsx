/**
 * Order Fulfillment Page — Mobile Layout
 * Filter by status + action buttons to transition orders.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Check, PackageCheck, Truck, Clock, RefreshCw, MapPin, Package, User, Phone, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '@popclozet/auth';
import { getFulfillmentOrders, confirmOrder, packOrder, markAsReadyForPickup, generateWarehouseOtp, type OrderWithItems } from '../services/fulfillmentService';
import { useToast } from '../contexts/ToastContext';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { KeyRound } from 'lucide-react';
import { OrderTimelineOverlay } from '../components/OrderTimelineOverlay';
import { buildManualAddressSummary } from '../services/addressDetails';
import { OrderCustomerInfoPanel } from '../components/OrderCustomerInfoPanel';

type StatusFilter = 'pending' | 'confirmed' | 'packed' | 'ready_for_pickup' | 'dispatched';

const filterTabs: { key: StatusFilter; label: string; icon: any; color: string }[] = [
    { key: 'pending', label: 'New', icon: Clock, color: 'text-amber-400' },
    { key: 'confirmed', label: 'Confirmed', icon: Check, color: 'text-blue-400' },
    { key: 'packed', label: 'Packed', icon: PackageCheck, color: 'text-warehouse-400' },
    { key: 'ready_for_pickup', label: 'Ready', icon: Truck, color: 'text-purple-400' },
    { key: 'dispatched', label: 'Sent', icon: Truck, color: 'text-emerald-400' },
];

export function OrderFulfillmentPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [filter, setFilter] = useState<StatusFilter>('pending');
    const [allOrders, setAllOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [generatingOtp, setGeneratingOtp] = useState<string | null>(null);
    const [viewingActivity, setViewingActivity] = useState<string | null>(null);
    const [viewingCustomerInfo, setViewingCustomerInfo] = useState<string | null>(null);

    const loadOrders = useCallback(async () => {
        try {
            const data = await getFulfillmentOrders();
            setAllOrders(data);
        } catch (err) {
            console.error('Load orders error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadOrders(); }, [loadOrders]);
    useRealtimeOrders({ onChange: loadOrders });

    const orders = allOrders.filter(o => {
        if (filter === 'ready_for_pickup') return o.status === 'ready_for_pickup' || o.status === 'rider_assigned' || o.status === 'driver_arrived_warehouse';
        if (filter === 'dispatched') return o.status === 'dispatched' || o.status === 'out_for_delivery' || o.status === 'delivered';
        return o.status === filter;
    });

    const handleAction = async (order: OrderWithItems) => {
        setProcessing(order.id);
        try {
            const actorId = user?.id || 'anonymous';
            if (filter === 'pending') {
                await confirmOrder(order.id, actorId);
                showToast('Order confirmed');
            } else if (filter === 'confirmed') {
                await packOrder(order.id, actorId);
                showToast('Order packed');
            } else if (filter === 'packed') {
                await markAsReadyForPickup(order.id, actorId);
                showToast('Order ready for pickup');
            }
            await loadOrders();
        } catch (err: any) {
            console.error('Order action error:', err);
            showToast(err.message || 'Action failed', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const handleGenerateOtp = async (orderId: string) => {
        setGeneratingOtp(orderId);
        try {
            console.log('[Warehouse] Generating OTP for order:', orderId);
            const { otp } = await generateWarehouseOtp(orderId);
            showToast('OTP generated: ' + otp, 'success');
            // Explicitly reload to reflect the OTP in the UI immediately
            await loadOrders();
        } catch (err: any) {
            console.error('Failed to generate OTP:', err);
            showToast(err.message || 'Failed to generate OTP', 'error');
        } finally {
            setGeneratingOtp(null);
        }
    };

    const actionLabel: Record<StatusFilter, string> = {
        pending: 'Confirm',
        confirmed: 'Pack',
        packed: 'Ready for Pickup',
        ready_for_pickup: '',
        dispatched: '',
    };

    return (
        <div className="px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <ClipboardList size={20} className="text-blue-400" /> Orders
                    </h1>
                    <p className="text-xs text-zinc-500">{orders.length} {filter} orders</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {filterTabs.map(({ key, label, icon: Icon, color }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                            filter === key
                                ? 'bg-warehouse-500/15 text-warehouse-300 border border-warehouse-500/30'
                                : 'bg-surface-card text-zinc-500 border border-surface-border hover:text-zinc-300'
                        )}
                    >
                        <Icon size={14} className={filter === key ? 'text-warehouse-400' : color} />
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                    {loading ? (
                        [...Array(3)].map((_, i) => <div key={i} className="bg-surface-card rounded-xl h-24 animate-pulse" />)
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12">
                            <ClipboardList size={32} className="mx-auto text-zinc-600 mb-2" />
                            <p className="text-zinc-500 text-sm">No {filter} orders</p>
                        </div>
                    ) : (
                        orders.map(order => {
                            const isProcessing = processing === order.id;
                            const fetchedAddress =
                                order.delivery_address_snapshot?.full_address ||
                                order.addresses?.full_address ||
                                '';
                            const manualAddressSummary = buildManualAddressSummary(order.manual_address_details);
                            const isViewingCustomerInfo = viewingCustomerInfo === order.id;
                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-surface-card border border-surface-border rounded-xl p-3.5"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-white mb-0.5">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-zinc-400 font-medium">₹{order.total_amount}</p>
                                                {order.payment_method && (
                                                    <span className={clsx(
                                                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border',
                                                        order.payment_method === 'cod'
                                                            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    )}>
                                                        {order.payment_method === 'cod' ? 'COD' : 'PAID'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={clsx(
                                                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                                filter === 'pending' && 'bg-amber-500/15 text-amber-400',
                                                filter === 'confirmed' && 'bg-blue-500/15 text-blue-400',
                                                filter === 'packed' && 'bg-warehouse-500/15 text-warehouse-400',
                                                filter === 'ready_for_pickup' && 'bg-purple-500/15 text-purple-400',
                                                filter === 'dispatched' && 'bg-emerald-500/15 text-emerald-400',
                                            )}>
                                                {order.status}
                                            </span>
                                            {(filter === 'ready_for_pickup' || order.status === 'rider_assigned') && (
                                                <div className="flex flex-col items-end">
                                                    {order.warehouse_otp ? (
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-1 text-white font-mono font-bold text-sm bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                                                                <KeyRound size={10} className="text-purple-400" />
                                                                {order.warehouse_otp}
                                                            </div>
                                                            <button 
                                                                onClick={() => handleGenerateOtp(order.id)}
                                                                disabled={generatingOtp === order.id}
                                                                className="text-[8px] text-zinc-500 hover:text-zinc-300 mt-0.5"
                                                            >
                                                                {generatingOtp === order.id ? '...' : 'Regenerate'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleGenerateOtp(order.id)}
                                                            disabled={generatingOtp === order.id}
                                                            className="flex items-center gap-1 text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 hover:bg-purple-500/20"
                                                        >
                                                            {generatingOtp === order.id ? (
                                                                <RefreshCw size={8} className="animate-spin" />
                                                            ) : (
                                                                <KeyRound size={8} />
                                                            )}
                                                            Generate OTP
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {(fetchedAddress || manualAddressSummary) && (
                                        <div className="mb-3 space-y-2">
                                            {fetchedAddress && (
                                                <div className="flex items-start gap-1.5">
                                                    <MapPin size={12} className="text-zinc-500 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Address Fetched</p>
                                                        <p className="text-[10px] text-zinc-400 line-clamp-2">{fetchedAddress}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {manualAddressSummary && (
                                                <div className="flex items-start gap-1.5">
                                                    <MapPin size={12} className="text-[#f2546d] mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Manual Address</p>
                                                        <p className="text-[10px] text-zinc-300 line-clamp-3">{manualAddressSummary}</p>
                                                        {(order.manual_address_details?.contactName || order.manual_address_details?.phoneNumber) && (
                                                            <p className="text-[10px] text-zinc-500 mt-1">
                                                                {[order.manual_address_details?.contactName, order.manual_address_details?.phoneNumber].filter(Boolean).join(' • ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Items List */}
                                    <div className="mb-4 space-y-2 max-h-32 overflow-y-auto no-scrollbar">
                                        {order.order_items?.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.product_id) navigate(`/product/${item.product_id}`);
                                                }}
                                                className="w-full flex items-center gap-2.5 p-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border transition-all active:scale-[0.98] text-left"
                                            >
                                                <div className="w-8 h-10 rounded bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                                                    {item.products?.images?.[0] ? (
                                                        <img src={item.products.images[0]} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package size={12} className="text-zinc-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-white truncate uppercase tracking-tight">
                                                        {item.products?.name || 'Product'}
                                                    </p>
                                                    <p className="text-[9px] text-warehouse-400 font-bold uppercase">SIZE: {item.size || 'N/A'}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Rider Information (if assigned) */}
                                    {order.rider_id && (
                                        <div className="mb-3 pt-2 border-t border-surface-border space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <User size={12} className="text-purple-400" />
                                                    <span className="text-[11px] font-medium text-zinc-300">{order.rider_name || 'Rider Assigned'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                {order.riders?.phone ? (
                                                    <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                                                        <Phone size={10} />
                                                        <a href={`tel:${order.riders.phone}`} onClick={e => e.stopPropagation()} className="hover:text-purple-400 decoration-transparent underline hover:decoration-purple-400 transition-colors">{order.riders.phone}</a>
                                                    </div>
                                                ) : <div />}
                                                {order.status === 'out_for_delivery' && (
                                                    <div className="flex items-center gap-1 text-[9px]">
                                                        <Link to={`/track/${order.id}`} onClick={e => e.stopPropagation()} className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 font-medium">
                                                            Track Rider <MapPin size={8} className="inline"/>
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isViewingCustomerInfo ? (
                                        <OrderCustomerInfoPanel
                                            customerName={order.customer_profile?.full_name}
                                            customerPhone={order.customer_profile?.phone}
                                            customerEmail={order.customer_profile?.email}
                                            fetchedAddress={fetchedAddress}
                                            manualAddressDetails={order.manual_address_details}
                                            riderName={order.rider_name || order.riders?.name || order.riders?.full_name}
                                            riderPhone={order.riders?.phone}
                                        />
                                    ) : null}

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-border">
                                        <div className="flex items-center gap-3">
                                            <p className="text-[10px] text-zinc-500">
                                                {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <button
                                                onClick={() => setViewingCustomerInfo((current) => current === order.id ? null : order.id)}
                                                className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white transition-colors font-semibold"
                                            >
                                                <User size={10} />
                                                {isViewingCustomerInfo ? 'Hide Customer Info' : 'Customer Info'}
                                            </button>
                                            <button 
                                                onClick={() => setViewingActivity(order.id)} 
                                                className="flex items-center gap-1 text-[10px] text-warehouse-400 hover:text-warehouse-300 transition-colors font-semibold"
                                            >
                                                <Activity size={10} />
                                                View Updates
                                            </button>
                                        </div>

                                        {actionLabel[filter] && (
                                            <button
                                                disabled={isProcessing}
                                                onClick={() => handleAction(order)}
                                                className={clsx(
                                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                                    isProcessing ? 'opacity-50 cursor-not-allowed' : '',
                                                    filter === 'pending' && 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25',
                                                    filter === 'confirmed' && 'bg-warehouse-500/15 text-warehouse-400 hover:bg-warehouse-500/25',
                                                    filter === 'packed' && 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
                                                )}
                                            >
                                                {isProcessing ? <RefreshCw size={12} className="animate-spin" /> : actionLabel[filter]}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>

            {viewingActivity && (
                <OrderTimelineOverlay 
                    orderId={viewingActivity} 
                    onClose={() => setViewingActivity(null)} 
                />
            )}
        </div>
    );
}
