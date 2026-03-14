import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import deliveryPartnerAvatar from "@/assets/icons/delivery-partner-avatar.svg";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

/* Inline phone-call icon (from Figma) */
const PhoneCallIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none">
        <path
            d="M12.96 1a1 1 0 0 1 1-1c2.65.003 5.19 1.057 7.07 2.932A10.01 10.01 0 0 1 23.96 10a1 1 0 1 1-2 0c0-2.12-.85-4.15-2.35-5.65A7.99 7.99 0 0 0 13.96 2a1 1 0 0 1-1-1ZM13.96 6a4 4 0 0 1 4 4 1 1 0 1 0 2 0 6 6 0 0 0-6-6 1 1 0 1 0 0 2Zm9.09 10.74c.58.58.9 1.37.9 2.19s-.32 1.6-.9 2.19l-.91 1.05c-8.19 7.84-28.12-12.08-20.4-20.3l1.15-1a3.07 3.07 0 0 1 4.33.04l1.88 2.44c.55.58.86 1.35.86 2.14a3.03 3.03 0 0 1-.87 2.14l-1.16 1.46c.64 1.56 1.58 2.97 2.77 4.16a14.8 14.8 0 0 0 4.16 2.78l1.47-1.16a3.04 3.04 0 0 1 4.28-.01l2.44 1.88Z"
            fill="currentColor"
        />
    </svg>
);

export default function PickupTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [timeRemaining, setTimeRemaining] = useState(15 * 60);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 0) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const minutes = Math.floor(timeRemaining / 60);

    // Mock data
    const pickupData = {
        orderId: orderId || "ORD123",
        status: "on_the_way",
        deliveryPartner: {
            name: "Mukesh",
            phone: "+91 98765 43210",
        },
        address: {
            line1: "IIT, Powai",
            pincode: "400076",
            cityState: "Mumbai, Maharashtra",
            country: "India",
            lat: 19.1362,
            lng: 72.9158,
        },
    };

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            <main className="flex-1 overflow-y-auto flex flex-col">
                <section className="relative h-[240px] flex-shrink-0 bg-gradient-to-br from-[#1a1a1a] to-black rounded-b-3xl mb-6">
                    {/* Gradient Glow Orb */}
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[100px] pointer-events-none z-10"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(242,84,109,0.3) 0%, rgba(0,0,0,0) 70%)",
                        }}
                    />

                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-6 left-5 z-20 flex items-center justify-center"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>

                    {/* Information Placeholder */}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pt-8">
                         <div className="w-16 h-1 bg-zinc-800 rounded-full mb-6"></div>
                         <h2 className="text-xl font-bold text-white tracking-tight">Active Tracking</h2>
                         <p className="text-zinc-400 text-sm mt-1">Live location hidden</p>
                    </div>
                </section>

                {/* ─── PICKUP IN BANNER ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex flex-col items-center justify-center py-5 bg-[#f2546d]"
                >
                    <span
                        className="text-2xl font-semibold text-white tracking-[-0.72px]"
                        style={dmSans}
                    >
                        Pickup in
                    </span>
                    <span
                        className="text-[32px] font-black text-white tracking-[-0.96px] mt-1"
                        style={dmSans}
                    >
                        {minutes} minutes
                    </span>
                </motion.div>

                {/* ─── DELIVERY STATUS PILL ─── */}
                <div className="flex justify-center mt-6 px-5">
                    <div className="bg-[#f2546d] rounded-full px-8 py-2.5">
                        <span
                            className="text-sm font-normal text-white tracking-[-0.42px]"
                            style={dmSans}
                        >
                            Delivery partner is on his way
                        </span>
                    </div>
                </div>

                {/* ─── DELIVERY PARTNER INFO ─── */}
                <section className="px-5 mt-8 flex items-center gap-4">
                    {/* Avatar */}
                    <img
                        src={deliveryPartnerAvatar}
                        alt="Delivery Partner"
                        className="w-[72px] h-[72px] flex-shrink-0"
                    />

                    {/* Name */}
                    <p
                        className="text-2xl text-white tracking-[-0.72px] leading-[28.8px] flex-1"
                        style={dmSans}
                    >
                        {pickupData.deliveryPartner.name} is your{"\n"}delivery
                        partner
                    </p>

                    {/* Phone Icon */}
                    <button
                        onClick={() =>
                            (window.location.href = `tel:${pickupData.deliveryPartner.phone}`)
                        }
                        className="flex-shrink-0"
                    >
                        <PhoneCallIcon className="w-6 h-6 text-[#f2546d]" />
                    </button>
                </section>

                {/* ─── ADDRESS ─── */}
                <section className="px-5 mt-8">
                    <h3
                        className="text-lg font-black text-white tracking-[-0.54px]"
                        style={dmSans}
                    >
                        Address
                    </h3>
                    <p
                        className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] mt-2 leading-relaxed"
                        style={dmSans}
                    >
                        {pickupData.address.line1}
                        <br />
                        {pickupData.address.pincode}
                        <br />
                        {pickupData.address.cityState}
                        <br />
                        {pickupData.address.country}
                    </p>
                </section>

                {/* Spacer */}
                <div className="flex-1" />

                {/* ─── BOTTOM BUTTONS ─── */}
                <div className="flex gap-4 px-5 pb-8 pt-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl border border-[#484848] bg-transparent"
                    >
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Cancel Return
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
                            Okay
                        </span>
                    </button>
                </div>
            </main>
        </MobileShell>
    );
}
