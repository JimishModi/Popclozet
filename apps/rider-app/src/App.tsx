/**
 * Rider App - Entry Point
 * 
 * NO ROLE SWITCHING RULE:
 * Users do not switch roles inside an app.
 * Role mismatch results in a blocking screen, not a redirect.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@popclozet/auth';
import { Loader, WrongRoleScreen } from '@popclozet/ui';

// Legacy pages (existing)
import { RiderDashboardPage } from './pages/RiderDashboardPage';
import { DeliveryNavigationPage } from './pages/DeliveryNavigationPage';
import { WarehouseNavigationPage } from './pages/WarehouseNavigationPage';

// New integrated pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { OtpVerificationPage } from './pages/OtpVerificationPage';
import { OrderCompletePage } from './pages/OrderCompletePage';
import { WalletPage } from './pages/WalletPage';
import { ProfilePage } from './pages/ProfilePage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SupportPage } from './pages/SupportPage';
import { SlotsPage } from './pages/SlotsPage';
import { EarningsPage } from './pages/EarningsPage';
import { configureMapbox } from '@popclozet/mapbox-core';

// Ensure WebWorker has access to Mapbox Token globally on init
if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
    configureMapbox(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);
}

function App() {
    const { profile, loading, user } = useAuth();

    // Show loader while checking auth state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading..." />
            </div>
        );
    }

    // Not authenticated: show auth routes
    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    // ROLE CHECK: Block wrong roles with blocking screen
    // Skip if profile hasn't loaded yet (let them use the app)
    if (profile && profile.role && profile.role !== 'rider' && profile.role !== 'customer') {
        return <WrongRoleScreen expectedRole="rider" currentRole={profile.role} />;
    }

    return (
        <Routes>
            {/* Home / Dashboard */}
            <Route path="/" element={<HomePage />} />

            {/* Legacy Dashboard (for backwards compatibility) */}
            <Route path="/dashboard-legacy" element={<RiderDashboardPage />} />

            {/* Warehouse Pickup + Delivery Flow */}
            <Route path="/warehouse/:id" element={<WarehouseNavigationPage />} />
            <Route path="/delivery/:id" element={<DeliveryNavigationPage />} />
            <Route path="/otp-verify/:orderId" element={<OtpVerificationPage />} />
            <Route path="/order-complete" element={<OrderCompletePage />} />

            {/* Orders */}
            <Route path="/orders" element={<OrderHistoryPage />} />

            {/* Wallet & Earnings */}
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/earnings" element={<EarningsPage />} />

            {/* Slots */}
            <Route path="/slots" element={<SlotsPage />} />

            {/* Profile & Settings */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/support" element={<SupportPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
