import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from "sonner";
import {
    addToWishlistDB,
    removeFromWishlistDB,
    getWishlistItemsDB,
    isInWishlistDB,
    migrateAnonymousWishlistDB
} from '@/lib/db';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuth } from '@/context/SupabaseAuthContext';

interface WishlistContextType {
    wishlistItems: string[];
    addToWishlist: (productId: string) => void;
    removeFromWishlist: (productId: string) => void;
    isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
    const [wishlistItems, setWishlistItems] = useState<string[]>([]);
    const isOnline = useOnlineStatus();
    const { user } = useAuth();
    const userId = user?.id ?? null;

    // Load wishlist from IndexedDB — re-runs whenever the logged-in user changes
    useEffect(() => {
        // Reset immediately so the previous user's data isn't visible
        setWishlistItems([]);

        async function init() {
            if (userId) {
                try {
                    await migrateAnonymousWishlistDB(userId);
                } catch (e) {
                    console.error("Wishlist migration failed:", e);
                }
            }
            await loadWishlistFromDB();
        }

        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadWishlistFromDB = async () => {
        try {
            const items = await getWishlistItemsDB(userId);
            setWishlistItems(items.map(item => item.productId));
        } catch (error) {
            console.error('Error loading wishlist from IndexedDB:', error);
            // Fallback: use user-scoped localStorage key to avoid leakage
            const key = userId ? `wishlist_${userId}` : 'wishlist';
            const saved = localStorage.getItem(key);
            if (saved) {
                setWishlistItems(JSON.parse(saved));
            }
        }
    };

    const addToWishlist = async (productId: string) => {
        const alreadyInWishlist = await isInWishlistDB(productId, userId);

        if (!alreadyInWishlist) {
            try {
                await addToWishlistDB(productId, userId);

                setWishlistItems(prev => [...prev, productId]);
                toast.success("Added to Wishlist", {
                    description: "Item saved for later",
                    duration: 2000,
                });
            } catch (error) {
                console.error('Error adding to wishlist:', error);
                toast.error("Failed to add to wishlist");
            }
        }
    };

    const removeFromWishlist = async (productId: string) => {
        try {
            await removeFromWishlistDB(productId, userId);

            setWishlistItems(prev => prev.filter(id => id !== productId));
            toast.success("Removed from Wishlist");
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            toast.error("Failed to remove from wishlist");
        }
    };

    const isInWishlist = (productId: string) => {
        return wishlistItems.includes(productId);
    };

    return (
        <WishlistContext.Provider value={{ wishlistItems, addToWishlist, removeFromWishlist, isInWishlist }}>
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (context === undefined) {
        throw new Error('useWishlist must be used within a WishlistProvider');
    }
    return context;
};
