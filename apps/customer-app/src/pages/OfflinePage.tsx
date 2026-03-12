import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Bookmark, Clock, ShoppingBag, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
const OfflinePage: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
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

                {/* No cached content */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                        Please check your internet connection and try again.
                    </p>
                </motion.div>

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
