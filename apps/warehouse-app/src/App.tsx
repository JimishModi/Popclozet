/**
 * Warehouse App - Entry Point
 *
 * Role-gated to 'warehouse' users only.
 * Uses mobile-first layout with WarehouseShell + BottomNavigation.
 * Supports dev mode (localStorage flag) to skip auth for testing.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Loader, WrongRoleScreen } from '@popclozet/ui';
import { WarehouseShell } from './components/layout/WarehouseShell';
import { BottomNavigation } from './components/BottomNavigation';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { WashCyclePage } from './pages/WashCyclePage';
import { OrderFulfillmentPage } from './pages/OrderFulfillmentPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { DispatchPage } from './pages/DispatchPage';
import { ProductIntakePage } from './pages/ProductIntakePage';
import { SettingsPage } from './pages/SettingsPage';
import { ProductProfilePage } from './pages/ProductProfilePage';
import { ActivePickupsPage } from './pages/ActivePickupsPage';

function App() {
    const { profile, loading, user } = useAuth();

    if (loading) {
        return (
            <WarehouseShell hideBottomNav>
                <div className="flex-1 flex items-center justify-center">
                    <Loader size="lg" text="Loading Warehouse..." />
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

    // Role check: Only profiles with role='admin' or 'warehouse'
    const hasAccess = profile?.role === 'admin' || profile?.role === 'warehouse';
    if (profile && !hasAccess) {
        return <WrongRoleScreen expectedRole="warehouse" currentRole={profile.role} />;
    }

    return (
        <WarehouseShell>
            <main className="flex-1 overflow-y-auto">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/wash" element={<WashCyclePage />} />
                    <Route path="/orders" element={<OrderFulfillmentPage />} />
                    <Route path="/returns" element={<ReturnsPage />} />
                    <Route path="/dispatch" element={<DispatchPage />} />
                    <Route path="/intake" element={<ProductIntakePage />} />
                    <Route path="/product/:productId" element={<ProductProfilePage />} />
                    <Route path="/active-pickups" element={<ActivePickupsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
            <BottomNavigation />
        </WarehouseShell>
    );
}

export default App;
