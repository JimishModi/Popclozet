import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Bookmark, Clock, ShoppingBag, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { offlineQueueService } from '@/services/offlineQueueService';

interface CachedProduct {
    id: string;
    name: string;
    imageUrl?: string;
    price?: number;
}

const OfflinePage: React.FC = () => {
    const [recentlyViewed, setRecentlyViewed] = useState<CachedProduct[]>([]);
    const [savedItems, setSavedItems] = useState<CachedProduct[]>([]);
    const [queueStatus, setQueueStatus] = useState<{ pending: number; processing: number }>({ pending: 0, processing: 0 });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadCachedData();

        const handleOnline = () => {
            setIsOnline(true);
            // Reload after a short delay to ensure connection is stable
            setTimeout(() => window.location.reload(), 1000);
        };

        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const loadCachedData = async () => {
        try {
            const [recent, saved, status] = await Promise.all([
                offlineQueueService.getRecentlyViewed(),
                offlineQueueService.getSavedItems(),
                offlineQueueService.getQueueStatus()
            ]);

            setRecentlyViewed(recent);
            setSavedItems(saved);
            setQueueStatus({ pending: status.pending, processing: status.processing });
        } catch (error) {
            console.error('Error loading cached data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRetry = () => {
        window.location.reload();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                    <Loader2 className="w-8 h-8 text-[#EB76C2]" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F6F0E0] via-white to-[#E3BBE6]/30">
            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#C0E2AD]/20 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#E3BBE6]/20 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                        className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#C0E2AD] to-[#22C55E] flex items-center justify-center shadow-lg shadow-[#22C55E]/30"
                    >
                        <WifiOff className="w-12 h-12 text-white" />
                    </motion.div>

                    <h1 className="text-4xl font-playfair font-bold mb-4">
                        <span className="bg-gradient-to-r from-[#EB76C2] to-[#A855F7] bg-clip-text text-transparent">
                            You're Offline
                        </span>
                    </h1>

                    <p className="text-lg text-muted-foreground max-w-md mx-auto">
                        Don't worry! Your saved items and browsing history are still available.
                        We'll sync everything once you're back online.
                    </p>

                    {/* Connection Status */}
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 rounded-full">
                        <motion.div
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-2 h-2 rounded-full bg-amber-500"
                        />
                        <span className="text-sm font-medium text-amber-800">
                            Waiting for connection...
                        </span>
                    </div>
                </motion.div>

                {/* Pending Syncs Notice */}
                {(queueStatus.pending > 0 || queueStatus.processing > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <Card className="border-0 bg-[#E3BBE6]/20 backdrop-blur-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#A855F7] flex items-center justify-center">
                                    <ShoppingBag className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">
                                        {queueStatus.pending + queueStatus.processing} pending action{queueStatus.pending + queueStatus.processing !== 1 ? 's' : ''}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Will sync automatically when you're back online
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Saved Items */}
                {savedItems.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mb-8"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Bookmark className="w-5 h-5 text-[#EB76C2]" />
                            <h2 className="text-xl font-playfair font-bold">Saved Items</h2>
                            <span className="text-sm text-muted-foreground">({savedItems.length})</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {savedItems.slice(0, 8).map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 * index }}
                                >
                                    <Card className="overflow-hidden border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
                                        <div className="aspect-[3/4] bg-muted">
                                            {item.imageUrl && (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <CardContent className="p-3">
                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                            {item.price && (
                                                <p className="text-sm text-muted-foreground">₹{item.price}</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Recently Viewed */}
                {recentlyViewed.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mb-8"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-[#A855F7]" />
                            <h2 className="text-xl font-playfair font-bold">Recently Viewed</h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {recentlyViewed.slice(0, 8).map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 * index }}
                                >
                                    <Card className="overflow-hidden border-0 bg-white/60 backdrop-blur-sm">
                                        <div className="aspect-[3/4] bg-muted">
                                            {item.imageUrl && (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover opacity-80"
                                                />
                                            )}
                                        </div>
                                        <CardContent className="p-3">
                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* No cached content */}
                {savedItems.length === 0 && recentlyViewed.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                            <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">
                            No cached items available. Browse products while online to save them for offline viewing.
                        </p>
                    </motion.div>
                )}

                {/* Retry Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-center mt-8"
                >
                    <Button
                        onClick={handleRetry}
                        size="lg"
                        className="bg-gradient-to-r from-[#EB76C2] to-[#C084FC] hover:from-[#E056A0] hover:to-[#A855F7] text-white font-semibold px-8 shadow-lg shadow-[#EB76C2]/30"
                    >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Try Again
                    </Button>
                </motion.div>
            </div>
        </div>
    );
};

export default OfflinePage;
