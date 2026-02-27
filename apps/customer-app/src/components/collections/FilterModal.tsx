import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Types
type FilterTab = "Size" | "Brand" | "Price";

interface FilterModalProps {
    children?: React.ReactNode;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const BRANDS = ["Zara", "H&M", "Gucci", "Prada", "Mango", "Levi's"];

export function FilterModal({ children }: FilterModalProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>("Size");
    const [selectedItems, setSelectedItems] = useState<string[]>(["M"]);
    const [priceRange, setPriceRange] = useState([200, 1500]);

    // Toggle selection helper
    const toggleSelection = (item: string) => {
        if (selectedItems.includes(item)) {
            setSelectedItems(selectedItems.filter((i) => i !== item));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const getActiveItems = () => {
        switch (activeTab) {
            case "Size": return SIZES;
            case "Brand": return BRANDS;
            default: return SIZES;
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="w-[90vw] max-w-md bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-0 overflow-hidden shadow-2xl">
                {/* Header */}
                <DialogHeader className="pt-6 pb-4 px-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold text-white tracking-tight">
                            Filter
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                    {/* Tabs Section - Glass Pill */}
                    <div className="bg-white/5 backdrop-blur-md p-1.5 rounded-2xl flex items-center mb-6 border border-white/5">
                        {(["Size", "Brand", "Price"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300",
                                    activeTab === tab
                                        ? "bg-[#ff4d6d] text-white shadow-lg shadow-[#ff4d6d]/25 scale-100"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Grid Options - Size & Brand */}
                    {activeTab !== "Price" && (
                        <div className="grid grid-cols-3 gap-3 mb-2 animate-in fade-in zoom-in-95 duration-300">
                            {getActiveItems().map((item) => {
                                const isSelected = selectedItems.includes(item);
                                return (
                                    <button
                                        key={item}
                                        onClick={() => toggleSelection(item)}
                                        className={cn(
                                            "relative group flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl border transition-all duration-200",
                                            isSelected
                                                ? "bg-white/10 border-[#ff4d6d]/50 shadow-[0_0_15px_rgba(255,77,109,0.15)]"
                                                : "bg-[#1a1a1a]/50 border-white/5 hover:border-white/10 hover:bg-white/5"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-sm font-medium transition-colors",
                                            isSelected ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                        )}>
                                            {item}
                                        </span>

                                        {isSelected && (
                                            <motion.div
                                                layoutId="active-check"
                                                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ff4d6d]"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Price Range Slider */}
                    {activeTab === "Price" && (
                        <div className="py-6 px-2 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                    <span className="text-xs text-zinc-500 block mb-1">Min Price</span>
                                    <span className="text-lg font-bold text-white">₹{priceRange[0]}</span>
                                </div>
                                <div className="h-[1px] w-8 bg-zinc-800" />
                                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                    <span className="text-xs text-zinc-500 block mb-1">Max Price</span>
                                    <span className="text-lg font-bold text-white">₹{priceRange[1]}</span>
                                </div>
                            </div>

                            <Slider
                                defaultValue={[200, 1500]}
                                max={3000}
                                step={100}
                                onValueChange={setPriceRange}
                                className="my-6"
                            />

                            <p className="text-center text-xs text-zinc-500 mt-4">
                                Average price for this category is ₹850
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-md flex gap-3">
                    <button
                        className="flex-1 py-3.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                        onClick={() => setSelectedItems([])}
                    >
                        Reset
                    </button>
                    <DialogClose asChild>
                        <button className="flex-[2] py-3.5 rounded-xl bg-[#ff4d6d] hover:bg-[#ff3355] text-white text-sm font-bold shadow-lg shadow-[#ff4d6d]/25 transition-all active:scale-95">
                            Apply Filters ({selectedItems.length})
                        </button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
