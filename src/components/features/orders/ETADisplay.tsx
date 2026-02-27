import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatRelativeTime } from '@/utils/date';
import type { ProximityState } from '@/types';

interface ETADisplayProps {
    eta?: string;
    proximityStatus: ProximityState['status'];
}

export const ETADisplay: React.FC<ETADisplayProps> = ({ eta, proximityStatus }) => {
    const [timeRemaining, setTimeRemaining] = useState('');

    useEffect(() => {
        if (eta) {
            const interval = setInterval(() => {
                setTimeRemaining(formatRelativeTime(eta));
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [eta]);

    const getStatusMessage = () => {
        switch (proximityStatus) {
            case 'arrived':
                return {
                    title: '🎉 Rider has arrived!',
                    subtitle: 'Please check your OTP and collect your order',
                    color: 'bg-green-50 border-green-200',
                    textColor: 'text-green-800',
                };
            case 'near':
                return {
                    title: '🛵 Arriving soon!',
                    subtitle: `Your rider is nearby - ${timeRemaining}`,
                    color: 'bg-primary-50 border-primary-300',
                    textColor: 'text-primary-700',
                };
            default:
                return {
                    title: '📦 On the way',
                    subtitle: eta ? `Estimated arrival: ${timeRemaining}` : 'Preparing for delivery',
                    color: 'bg-blue-50 border-blue-200',
                    textColor: 'text-blue-800',
                };
        }
    };

    const statusInfo = getStatusMessage();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`card border-2 ${statusInfo.color}`}
        >
            <div className="text-center">
                <h2 className={`text-2xl font-bold mb-2 ${statusInfo.textColor}`}>
                    {statusInfo.title}
                </h2>
                <p className={`text-lg ${statusInfo.textColor}`}>
                    {statusInfo.subtitle}
                </p>

                {proximityStatus === 'near' && (
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="mt-4"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-full shadow-md">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-sm font-medium">Tracking rider location</span>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};
