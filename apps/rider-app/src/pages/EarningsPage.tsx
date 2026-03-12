/**
 * Earnings Page
 * 
 * Detailed earnings breakdown and history
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { ArrowLeft, TrendingUp, IndianRupee, Package, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { getEarningsSummary, getTransactionsByType, type EarningsSummary, type Transaction } from '../services/walletService';

type Period = 'today' | 'week' | 'month';

export function EarningsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [summary, setSummary] = useState<EarningsSummary | null>(null);
    const [recentEarnings, setRecentEarnings] = useState<Transaction[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            Promise.all([
                getEarningsSummary(user.id),
                getTransactionsByType(user.id, 'earning', 10),
            ]).then(([sum, txs]) => {
                setSummary(sum);
                setRecentEarnings(txs);
                setIsLoading(false);
            });
        }
    }, [user?.id]);

    const periodData = {
        today: { amount: summary?.today || 0, orders: summary?.ordersToday || 0 },
        week: { amount: summary?.thisWeek || 0, orders: 28 },
        month: { amount: summary?.thisMonth || 0, orders: 112 },
    };

    const current = periodData[selectedPeriod];

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Earnings</h1>
                </div>
            </header>

            <main className="px-4 py-6 space-y-6">
                {/* Period Selector */}
                <div className="flex gap-2 bg-zinc-900 rounded-xl p-1">
                    {(['today', 'week', 'month'] as const).map((period) => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
                                selectedPeriod === period
                                    ? "bg-green-500 text-white"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}
                        </button>
                    ))}
                </div>

                {/* Earnings Card */}
                <motion.div
                    key={selectedPeriod}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-6 text-white"
                >
                    <div className="flex items-center gap-2 text-green-200 text-sm mb-2">
                        <TrendingUp size={16} />
                        <span>Total Earnings</span>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <IndianRupee size={32} />
                        <span className="text-4xl font-bold">
                            {isLoading ? '---' : current.amount.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Package size={16} className="text-green-200" />
                            <span>{current.orders} orders</span>
                        </div>
                        {summary?.bonusToday && selectedPeriod === 'today' && (
                            <div className="flex items-center gap-2">
                                <Gift size={16} className="text-green-200" />
                                <span>₹{summary.bonusToday} bonus</span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                        <p className="text-xs text-zinc-500 mb-1">Avg per Order</p>
                        <p className="text-2xl font-bold text-white">
                            ₹{summary?.avgPerOrder.toFixed(0) || 0}
                        </p>
                    </div>
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                        <p className="text-xs text-zinc-500 mb-1">Bonus Earned</p>
                        <p className="text-2xl font-bold text-amber-500">
                            ₹{summary?.bonusToday || 0}
                        </p>
                    </div>
                </div>

                {/* Performance Tips */}
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                    <h3 className="text-sm font-medium text-blue-400 mb-2">💡 Tip to earn more</h3>
                    <p className="text-sm text-zinc-400">
                        Complete 2 more deliveries today to unlock a ₹50 bonus!
                        Peak hours (6-9 PM) have 1.5x incentives.
                    </p>
                </div>

                {/* Recent Earnings */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-medium text-zinc-500">Recent Earnings</h2>
                        <button
                            onClick={() => navigate('/wallet')}
                            className="text-sm text-blue-500 hover:text-blue-400"
                        >
                            View All
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 rounded-xl bg-zinc-900 animate-pulse" />
                            ))}
                        </div>
                    ) : recentEarnings.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-zinc-500">No earnings yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentEarnings.map((earning, index) => (
                                <motion.div
                                    key={earning.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                            <Package size={18} className="text-green-500" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">
                                                {earning.description || 'Delivery'}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {formatTime(earning.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-green-500 font-semibold">
                                        +₹{earning.amount}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default EarningsPage;
