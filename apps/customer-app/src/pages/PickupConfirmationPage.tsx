import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";

interface PickupItem {
    id: string;
    name: string;
    category: string;
    selected: boolean;
}

export default function PickupConfirmationPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();

    // Mock data - replace with actual API call
    const [items, setItems] = useState<PickupItem[]>([
        { id: "1", name: "Black Outfit", category: "Dress", selected: false },
        { id: "2", name: "Party", category: "Dress", selected: false },
        { id: "3", name: "Wool", category: "Jacket", selected: false },
    ]);

    const handleToggleItem = (id: string) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, selected: !item.selected } : item
            )
        );
    };

    const handleSelectAll = () => {
        const allSelected = items.every((item) => item.selected);
        setItems((prev) =>
            prev.map((item) => ({ ...item, selected: !allSelected }))
        );
    };

    const handleConfirm = () => {
        const selectedItems = items.filter((item) => item.selected);
        if (selectedItems.length === 0) {
            alert("Please select at least one item to confirm pickup");
            return;
        }

        // TODO: Submit to API
        console.log("Confirmed pickup for:", selectedItems);
        navigate(`/order/${orderId}/delivered`);
    };

    const allSelected = items.every((item) => item.selected);
    const selectedCount = items.filter((item) => item.selected).length;

    return (
        <MobileShell className="bg-black text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800/50">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 rounded-full hover:bg-white/10"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-semibold">Pickup Confirmed</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto px-4 py-6 pb-32 space-y-6">
                {/* Status Banner */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-pink-500 to-[#ff4d6d] rounded-2xl p-4"
                >
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
                        <div>
                            <h2 className="text-white font-bold text-lg mb-1">
                                Pickup Confirmed
                            </h2>
                            <p className="text-white/90 text-sm">
                                Your pickup items are being reviewed
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Pickup Items Header */}
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-pink-500" />
                            <h3 className="text-white font-semibold">Pickup Items</h3>
                        </div>
                        <button
                            onClick={handleSelectAll}
                            className="text-sm text-pink-500 font-medium hover:text-pink-400 transition-colors"
                        >
                            {allSelected ? "Deselect All" : "Select All"}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {items.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => handleToggleItem(item.id)}
                                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${item.selected
                                        ? "border-pink-500 bg-pink-500/10"
                                        : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600"
                                    }
                `}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Checkbox */}
                                    <div
                                        className={`
                      w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                      ${item.selected
                                                ? "border-pink-500 bg-pink-500"
                                                : "border-zinc-600"
                                            }
                    `}
                                    >
                                        {item.selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>

                                    {/* Item Visual */}
                                    <div
                                        className={`
                      w-16 h-16 rounded-lg flex items-center justify-center
                      ${item.selected
                                                ? "bg-gradient-to-br from-pink-500 to-[#ff4d6d]"
                                                : "bg-zinc-700"
                                            }
                    `}
                                    >
                                        <Package
                                            className={`w-8 h-8 ${item.selected ? "text-white" : "text-zinc-500"
                                                }`}
                                        />
                                    </div>

                                    {/* Item Details */}
                                    <div className="flex-1">
                                        <p
                                            className={`font-medium ${item.selected ? "text-white" : "text-zinc-300"
                                                }`}
                                        >
                                            {item.name}
                                        </p>
                                        <p className="text-zinc-500 text-sm">{item.category}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Warning Message */}
                {selectedCount < items.length && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-yellow-500/10 rounded-2xl border border-yellow-500/30 p-4"
                    >
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-yellow-500 font-semibold mb-1">
                                    Your pickup items are being reviewed
                                </h3>
                                <p className="text-yellow-500/80 text-sm">
                                    Please select all items that are ready for pickup. Unselected
                                    items will not be collected.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-zinc-400 text-sm">
                        {selectedCount} of {items.length} items selected
                    </span>
                    <span className="text-white font-semibold">
                        {selectedCount} items
                    </span>
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={selectedCount === 0}
                    className={`
            w-full py-4 rounded-xl font-semibold text-lg transition-all
            ${selectedCount > 0
                            ? "bg-gradient-to-r from-pink-500 to-[#ff4d6d] text-white hover:shadow-lg hover:shadow-pink-500/50"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        }
          `}
                >
                    Done
                </button>
            </div>
        </MobileShell>
    );
}
