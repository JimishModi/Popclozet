import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useState, useEffect } from "react";
import { supabase } from "@popclozet/api-client";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { clearCartDB } from "@/lib/db";
import type { ReceiptData } from "@/lib/db";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function OrderConfirmedPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const { cartItems, removeFromCart } = useCart();

    // 0. Safety cart clear fallback on entry
    useEffect(() => {
        const performSafetyClear = async () => {
            const hasItems = Object.keys(cartItems).length > 0;
            if (hasItems && orderId) {
                console.log("[OrderConfirmed] Safety clearing cart...");
                await clearCartDB().catch(() => { });
                Object.entries(cartItems).forEach(([key, data]) => {
                    const parts = key.split('_');
                    removeFromCart(parts[0], data.size, data.plan);
                });
            }
        };
        performSafetyClear();
    }, [orderId]);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) {
                setLoading(false);
                return;
            }

            console.log("[OrderConfirmed] Fetching order details for ID:", orderId);

            // 1. Fetch Order and Address
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select(`
                    *,
                    addresses (*)
                `)
                .eq('id', orderId)
                .maybeSingle();

            if (orderError || !orderData) {
                console.error("[OrderConfirmed] Fetch error:", orderError);
                toast.error("Could not load order details");
                setLoading(false);
                return;
            }

            console.log("[OrderConfirmed] Base Order retrieved:", orderData);

            // 2. Fetch Order Items
            const { data: orderItemsData } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId);

            let attachedItems: any[] = [];
            if (orderItemsData && orderItemsData.length > 0) {
                // 3. Fetch Products for those Items
                const productIds = orderItemsData.map(item => item.product_id);
                const { data: productsData } = await supabase
                    .from('products')
                    .select('*')
                    .in('id', productIds);

                attachedItems = orderItemsData.map(item => ({
                    ...item,
                    products: productsData?.find(p => p.id === item.product_id) || null
                }));
            }

            // 4. Combine
            setOrder({
                ...orderData,
                order_items: attachedItems
            });

            setLoading(false);
        };
        fetchOrder();
    }, [orderId]);

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white">
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                </div>
            </MobileShell>
        );
    }

    const firstItem = order?.order_items?.[0];
    const product = firstItem?.products;
    const itemsCount = order?.order_items?.length || 0;
    const isBuyoutOrder = order?.order_type === 'buyout';

    // All pricing data from DB — no client-side guessing
    const deliveryFee = Number(order?.delivery_fee) || 0;
    const totalAmount = Number(order?.total_amount) || 0;
    const subtotal = Number(order?.subtotal_amount) ||
      order?.order_items?.reduce((sum: number, item: any) => sum + (Number(item.rental_price) || 0), 0) || 0;

    // MRP sum from product data for each order item
    const mrpTotal = order?.order_items?.reduce((sum: number, item: any) => {
      const mrp = Number(item.products?.mrp) || 0;
      const qty = Number(item.quantity) || 1;
      return sum + (mrp * qty);
    }, 0) || 0;

    // Order value = MRP total, discount = MRP - rental subtotal
    const orderValue = mrpTotal > 0 ? mrpTotal : subtotal;
    const discount = Math.max(0, orderValue - subtotal);

    const handleDownloadInvoice = async () => {
        if (!order) return toast.error("Invoice not ready");

        setIsGeneratingPdf(true);
        try {
            const { pdf } = await import("@react-pdf/renderer");
            const { ReceiptPDF } = await import("@/components/receipt/ReceiptPDF");

            const rentalDays = order.order_items?.[0]?.rental_duration_days || 3;
            const startDate = order.rental_start_date || order.created_at || new Date().toISOString();
            const endDate = order.rental_end_date || new Date(new Date(startDate).getTime() + rentalDays * 86400000).toISOString();

            const receiptData: ReceiptData = {
                orderId: order.id,
                placedAt: order.created_at || new Date().toISOString(),
                subtotal: Math.round(orderValue),
                discount: Math.round(discount),
                deliveryFee: Math.round(deliveryFee),
                total: Math.round(totalAmount),
                paymentMethod: order.payment_method || 'cod',
                deliveryAddress: order.addresses?.full_address || "N/A",
                rentalStartDate: startDate,
                rentalEndDate: endDate,
                items: (order.order_items || []).map((item: any) => ({
                    name: item.products?.name || "Premium Item",
                    brand: item.products?.brand || "",
                    size: item.size || "Free",
                    quantity: item.quantity || 1,
                    days: item.rental_duration_days || rentalDays,
                    rentalPrice: Number(item.rental_price) || 0,
                })),
            };

            const blob = await pdf(<ReceiptPDF data={receiptData} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PopClozet_Invoice_${order.id.slice(0, 8).toUpperCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success("Invoice downloaded!");
        } catch (err) {
            console.error("PDF generation failed:", err);
            toast.error("Failed to generate invoice. Please try again.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            <main className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
                {/* ─── STICKY HEADER ─── */}
                <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg px-5 py-4">
                    <button
                        onClick={() => navigate("/home")}
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" strokeWidth={3} />
                    </button>
                </header>



                {/* ─── STATUS BANNER ─── */}
                <div className="w-full py-6 bg-[#f2546d] text-center shadow-[0_4px_30px_rgba(242,84,109,0.3)] z-10">
                    <h1 className="text-[32px] font-black text-white tracking-tight uppercase" style={dmSans}>
                        {isBuyoutOrder
                            ? 'Purchase Confirmed'
                            : (order?.status === 'pending' || order?.status === 'confirmed'
                                ? 'Order Confirmed'
                                : order?.status?.replace(/_/g, ' ') || 'Order Confirmed')}
                    </h1>
                    {isBuyoutOrder && (
                        <p className="text-white/80 text-sm font-medium mt-2" style={dmSans}>
                            It's yours forever — no return needed!
                        </p>
                    )}
                </div>

                {/* ─── ORDER DETAILS ─── */}
                <section className="px-6 py-10">
                    <h2 className="text-2xl font-black text-white mb-8" style={dmSans}>Order Details</h2>

                    <div className="space-y-6 mb-10">
                        {order?.order_items?.map((item: any, idx: number) => {
                            const p = item.products;
                            const imageUrl = p?.images?.[0] || p?.imageUrl;
                            return (
                                <div key={idx} className="flex gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt={p?.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] text-zinc-600">No img</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-[16px] font-black text-white tracking-tight uppercase leading-tight" style={dmSans}>
                                            {p?.name || "Premium Item"}
                                        </h3>
                                        <p className="text-[#a1a1a1] mt-1 text-xs font-bold uppercase tracking-widest" style={dmSans}>
                                            {p?.brand || "Collection"} • Size: {item?.size || 'S'} • Plan: {isBuyoutOrder ? 'buy' : (item?.pricing_plan || (item?.rental_duration_days + 'd'))} • Qty: 1
                                        </p>
                                    </div>
                                    <div className="text-white font-black text-lg" style={dmSans}>
                                        ₹ {item.rental_price}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Address — only for non-buyout orders */}
                    {!isBuyoutOrder && (
                        <>
                            <h3 className="text-xl font-black text-white mb-3" style={dmSans}>Address</h3>
                            <div className="text-[#8e8e93] text-sm font-medium leading-relaxed max-w-[280px]" style={dmSans}>
                                {order?.addresses?.full_address || "Delivery address loading or unavailable"}
                            </div>
                        </>
                    )}

                    {/* Scheduled Return Pickup — only for non-buyout orders */}
                    {!isBuyoutOrder && order?.return_pickup_date && (
                        <div className="mt-8">
                            <h3 className="text-xl font-black text-white mb-3" style={dmSans}>Scheduled Return</h3>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#f2546d]/10 flex items-center justify-center">
                                        <span className="text-lg">📦</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white" style={dmSans}>
                                            {new Date(order.return_pickup_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-xs text-[#8e8e93] mt-0.5 font-medium">
                                            {order.return_time_slot || 'Scheduled'} • Return pickup
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Pickup Address</p>
                                    <p className="text-xs text-[#8e8e93] leading-relaxed line-clamp-2" style={dmSans}>
                                        {order?.addresses?.full_address || "Delivery address loading or unavailable"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <h2 className="text-2xl font-black text-white mt-14 mb-8" style={dmSans}>Price details</h2>

                    <div className="space-y-5">
                        <div className="flex justify-between items-center text-lg text-[#8e8e93]" style={dmSans}>
                            <span className="font-medium">Order value</span>
                            <span className="text-white font-bold">₹ {Math.round(orderValue)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg text-[#8e8e93]" style={dmSans}>
                            <span className="font-medium">Discount</span>
                            <span className="text-zinc-600 font-bold">-₹ {Math.round(discount)}</span>
                        </div>
                        {!isBuyoutOrder && (
                            <div className="flex justify-between items-center text-lg text-[#8e8e93]" style={dmSans}>
                                <span className="font-medium">Delivery fee</span>
                                <span className="text-white font-bold">₹ {Math.round(deliveryFee)}</span>
                            </div>
                        )}

                        <div className="w-full h-px bg-white/5 mt-8" />

                        <div className="flex justify-between items-center py-6">
                            <span className="text-[28px] font-black text-white" style={dmSans}>Total</span>
                            <span className="text-[28px] font-black text-[#f2546d]" style={dmSans}>₹ {Math.round(totalAmount)}</span>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex flex-col gap-4 mt-6 pb-12">
                        {isBuyoutOrder ? (
                            <>
                                <button
                                    onClick={() => navigate('/closet')}
                                    className="w-full py-4.5 rounded-2xl bg-[#f2546d] text-white font-black text-lg shadow-[0_8px_30px_rgba(242,84,109,0.2)] active:scale-95 transition-all uppercase"
                                    style={dmSans}
                                >
                                    View My Closet
                                </button>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleDownloadInvoice}
                                        disabled={isGeneratingPdf}
                                        className="flex-1 py-4.5 rounded-2xl bg-[#1c0a0c] border border-[#3d121a] text-white font-black text-lg shadow-lg active:scale-95 transition-all disabled:opacity-50"
                                        style={dmSans}
                                    >
                                        {isGeneratingPdf ? "Generating..." : "Invoice"}
                                    </button>
                                    <button
                                        onClick={() => navigate('/home')}
                                        className="flex-1 py-4.5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-lg shadow-lg active:scale-95 transition-all"
                                        style={dmSans}
                                    >
                                        Home
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate(`/tracking/${orderId}`)}
                                    className="w-full py-4.5 rounded-2xl bg-[#f2546d] text-white font-black text-lg shadow-[0_8px_30px_rgba(242,84,109,0.2)] active:scale-95 transition-all uppercase"
                                    style={dmSans}
                                >
                                    Track My Ride
                                </button>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleDownloadInvoice}
                                        disabled={isGeneratingPdf}
                                        className="flex-1 py-4.5 rounded-2xl bg-[#1c0a0c] border border-[#3d121a] text-white font-black text-lg shadow-lg active:scale-95 transition-all disabled:opacity-50"
                                        style={dmSans}
                                    >
                                        {isGeneratingPdf ? "Generating..." : "Invoice"}
                                    </button>
                                    <button
                                        onClick={() => navigate('/home')}
                                        className="flex-1 py-4.5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-lg shadow-lg active:scale-95 transition-all"
                                        style={dmSans}
                                    >
                                        Home
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </main>
        </MobileShell>
    );
}
