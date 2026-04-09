/**
 * Warehouse App - Entry Point
 *
 * Role-gated to 'warehouse' users only.
 * Uses mobile-first layout with WarehouseShell + BottomNavigation.
 * Supports dev mode (localStorage flag) to skip auth for testing.
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Loader, WrongRoleScreen } from '@popclozet/ui';
import { WarehouseShell } from './components/layout/WarehouseShell';
import { BottomNavigation } from './components/BottomNavigation';
import { GlobalOrderListener } from './components/GlobalOrderListener';
import { MapProvider } from './contexts/MapContext';
import { WarehouseBadgeProvider } from './contexts/WarehouseBadgeContext';

// Pages
import { InstallPrompt } from './components/InstallPrompt';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { WashCyclePage } from './pages/WashCyclePage';
import { OrderFulfillmentPage } from './pages/OrderFulfillmentPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { DispatchPage } from './pages/DispatchPage';
import { ProductIntakePage } from './pages/ProductIntakePage';
import { SettingsPage } from './pages/SettingsPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ActivePickupsPage } from './pages/ActivePickupsPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { ProductProfilePage } from './pages/ProductProfilePage';
import { CategoryManagementPage } from './pages/CategoryManagementPage';

function App() {
    const { profile, loading, user, recoverFromStuckAuth } = useAuth();
    const [showRecovery, setShowRecovery] = useState(false);

    useEffect(() => {
        if (!loading) {
            setShowRecovery(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setShowRecovery(true);
        }, 6000);

        return () => window.clearTimeout(timer);
    }, [loading]);

    if (loading) {
        return (
            <WarehouseShell hideBottomNav>
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <Loader size="lg" text="Loading Warehouse..." />
                        {showRecovery ? (
                            <>
                                <p className="max-w-xs text-xs text-zinc-500">
                                    The app is taking longer than expected. Reset the cached session and continue to login.
                                </p>
                                <button
                                    type="button"
                                    onClick={recoverFromStuckAuth}
                                    className="rounded-xl border border-warehouse-500/30 bg-warehouse-500/10 px-4 py-2 text-sm font-semibold text-warehouse-300 transition-colors hover:bg-warehouse-500/20"
                                >
                                    Reset Session
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
            </WarehouseShell>
        );
    }

    // Not authenticated
    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    // Role check: Allow 'warehouse' and 'admin' roles
    const isAuthorized = profile?.role === 'warehouse' || profile?.role === 'admin';
    if (profile && !isAuthorized) {
        return <WrongRoleScreen expectedRole="warehouse" currentRole={profile.role} />;
    }

    return (
        <MapProvider>
            <WarehouseBadgeProvider>
                <InstallPrompt />
                <Routes>
                {/* Full-screen overlay routes — rendered outside shell so they cover bottom nav */}
                <Route path="/track/:orderId" element={<OrderTrackingPage />} />

                {/* Standard Dashboard Routes wrapped in Shell */}
                <Route path="*" element={
                    <WarehouseShell>
                        <GlobalOrderListener />
                        <main className="flex-1 overflow-y-auto">
                            <Routes>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/inventory" element={<InventoryPage />} />
                                <Route path="/wash" element={<WashCyclePage />} />
                                <Route path="/orders" element={<OrderFulfillmentPage />} />
                                <Route path="/returns" element={<ReturnsPage />} />
                                <Route path="/dispatch" element={<DispatchPage />} />
                                <Route path="/intake" element={<ProductIntakePage />} />
                                <Route path="/active-pickups" element={<ActivePickupsPage />} />
                                <Route path="/order-history" element={<OrderHistoryPage />} />
                                <Route path="/live-map" element={<LiveMapPage />} />
                                <Route path="/categories" element={<CategoryManagementPage />} />
                                <Route path="/product/:productId" element={<ProductProfilePage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </main>
                        <BottomNavigation />
                    </WarehouseShell>
                } />
            </Routes>
            </WarehouseBadgeProvider>
        </MapProvider>
    );
}

export default App;
