import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X, CreditCard, MapPin } from "lucide-react";

export const QuickCheckoutModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[400px] bg-background border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl z-[70] p-6"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-playfair font-bold">Quick Checkout</h3>
                            <button onClick={onClose} className="p-2 hover:bg-secondary/10 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-lg bg-gray-200 object-cover overflow-hidden">
                                        <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200" alt="Item" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Velvet Evening Gown</p>
                                        <p className="text-sm text-muted-foreground">Size M • 2 Days</p>
                                    </div>
                                    <div className="ml-auto font-bold text-primary">$45</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-muted-foreground">Delivery Address</label>
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Home</p>
                                        <p className="text-xs text-muted-foreground">123 Fashion Ave, NY</p>
                                    </div>
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">60 min</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-muted-foreground">Payment Method</label>
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Apple Pay</p>
                                        <p className="text-xs text-muted-foreground">•••• 4242</p>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 transition-all active:scale-95 mt-4">
                                Pay & Rent Now
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
