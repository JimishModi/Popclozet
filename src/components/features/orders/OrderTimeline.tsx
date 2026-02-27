import React from 'react';
import type { OrderStatus } from '@/types';
import { motion } from 'framer-motion';

interface OrderTimelineProps {
    status: OrderStatus;
}

const timelineSteps = [
    { key: 'pending', label: 'Order Placed', icon: '📦' },
    { key: 'confirmed', label: 'Confirmed', icon: '✅' },
    { key: 'packed', label: 'Packed', icon: '📋' },
    { key: 'dispatched', label: 'Dispatched', icon: '🚚' },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🛵' },
    { key: 'delivered', label: 'Delivered', icon: '🎉' },
];

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ status }) => {
    const currentStepIndex = timelineSteps.findIndex((step) => step.key === status);

    return (
        <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Progress</h2>

            <div className="relative">
                {timelineSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                        <div key={step.key} className="flex items-start gap-4 mb-8 last:mb-0">
                            {/* Icon */}
                            <div className="relative flex-shrink-0">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-xl
                    ${isCompleted
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-gray-200 text-gray-400'
                                        }
                    ${isCurrent ? 'ring-4 ring-primary-200 animate-pulse-slow' : ''}
                  `}
                                >
                                    {step.icon}
                                </motion.div>

                                {/* Connecting Line */}
                                {index < timelineSteps.length - 1 && (
                                    <div
                                        className={`
                      absolute left-6 top-12 w-0.5 h-8
                      ${isCompleted ? 'bg-primary-500' : 'bg-gray-200'}
                    `}
                                    />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-2">
                                <h3
                                    className={`
                    font-semibold
                    ${isCompleted ? 'text-gray-900' : 'text-gray-400'}
                  `}
                                >
                                    {step.label}
                                </h3>
                                {isCurrent && (
                                    <p className="text-sm text-primary-500 mt-1 font-medium">In Progress</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
