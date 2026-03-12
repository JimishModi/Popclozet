/**
 * SizeChartModal — Myntra-style size guide
 *
 * Full-screen bottom sheet showing size measurements in cm/inches,
 * with tabs for different garment categories and a "How to Measure" section.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const dmSans = { fontFamily: "'DM Sans', sans-serif" };

type Unit = "cm" | "in";

interface SizeRow {
    size: string;
    chest: [number, number]; // cm values [min, max] or [value, value]
    waist: [number, number];
    hips: [number, number];
    length: [number, number];
}

const WOMEN_SIZES: SizeRow[] = [
    { size: "XS", chest: [78, 82], waist: [60, 64], hips: [86, 90], length: [130, 135] },
    { size: "S", chest: [82, 86], waist: [64, 68], hips: [90, 94], length: [132, 137] },
    { size: "M", chest: [86, 92], waist: [68, 74], hips: [94, 100], length: [134, 139] },
    { size: "L", chest: [92, 98], waist: [74, 80], hips: [100, 106], length: [136, 141] },
    { size: "XL", chest: [98, 104], waist: [80, 86], hips: [106, 112], length: [138, 143] },
    { size: "XXL", chest: [104, 112], waist: [86, 94], hips: [112, 120], length: [140, 145] },
];

const MEN_SIZES: SizeRow[] = [
    { size: "XS", chest: [86, 90], waist: [72, 76], hips: [88, 92], length: [68, 70] },
    { size: "S", chest: [90, 96], waist: [76, 82], hips: [92, 98], length: [70, 72] },
    { size: "M", chest: [96, 102], waist: [82, 88], hips: [98, 104], length: [72, 74] },
    { size: "L", chest: [102, 108], waist: [88, 94], hips: [104, 110], length: [74, 76] },
    { size: "XL", chest: [108, 114], waist: [94, 100], hips: [110, 116], length: [76, 78] },
    { size: "XXL", chest: [114, 122], waist: [100, 108], hips: [116, 124], length: [78, 80] },
];

function toInches(cm: number): number {
    return Math.round(cm / 2.54 * 10) / 10;
}

function formatRange(range: [number, number], unit: Unit): string {
    if (unit === "in") {
        return `${toInches(range[0])} - ${toInches(range[1])}`;
    }
    return `${range[0]} - ${range[1]}`;
}

interface SizeChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    gender?: "mens" | "womens" | "unisex";
    selectedSize?: string;
}

export function SizeChartModal({ isOpen, onClose, gender = "womens", selectedSize }: SizeChartModalProps) {
    const [activeTab, setActiveTab] = useState<"womens" | "mens">(
        gender === "mens" ? "mens" : "womens"
    );
    const [unit, setUnit] = useState<Unit>("in");
    const sizes = activeTab === "mens" ? MEN_SIZES : WOMEN_SIZES;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[100]"
                    />

                    {/* Bottom sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 z-[101] bg-[#1a1a1a] rounded-t-3xl max-h-[85vh] flex flex-col max-w-md mx-auto w-full"
                    >
                        {/* Handle */}
                        <div className="flex justify-center py-3">
                            <div className="w-10 h-1 rounded-full bg-zinc-600" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-4">
                            <h2
                                className="text-xl font-bold text-white tracking-tight"
                                style={dmSans}
                            >
                                Size Chart
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-zinc-400" />
                            </button>
                        </div>

                        {/* Gender tabs */}
                        <div className="flex gap-2 px-5 mb-4">
                            {(["womens", "mens"] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab
                                        ? "bg-[#f2546d] text-white"
                                        : "bg-[#2a2a2a] text-zinc-400"
                                        }`}
                                    style={dmSans}
                                >
                                    {tab === "womens" ? "Women" : "Men"}
                                </button>
                            ))}
                        </div>

                        {/* Unit toggle */}
                        <div className="flex items-center gap-2 px-5 mb-4">
                            <span className="text-xs text-zinc-500" style={dmSans}>Unit:</span>
                            <div className="flex bg-[#2a2a2a] rounded-lg p-0.5">
                                {(["in", "cm"] as Unit[]).map((u) => (
                                    <button
                                        key={u}
                                        onClick={() => setUnit(u)}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${unit === u
                                            ? "bg-[#f2546d] text-white"
                                            : "text-zinc-400"
                                            }`}
                                        style={dmSans}
                                    >
                                        {u.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto px-5 pb-6">
                            <div className="rounded-2xl border border-[#333] overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-5 bg-[#232323]">
                                    {["Size", "Chest", "Waist", "Hips", "Length"].map((h) => (
                                        <div
                                            key={h}
                                            className="py-3 px-2 text-center"
                                        >
                                            <span
                                                className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider"
                                                style={dmSans}
                                            >
                                                {h}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Table rows */}
                                {sizes.map((row, i) => (
                                    <div
                                        key={row.size}
                                        className={`grid grid-cols-5 ${i % 2 === 0 ? "bg-[#1a1a1a]" : "bg-[#1f1f1f]"
                                            } ${selectedSize === row.size
                                                ? "ring-1 ring-[#f2546d] ring-inset bg-[#f2546d]/10"
                                                : ""
                                            }`}
                                    >
                                        <div className="py-3 px-2 text-center">
                                            <span
                                                className={`text-xs font-bold ${selectedSize === row.size
                                                    ? "text-[#f2546d]"
                                                    : "text-white"
                                                    }`}
                                                style={dmSans}
                                            >
                                                {row.size}
                                            </span>
                                        </div>
                                        {[row.chest, row.waist, row.hips, row.length].map(
                                            (range, j) => (
                                                <div key={j} className="py-3 px-1 text-center">
                                                    <span
                                                        className="text-[10px] text-zinc-300"
                                                        style={dmSans}
                                                    >
                                                        {formatRange(range, unit)}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* How to Measure */}
                            <div className="mt-6">
                                <h3
                                    className="text-sm font-bold text-white mb-3"
                                    style={dmSans}
                                >
                                    How to Measure
                                </h3>
                                <div className="space-y-3">
                                    {[
                                        {
                                            title: "Chest",
                                            desc: "Measure around the fullest part of your chest, keeping the tape horizontal.",
                                        },
                                        {
                                            title: "Waist",
                                            desc: "Measure around the narrowest part of your natural waistline.",
                                        },
                                        {
                                            title: "Hips",
                                            desc: "Measure around the fullest part of your hips.",
                                        },
                                        {
                                            title: "Length",
                                            desc: "Measure from the shoulder to the hem of the garment.",
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.title}
                                            className="flex gap-3 items-start"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#f2546d] mt-1.5 flex-shrink-0" />
                                            <div>
                                                <span
                                                    className="text-xs font-semibold text-white"
                                                    style={dmSans}
                                                >
                                                    {item.title}:
                                                </span>{" "}
                                                <span
                                                    className="text-xs text-zinc-400"
                                                    style={dmSans}
                                                >
                                                    {item.desc}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
