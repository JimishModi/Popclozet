import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Package, Scan, Settings, Zap } from 'lucide-react';
import QRHygienePage from './QRHygienePage';
import ProductIntakePage from './ProductIntakePage';
import QRScannerPage from './QRScannerPage';
import AdminHygieneDashboard from './AdminHygieneDashboard';

type TabType = 'menu' | 'intake' | 'scanner' | 'dashboard';

interface TabConfig {
    id: TabType;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
}

const tabs: TabConfig[] = [
    { id: 'menu', label: 'Menu', icon: Home, color: '#3B82F6', bgColor: 'bg-blue-500' },
    { id: 'intake', label: 'Intake', icon: Package, color: '#22C55E', bgColor: 'bg-green-500' },
    { id: 'scanner', label: 'Scanner', icon: Scan, color: '#A855F7', bgColor: 'bg-purple-500' },
    { id: 'dashboard', label: 'Admin', icon: Settings, color: '#F59E0B', bgColor: 'bg-amber-500' },
];

const QRHygieneTestPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('menu');

    const renderContent = () => {
        switch (activeTab) {
            case 'menu':
                return <QRHygienePage />;
            case 'intake':
                return <ProductIntakePage />;
            case 'scanner':
                return <QRScannerPage />;
            case 'dashboard':
                return <AdminHygieneDashboard />;
            default:
                return <QRHygienePage />;
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Navigation Bar */}
            <motion.nav
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
            >
                <div className="container mx-auto px-4 py-3 max-w-6xl">
                    <div className="flex items-center justify-between">
                        {/* Logo/Title */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EB76C2] to-[#A855F7] flex items-center justify-center">
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-playfair font-bold text-lg hidden sm:block">
                                Test Environment
                            </span>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-full">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;

                                return (
                                    <motion.button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            relative px-3 sm:px-4 py-2 rounded-full font-medium text-sm
                                            transition-colors duration-200
                                            ${isActive
                                                ? 'text-white'
                                                : 'text-muted-foreground hover:text-foreground'
                                            }
                                        `}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {/* Active background */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className={`absolute inset-0 rounded-full ${tab.bgColor}`}
                                                transition={{ type: "spring", duration: 0.5 }}
                                            />
                                        )}

                                        {/* Content */}
                                        <span className="relative flex items-center gap-1.5">
                                            <Icon className="w-4 h-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* Status Badge */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                Test Mode
                            </span>
                        </div>
                    </div>
                </div>
            </motion.nav>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {renderContent()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default QRHygieneTestPage;
