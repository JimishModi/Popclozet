import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

export default function OrderDeliveredPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();

    // Mock data
    const order = {
        id: orderId || "ORD123",
        item: {
            name: "Black Dress",
            brand: "Zara",
            size: "S",
            qty: 1,
        },
        address: {
            line1: "IIT, Powai",
            pincode: "400076",
            cityState: "Mumbai, Maharashtra",
            country: "India",
            lat: 19.1362,
            lng: 72.9158,
        },
        pricing: {
            orderValue: 4000,
            discount: -500,
            deliveryFee: 50,
            total: 4250,
        },
    };

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

                    {/* Item Name */}
                    <h3
                        className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px] mt-4"
                        style={dmSans}
                    >
                        {order.item.name}
                    </h3>

                    {/* Item Meta */}
                    <div className="flex items-center gap-1.5 mt-1">
                        <span
                            className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px]"
                            style={dmSans}
                        >
                            {order.item.brand}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[#b4b4b4]" />
                        <span
                            className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px]"
                            style={dmSans}
                        >
                            Size: {order.item.size}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[#b4b4b4]" />
                        <span
                            className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px]"
                            style={dmSans}
                        >
                            Qty: {order.item.qty}
                        </span>
                    </div>

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
                        {order.address.line1}
                        <br />
                        {order.address.pincode}
                        <br />
                        {order.address.cityState}
                        <br />
                        {order.address.country}
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
                            <span
                                className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                Order value
                            </span>
                            <span
                                className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                ₹ {order.pricing.orderValue}
                            </span>
                        </div>

                        {/* Discount */}
                        <div className="flex justify-between items-center">
                            <span
                                className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                Discount
                            </span>
                            <span
                                className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                -₹ {Math.abs(order.pricing.discount)}
                            </span>
                        </div>

                        {/* Delivery fee */}
                        <div className="flex justify-between items-center">
                            <span
                                className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                Delivery fee
                            </span>
                            <span
                                className="text-lg font-normal text-[#b4b4b4] tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                ₹ {order.pricing.deliveryFee}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-[#6f6f6f] mt-4" />

                    {/* Total */}
                    <div className="flex justify-between items-center mt-4">
                        <span
                            className="text-2xl font-semibold text-white tracking-[-0.72px]"
                            style={dmSans}
                        >
                            Total
                        </span>
                        <span
                            className="text-2xl font-semibold text-white tracking-[-0.72px]"
                            style={dmSans}
                        >
                            ₹ {order.pricing.total}
                        </span>
                    </div>
                </section>

                {/* Spacer */}
                <div className="flex-1" />

                {/* ─── BOTTOM BUTTONS ─── */}
                <div className="flex gap-4 px-5 pb-8 pt-6">
                    <button
                        onClick={() => {
                            /* TODO: Generate invoice */
                        }}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl border border-[#484848] bg-transparent"
                    >
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Invoice
                        </span>
                    </button>
                    <button
                        onClick={() => navigate("/home")}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl bg-[#f2546d]"
                    >
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Done
                        </span>
                    </button>
                </div>
            </main>
        </MobileShell>
    );
}
