import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { supabase } from "@popclozet/api-client";
import { toast } from "sonner";
import type { ReceiptData } from "@/lib/db";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function OrderDeliveredPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) { setLoading(false); return; }

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('*, addresses (*)')
                .eq('id', orderId)
                .maybeSingle();

            if (orderError || !orderData) { setLoading(false); return; }

            const { data: orderItemsData } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId);

            let attachedItems: any[] = [];
            if (orderItemsData && orderItemsData.length > 0) {
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

            setOrder({ ...orderData, order_items: attachedItems });
            setLoading(false);
        };
        fetchOrder();
    }, [orderId]);

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

    if (loading) {
        return (
            <MobileShell className="bg-[#111111] text-white">
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                </div>
            </MobileShell>
        );
    }

    if (!order) {
        return (
            <MobileShell className="bg-[#111111] text-white" hideBottomNav>
                <div className="flex-1 flex items-center justify-center text-zinc-400">Order not found</div>
            </MobileShell>
        );
    }

    // All pricing from DB
    const deliveryFee = Number(order.delivery_fee) || 0;
    const totalAmount = Number(order.total_amount) || 0;
    const subtotal = Number(order.subtotal_amount) ||
        order.order_items?.reduce((sum: number, item: any) => sum + (Number(item.rental_price) || 0), 0) || 0;

    // MRP total from products
    const mrpTotal = order.order_items?.reduce((sum: number, item: any) => {
        const mrp = Number(item.products?.mrp) || 0;
        const qty = Number(item.quantity) || 1;
        return sum + (mrp * qty);
    }, 0) || 0;

    const orderValue = mrpTotal > 0 ? mrpTotal : subtotal;
    const discount = Math.max(0, orderValue - subtotal);

    const firstItem = order.order_items?.[0];
    const product = firstItem?.products;
    const address = order.addresses;

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            <main className="flex-1 overflow-y-auto flex flex-col">
                {/* Sticky Header */}
                <header className="sticky top-0 z-50 bg-[#111111]/80 backdrop-blur-lg px-5 py-4 border-b border-white/5 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="text-xl font-bold text-white tracking-tight" style={dmSans}>Order Details</h1>
                </header>

                {/* ─── ORDER DELIVERED BANNER ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex items-center justify-center py-5 bg-[#f2546d]"
                >
                    <span
                        className="text-[32px] font-black text-white tracking-[-0.96px]"
                        style={dmSans}
                    >
                        Order Delivered
                    </span>
                </motion.div>

                {/* ─── DIVIDER ─── */}
                <div className="h-px bg-[#484848] mx-5 mt-6" />

                {/* ─── ORDER DETAILS ─── */}
                <section className="px-5 mt-6">
                    <h2
                        className="text-2xl font-semibold text-white tracking-[-0.72px]"
                        style={dmSans}
                    >
                        Order Details
                    </h2>

                    {order.order_items?.map((item: any, idx: number) => (
                        <div key={idx} className="mt-4">
                            <h3
                                className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                {item.products?.name || "Item"}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px]" style={dmSans}>
                                    {item.products?.brand || item.products?.category || ""}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-[#b4b4b4]" />
                                <span className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px]" style={dmSans}>
                                    Size: {item.size || "Free"}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-[#b4b4b4]" />
                                <span className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px]" style={dmSans}>
                                    Qty: {item.quantity || 1}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Address */}
                    <h3
                        className="text-lg font-black text-white tracking-[-0.54px] mt-4"
                        style={dmSans}
                    >
                        Address
                    </h3>
                    <p
                        className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-1.5 leading-relaxed"
                        style={dmSans}
                    >
                        {address?.full_address || "Address not available"}
                    </p>
                </section>

                {/* ─── PRICE DETAILS ─── */}
                <section className="px-5 mt-8">
                    <h2
                        className="text-2xl font-semibold text-white tracking-[-0.72px]"
                        style={dmSans}
                    >
                        Price details
                    </h2>

                    <div className="mt-4 space-y-3">
                        {/* Order value */}
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                                Order value
                            </span>
                            <span className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                                ₹ {orderValue}
                            </span>
                        </div>

                        {/* Discount */}
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                                Discount
                            </span>
                            <span className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                                -₹ {discount}
                            </span>
                        </div>

                        {/* Delivery fee */}
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                                Delivery fee
                            </span>
                            <span className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                                ₹ {deliveryFee}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-[#6f6f6f] mt-4" />

                    {/* Total */}
                    <div className="flex justify-between items-center mt-4">
                        <span className="text-2xl font-semibold text-white tracking-[-0.72px]" style={dmSans}>
                            Total
                        </span>
                        <span className="text-2xl font-semibold text-white tracking-[-0.72px]" style={dmSans}>
                            ₹ {totalAmount}
                        </span>
                    </div>
                </section>

                {/* Spacer */}
                <div className="flex-1" />

                {/* ─── BOTTOM BUTTONS ─── */}
                <div className="flex gap-4 px-5 pb-8 pt-6">
                    <button
                        onClick={handleDownloadInvoice}
                        disabled={isGeneratingPdf}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl border border-[#484848] bg-transparent disabled:opacity-50"
                    >
                        <span className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                            {isGeneratingPdf ? "Generating..." : "Invoice"}
                        </span>
                    </button>
                    <button
                        onClick={() => navigate("/home")}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl bg-[#f2546d]"
                    >
                        <span className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]" style={dmSans}>
                            Done
                        </span>
                    </button>
                </div>
            </main>
        </MobileShell>
    );
}
