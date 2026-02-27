import React from 'react';
import type { HygieneInfo } from '@/types';
import { formatRelativeTime } from '@/utils/date';

interface HygieneBadgeProps {
    hygieneInfo: HygieneInfo;
}

export const HygieneBadge: React.FC<HygieneBadgeProps> = ({ hygieneInfo }) => {
    const getRatingColor = (rating: string) => {
        switch (rating) {
            case 'A+':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'A':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'B':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="card border-2 border-green-200 bg-green-50">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        Hygiene Guaranteed
                        <span className={`badge ${getRatingColor(hygieneInfo.hygiene_rating)}`}>
                            {hygieneInfo.hygiene_rating}
                        </span>
                    </h3>
                    <div className="space-y-1 text-sm text-gray-700">
                        <p>✓ Last sanitized: {formatRelativeTime(hygieneInfo.last_sanitized)}</p>
                        <p>✓ Method: {hygieneInfo.sanitization_method}</p>
                        <p>✓ {hygieneInfo.is_sealed ? 'Sealed packaging' : 'Quality checked'}</p>
                        <p>✓ Rental count: {hygieneInfo.lifecycle_count} times</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
