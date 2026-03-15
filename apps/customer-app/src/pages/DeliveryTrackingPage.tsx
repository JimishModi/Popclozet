// src/pages/DeliveryTrackingPage.tsx
// Real-time delivery tracking page

import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Phone, MessageCircle, Truck, Package } from 'lucide-react';
import { MobileShell } from '@/components/layout/MobileShell';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { DeliveryTracker, TrackingData } from '@/components/map/DeliveryTracker';
import { OrderChat } from '@/components/map/OrderChat';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { supabase } from '@popclozet/api-client';
import { DeliveryOrder } from '@/services/deliveryService';

export default function DeliveryTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [showChat, setShowChat] = useState(false);
    const [order, setOrder] = useState<DeliveryOrder | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [riderProfile, setRiderProfile] = useState<{ name: string; phone: string; vehicle: string } | null>(null);

    useEffect(() => {
        if (!orderId) return;

        const fetchItems = async () => {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select(`
                    *,
                    products (*)
                `)
                .eq('order_id', orderId);

            if (orderItems) {
                setItems(orderItems);
            }
        };

        fetchItems();
    }, [orderId]);

    // Fetch rider profile as soon as order has a rider_id
    useEffect(() => {
        const orderWithRider = order as any;
        if (!orderWithRider?.rider_id) return;
        
        const fetchRider = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', orderWithRider.rider_id)
                .single();
            if (data) {
                setRiderProfile({
                    name: data.full_name || 'Your Rider',
                    phone: data.phone || '',
                    vehicle: data.vehicle_number || 'VEHICLE INFO'
                });
            }
        };
        fetchRider();
    }, [order]);

    if (!orderId) {
        return (
            <MobileShell className="bg-black text-white">
                <div className="flex items-center justify-center h-full">
                    <p className="text-zinc-400">Order not found</p>
                </div>
            </MobileShell>
        );
    }

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Track my PopClozet order',
                    url,
                });
            } catch {
                // User cancelled or share failed
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(url);
        }
    };

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full hover:bg-white/10"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold">Track Order</h1>
                        <p className="text-xs text-zinc-500">#{orderId.slice(0, 8)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleShare}
                        className="p-2 rounded-full hover:bg-white/10"
                    >
                        <Share2 className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 no-scrollbar">
                {/* Header Information: Order Summary FIRST */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Order Details</h2>
                        <div className="bg-[#ff4d6d]/10 border border-[#ff4d6d]/20 px-3 py-1 rounded-full">
                            <span className="text-[#ff4d6d] text-[10px] font-black uppercase tracking-widest">
                                Arriving in 45-60 mins
                            </span>
                        </div>
                    </div>

                    <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl">
                        <div className="space-y-4">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-4 items-center">
                                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-white/5">
                                        {item.products?.images?.[0] ? (
                                            <img src={item.products.images[0]} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                                <Package className="w-6 h-6 text-zinc-700" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-black text-white truncate uppercase tracking-tight">{item.products?.name || 'Item'}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5 font-bold uppercase tracking-widest">Size: {item.size} • Qty: 1</p>
                                    </div>
                                    <p className="text-sm font-black text-white">₹{item.rental_price}</p>
                                </div>
                            ))}

                            <div className="pt-4 border-t border-zinc-800/50 space-y-2">
                                <div className="flex justify-between text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
                                    <span>Delivery Fee</span>
                                    <span className="text-zinc-300">₹{order?.delivery_fee || 0}</span>
                                </div>
                                <div className="flex justify-between text-lg font-black text-white pt-1">
                                    <span className="tracking-tighter">TOTAL</span>
                                    <span className="text-[#ff4d6d]">₹{order?.total_amount || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DeliveryTracker 
                    orderId={orderId} 
                    onOrderLoad={setOrder}
                    onTrackingUpdate={setTracking}
                />

                {/* Rider Details (If Active or Assigned) */}
                {(tracking || riderProfile) && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-5 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Live Tracking</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Rider Active</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#ff4d6d]/10 flex items-center justify-center border border-[#ff4d6d]/20">
                                <Truck className="w-7 h-7 text-[#ff4d6d]" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[15px] font-black text-white uppercase tracking-tight">{tracking?.driver_name || riderProfile?.name || 'Rider Assigned'}</p>
                                <p className="text-[11px] text-zinc-500 mt-1 font-bold uppercase tracking-widest">{tracking?.vehicle_number || riderProfile?.vehicle || 'VEHICLE INFO'}</p>
                            </div>
                            {riderProfile?.phone ? (
                                <a 
                                    href={`tel:${riderProfile.phone}`}
                                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg active:scale-90 transition-all"
                                >
                                    <Phone className="w-5 h-5 text-black" />
                                </a>
                            ) : (
                                <button 
                                    onClick={() => window.location.href = 'tel:+918000155299'}
                                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg active:scale-90 transition-all"
                                >
                                    <Phone className="w-5 h-5 text-black" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Contact options */}
                <div className="mt-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                    <h3 className="text-sm font-semibold text-white mb-3">Need Help?</h3>
                    <div className="flex gap-3">
                        <a 
                            href="tel:+918000155299"
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <Phone className="w-4 h-4" />
                            Call
                        </a>
                        <button 
                            onClick={() => setShowChat(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Chat
                        </button>
                    </div>
                </div>

                {/* Order actions (Report Issue only now) */}
                <div className="mt-4">
                    <a 
                        href={`mailto:popclozet@gmail.com?subject=Issue with Order #${orderId}`}
                        className="w-full flex items-center justify-center py-3 rounded-xl bg-zinc-900 border border-[#ff4d6d]/30 text-sm text-[#ff4d6d] hover:bg-[#ff4d6d]/10 transition-colors"
                    >
                        Report an Issue
                    </a>
                </div>
            </main>

            <BottomNavBar />

            {/* Chat Drawer */}
            <AnimatePresence>
                {showChat && (
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm">
                        <div 
                            className="absolute inset-0" 
                            onClick={() => setShowChat(false)} 
                        />
                        <OrderChat 
                            orderId={orderId} 
                            onClose={() => setShowChat(false)} 
                        />
                    </div>
                )}
            </AnimatePresence>
        </MobileShell>
    );
}
