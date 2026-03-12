/**
 * Wallet Page
 * 
 * Displays rider wallet balance, transactions, and withdrawal options
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, IndianRupee, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

import { RiderShell } from '../components/layout/RiderShell';
import { BottomNavigation } from '../components/BottomNavigation';
import {
    getWalletBalance,
    getTransactions,
    type WalletBalance,
    type Transaction
} from '../services/walletService';

const transactionIcons = {
    earning: ArrowDownLeft,
    bonus: TrendingUp,
    withdrawal: ArrowUpRight,
    refund: ArrowDownLeft,
};

const transactionColors = {
    earning: 'text-green-500',
    bonus: 'text-amber-500',
    withdrawal: 'text-red-500',
    refund: 'text-blue-500',
};

export function WalletPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [balance, setBalance] = useState<WalletBalance | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'earnings' | 'withdrawals'>('all');

    useEffect(() => {
        if (user?.id) {
            Promise.all([
                getWalletBalance(user.id),
                getTransactions(user.id, 20),
            ]).then(([bal, txs]) => {
                setBalance(bal);
                setTransactions(txs);
                setIsLoading(false);
            });
        }
    }, [user?.id]);

    const filteredTransactions = transactions.filter(tx => {
        if (activeTab === 'all') return true;
        if (activeTab === 'earnings') return ['earning', 'bonus'].includes(tx.type);
        if (activeTab === 'withdrawals') return tx.type === 'withdrawal';
        return true;
    });

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <RiderShell>
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Wallet</h1>
                </div>
            </header>

            <main className="px-4 py-6 space-y-6 flex-1">
                {/* Balance Card */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white"
                >
                    <p className="text-blue-200 text-sm mb-1">Available Balance</p>
                    <div className="flex items-center gap-2 mb-4">
                        <IndianRupee size={32} />
                        <span className="text-4xl font-bold">
                            {isLoading ? '---' : (balance?.balance.toLocaleString() || '0')}
                        </span>
                    </div>

                    {balance?.pendingWithdrawals ? (
                        <p className="text-blue-200 text-sm flex items-center gap-1">
                            <Clock size={14} />
                            ₹{balance.pendingWithdrawals} pending withdrawal
                        </p>
                    ) : null}

                    {/* Action buttons */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={() => navigate('/withdraw')}
                            className="flex-1 py-2.5 rounded-xl bg-white/20 backdrop-blur font-medium hover:bg-white/30 transition-colors"
                        >
                            Withdraw
                        </button>
                        <button
                            onClick={() => navigate('/earnings')}
                            className="flex-1 py-2.5 rounded-xl bg-white text-blue-600 font-medium hover:bg-blue-50 transition-colors"
                        >
                            View Earnings
                        </button>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-2 bg-zinc-900 rounded-xl p-1">
                    {(['all', 'earnings', 'withdrawals'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
                                activeTab === tab
                                    ? "bg-zinc-800 text-white"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Transactions list */}
                <div className="space-y-3">
                    <h2 className="text-sm font-medium text-zinc-500">Recent Transactions</h2>

                    {isLoading ? (
                        // Loading skeleton
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800" />
                                    <div className="flex-1">
                                        <div className="h-4 w-24 bg-zinc-800 rounded mb-2" />
                                        <div className="h-3 w-16 bg-zinc-800 rounded" />
                                    </div>
                                    <div className="h-5 w-12 bg-zinc-800 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-zinc-500">No transactions yet</p>
                        </div>
                    ) : (
                        filteredTransactions.map((tx, index) => {
                            const Icon = transactionIcons[tx.type];
                            const colorClass = transactionColors[tx.type];
                            const isPositive = ['earning', 'bonus', 'refund'].includes(tx.type);

                            return (
                                <motion.div
                                    key={tx.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900"
                                >
                                    <div className={clsx(
                                        "w-10 h-10 rounded-full flex items-center justify-center",
                                        tx.type === 'earning' && "bg-green-500/10",
                                        tx.type === 'bonus' && "bg-amber-500/10",
                                        tx.type === 'withdrawal' && "bg-red-500/10",
                                        tx.type === 'refund' && "bg-blue-500/10"
                                    )}>
                                        <Icon size={20} className={colorClass} />
                                    </div>

                                    <div className="flex-1">
                                        <p className="text-white font-medium capitalize">{tx.type}</p>
                                        <p className="text-xs text-zinc-500">{formatDate(tx.createdAt)}</p>
                                    </div>

                                    <span className={clsx(
                                        "font-semibold",
                                        isPositive ? "text-green-500" : "text-red-500"
                                    )}>
                                        {isPositive ? '+' : '-'}₹{tx.amount}
                                    </span>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </main>

            <BottomNavigation />
        </RiderShell>
    );
}

export default WalletPage;
