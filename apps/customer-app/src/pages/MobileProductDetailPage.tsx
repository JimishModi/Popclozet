import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Heart, ShoppingBag } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { getProductById } from "@/config/products";
import shareButtonIcon from "@/assets/icons/share-button.svg";
import starRatingIcon from "@/assets/icons/star-rating.svg";
import deliveryTruckIcon from "@/assets/icons/delivery-truck.svg";
import shieldInsuranceIcon from "@/assets/icons/shield-insurance.svg";
import qualityAssuredIcon from "@/assets/icons/quality-assured.svg";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

/* Inline chevron-up icon */
const ChevronUpIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 19 12" fill="none">
        <path
            d="M17.815 12.043a1.19 1.19 0 0 1-.841-.447l-6.08-7.803a2.5 2.5 0 0 0-.643-.55 2.5 2.5 0 0 0-.758-.195c-.261 0-.518.066-.759.194-.24.127-.459.315-.643.551l-6.076 7.793a1.19 1.19 0 0 1-.836.428 1.19 1.19 0 0 1-.831-.447A1.52 1.52 0 0 1 0 10.5c-.003-.4.117-.785.334-1.073l6.072-7.792C7.224.587 8.332 0 9.488 0c1.156 0 2.265.588 3.083 1.636l6.081 7.803c.166.213.279.484.325.78.046.295.023.602-.067.88a1.32 1.32 0 0 1-.436.685 1.14 1.14 0 0 1-.659.259Z"
            fill="currentColor"
        />
    </svg>
);

/* Inline edit icon */
const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path
            d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/* Inline ruler/size-guide icon */
const RulerIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
            x="1"
            y="5"
            width="14"
            height="6"
            rx="1"
            stroke="#f2546d"
            strokeWidth="1.2"
            transform="rotate(-45 8 8)"
        />
        <line x1="4" y1="7" x2="4" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="6" y1="6" x2="6" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="8" y1="7" x2="8" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="10" y1="6" x2="10" y2="9" stroke="#f2546d" strokeWidth="1" />
        <line x1="12" y1="7" x2="12" y2="9" stroke="#f2546d" strokeWidth="1" />
    </svg>
);

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const MobileProductDetailPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
    const [selectedSize, setSelectedSize] = useState("S");
    const [showProductDetails, setShowProductDetails] = useState(true);

    // Get product from config
    const product = productId ? getProductById(productId) : null;

    // Calculate savings
    const originalPrice = product ? product.price : 4000;
    const rentalPrice = product ? Math.round(product.price * 0.15) : 699;
    const savingsPercent = Math.round(
        ((originalPrice - rentalPrice) / originalPrice) * 100
    );

    const toggleWishlist = () => {
        if (!product) return;
        if (isInWishlist(product.id)) {
            removeFromWishlist(product.id);
        } else {
            addToWishlist(product.id);
        }
    };

    const handleAddToCart = () => {
        if (product) {
            addToCart(product.id);
        }
    };

    if (!product) {
        return (
            <MobileShell className="bg-[#111111] text-white">
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                    <h2 className="text-xl font-bold mb-2">Product Not Found</h2>
                    <p className="text-zinc-400 mb-6">
                        The product you're looking for doesn't exist.
                    </p>
                    <Link
                        to="/home"
                        className="px-6 py-3 rounded-full bg-[#f2546d] text-white font-semibold"
                    >
                        Back to Home
                    </Link>
                </div>
            </MobileShell>
        );
    }

    return (
        <MobileShell className="bg-[#111111] text-white" hideBottomNav>
            {/* ─── HEADER ─── */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-[#111111]/90 backdrop-blur-md">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleWishlist}
                        className="p-2 rounded-full bg-[#232323]"
                    >
                        <Heart
                            className={cn(
                                "w-5 h-5",
                                isInWishlist(product.id)
                                    ? "fill-[#f2546d] text-[#f2546d]"
                                    : "text-zinc-400"
                            )}
                        />
                    </button>
                    <button
                        onClick={() => navigate("/cart")}
                        className="p-2 rounded-full bg-[#232323]"
                    >
                        <ShoppingBag className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <main className="flex-1 overflow-y-auto pb-28">
                {/* Image Gallery */}
                <div className="relative">
                    <div className="flex">
                        {/* Main image area */}
                        <div className="flex-1 bg-[#232323] aspect-[344/360]">
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Side strip with share button */}
                        <div className="w-[52px] bg-[#232323] flex flex-col items-center pt-3">
                            <img
                                src={shareButtonIcon}
                                alt="Share"
                                className="w-[41px] h-[41px]"
                            />
                        </div>
                    </div>

                    {/* Edit Outfit Button */}
                    <button className="absolute bottom-3 right-[68px] flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#5f606a] bg-[#3a3a3a]">
                        <EditIcon />
                        <span
                            className="text-sm font-semibold text-white tracking-[-0.42px]"
                            style={dmSans}
                        >
                            Edit Outfit
                        </span>
                    </button>
                </div>

                {/* Product Info */}
                <div className="px-5 mt-6">
                    {/* Name + Rating */}
                    <div className="flex items-start justify-between">
                        <h1
                            className="text-2xl font-semibold text-[#b4b4b4] tracking-[-0.72px]"
                            style={dmSans}
                        >
                            {product.name || "Haldi Outfit"}
                        </h1>
                        <img
                            src={starRatingIcon}
                            alt="Rating"
                            className="w-[116px] h-[19px] mt-1"
                        />
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center gap-3 mt-4">
                        <span
                            className="text-2xl font-semibold text-white tracking-[-0.72px]"
                            style={dmSans}
                        >
                            ₹ {rentalPrice}
                        </span>
                        <span className="relative">
                            <span
                                className="text-2xl font-semibold text-[#5f606a] tracking-[-0.72px]"
                                style={dmSans}
                            >
                                ₹ {originalPrice}
                            </span>
                            <span className="absolute left-0 right-0 top-1/2 h-[2px] bg-[#5f606a]" />
                        </span>
                        <span
                            className="text-lg font-semibold text-[#f2546d] tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Save {savingsPercent}%
                        </span>
                    </div>

                    {/* ─── SELECT SIZE ─── */}
                    <div className="flex items-center justify-between mt-10">
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Select Size
                        </span>
                        <button className="flex items-center gap-1.5">
                            <RulerIcon />
                            <span
                                className="text-sm font-semibold text-[#f2546d] tracking-[-0.42px]"
                                style={dmSans}
                            >
                                Size Guide
                            </span>
                        </button>
                    </div>

                    {/* Size buttons */}
                    <div className="flex items-center gap-3 mt-5 relative">
                        {SIZES.map((size) => {
                            const isSelected = selectedSize === size;
                            const isDisabled = size === "XS" || size === "M";

                            return (
                                <div key={size} className="relative">
                                    {/* 2h badge for M size */}
                                    {size === "M" && (
                                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#8d303f] rounded-lg px-2 py-1">
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 12 12"
                                                fill="none"
                                            >
                                                <circle
                                                    cx="6"
                                                    cy="6"
                                                    r="5"
                                                    stroke="white"
                                                    strokeWidth="1"
                                                />
                                                <path
                                                    d="M6 3v3l2 2"
                                                    stroke="white"
                                                    strokeWidth="1"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <span
                                                className="text-sm font-semibold text-white tracking-[-0.42px]"
                                                style={dmSans}
                                            >
                                                2h
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() =>
                                            !isDisabled && setSelectedSize(size)
                                        }
                                        className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center",
                                            "text-lg font-black tracking-[-0.54px]",
                                            isSelected
                                                ? "bg-[#f2546d] text-[#611624]"
                                                : isDisabled
                                                ? "text-[#616161]"
                                                : "text-white"
                                        )}
                                        style={dmSans}
                                    >
                                        {size}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* ─── PRODUCT DETAILS ─── */}
                    <div className="mt-10">
                        <button
                            onClick={() =>
                                setShowProductDetails(!showProductDetails)
                            }
                            className="flex items-center justify-between w-full"
                        >
                            <span
                                className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                                style={dmSans}
                            >
                                Product Details
                            </span>
                            <ChevronUpIcon
                                className={cn(
                                    "w-5 h-3 text-white transition-transform",
                                    !showProductDetails && "rotate-180"
                                )}
                            />
                        </button>

                        {showProductDetails && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mt-4"
                            >
                                <p
                                    className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] leading-[16.8px]"
                                    style={dmSans}
                                >
                                    Material & Care:
                                    <br />
                                    100% Polyester
                                </p>
                                <p
                                    className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] leading-[16.8px] mt-4"
                                    style={dmSans}
                                >
                                    Machine Wash
                                    <br />
                                    Country of Origin: India (and proud)
                                    <br />
                                    Manufactured & Sold By:
                                    <br />
                                    The Souled Store Pvt. Ltd.
                                    <br />
                                    224, Tantia Jogani Industrial Premises
                                    <br />
                                    J.R. Boricha Marg
                                    <br />
                                    Lower Parel (E)
                                    <br />
                                    Mumbai - 400 011
                                </p>
                                <p
                                    className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] leading-[16.8px] mt-4"
                                    style={dmSans}
                                >
                                    connect@thesouledstore.com
                                    <br />
                                    Customer care no. +91 22-68493328
                                </p>
                            </motion.div>
                        )}
                    </div>

                    {/* ─── SERVICE BADGES ─── */}
                    <div className="mt-8 flex items-center justify-around py-6 px-4 rounded-2xl border border-[#616161]">
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={deliveryTruckIcon}
                                alt="Delivery"
                                className="w-12 h-9 invert opacity-60"
                            />
                            <span
                                className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] leading-[16.8px] text-center"
                                style={dmSans}
                            >
                                60-Min
                                <br />
                                Delivery
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={shieldInsuranceIcon}
                                alt="Insurance"
                                className="w-8 h-8 invert opacity-60"
                            />
                            <span
                                className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] text-center"
                                style={dmSans}
                            >
                                Zero Insurance
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={qualityAssuredIcon}
                                alt="Quality"
                                className="w-10 h-9 invert opacity-60"
                            />
                            <span
                                className="text-sm font-normal text-[#b4b4b4] tracking-[-0.42px] leading-[16.8px] text-center"
                                style={dmSans}
                            >
                                Quality-Assured
                                <br />
                                Dry Cleaned
                            </span>
                        </div>
                    </div>

                    {/* ─── REVIEWS ─── */}
                    <h2
                        className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px] mt-8"
                        style={dmSans}
                    >
                        Reviews
                    </h2>
                </div>
            </main>

            {/* ─── BOTTOM ACTION BAR ─── */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#111111] border-t border-[#232323]">
                <div className="max-w-[430px] mx-auto flex gap-4 px-5 py-4">
                    <button
                        onClick={handleAddToCart}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl border border-[#484848] bg-transparent"
                    >
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Instant Buy
                        </span>
                    </button>
                    <button
                        onClick={handleAddToCart}
                        className="flex-1 h-[50px] flex items-center justify-center rounded-2xl bg-[#f2546d]"
                    >
                        <span
                            className="text-lg font-semibold text-white tracking-[-0.54px] leading-[21.6px]"
                            style={dmSans}
                        >
                            Rent Outfit
                        </span>
                    </button>
                </div>
            </div>
        </MobileShell>
    );
};

export default MobileProductDetailPage;
