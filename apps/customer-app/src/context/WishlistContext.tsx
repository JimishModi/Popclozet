import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from "sonner";
import {
    addToWishlistDB,
    removeFromWishlistDB,
    getWishlistItemsDB,
    isInWishlistDB,
    addToOfflineQueueDB
} from '@/lib/db';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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

    // Load wishlist from IndexedDB on mount
    useEffect(() => {
        loadWishlistFromDB();
    }, []);

    const loadWishlistFromDB = async () => {
        try {
            const items = await getWishlistItemsDB();
            setWishlistItems(items.map(item => item.productId));
        } catch (error) {
            console.error('Error loading wishlist from IndexedDB:', error);
            // Fallback to localStorage if IndexedDB fails
            const saved = localStorage.getItem('wishlist');
            if (saved) {
                setWishlistItems(JSON.parse(saved));
            }
        }
    };

    const addToWishlist = async (productId: string) => {
        const alreadyInWishlist = await isInWishlistDB(productId);

        if (!alreadyInWishlist) {
            try {
                await addToWishlistDB(productId);

                // Queue for sync if offline
                if (!isOnline) {
                    await addToOfflineQueueDB('add_to_wishlist', { productId });
                }

                setWishlistItems(prev => [...prev, productId]);
                toast.success("Added to Wishlist", {
                    description: isOnline ? "Item saved for later" : "Saved offline - will sync when online",
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
            await removeFromWishlistDB(productId);

            // Queue for sync if offline
            if (!isOnline) {
                await addToOfflineQueueDB('remove_from_wishlist', { productId });
            }

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
