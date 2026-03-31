/**
 * Rider App - Entry Point
 * 
 * NO ROLE SWITCHING RULE:
 * Users do not switch roles inside an app.
 * Role mismatch results in a blocking screen, not a redirect.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@popclozet/auth';
import { Loader, WrongRoleScreen } from '@popclozet/ui';
import { supabase } from '@popclozet/api-client';
import { useLocation } from './contexts/LocationContext';

// Legacy pages (existing)
import { RiderDashboardPage } from './pages/RiderDashboardPage';
import { DeliveryNavigationPage } from './pages/DeliveryNavigationPage';
import { WarehouseNavigationPage } from './pages/WarehouseNavigationPage';

// New integrated pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AuthOtpPage } from './pages/AuthOtpPage';
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
// map-core reads VITE_MAPPLS_REST_KEY directly at module scope — no init needed here
import { InstallPrompt } from './components/InstallPrompt';

function App() {
    const { loading, user } = useAuth();
    const { startWatching, stopWatching } = useLocation();
    const [isRider, setIsRider] = useState<boolean | null>(null);
    const [riderCheckLoading, setRiderCheckLoading] = useState(false);
    // Track which user ID we already checked to prevent re-check on token refresh
    const checkedUserIdRef = useRef<string | null>(null);

    // Check riders table directly — independent of profiles.role
    // This lets a person be a customer on customer-app AND a rider here simultaneously.
    // Dep is user?.id (not user) so a token refresh (new object, same ID) does NOT re-run
    // this and flash the loading screen, which would unmount active pages mid-flow.
    useEffect(() => {
        if (!user) {
            setIsRider(null);
            checkedUserIdRef.current = null;
            return;
        }
        // Already checked for this user — skip to avoid reload on token refresh
        if (checkedUserIdRef.current === user.id) return;
        checkedUserIdRef.current = user.id;

        setRiderCheckLoading(true);
        supabase
            .from('riders')
            .select('id')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                setIsRider(!!data);
                setRiderCheckLoading(false);
            });
    }, [user?.id]);

    // Handle global location tracking
    useEffect(() => {
        if (isRider && user) {
            const isOnline = localStorage.getItem('rider_is_online') === 'true';
            if (isOnline) {
                startWatching();
            } else {
                stopWatching();
            }
        } else {
            stopWatching();
        }
    }, [isRider, user, startWatching, stopWatching]);

    // Show loader while checking auth or rider status
    if (loading || riderCheckLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader size="lg" text="Loading..." />
            </div>
        );
    }

    // Not authenticated: show auth routes (phone OTP flow)
    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth-otp" element={<AuthOtpPage />} />
                <Route path="/signup" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    // Logged in but no rider profile yet → complete registration
    if (isRider === false) {
        return (
            <Routes>
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/complete-rider-registration" element={<SignupPage initialStep={3} />} />
                <Route path="*" element={<Navigate to="/complete-rider-registration" replace />} />
            </Routes>
        );
    }

    return (
        <>
        <InstallPrompt />
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
        </>
    );
}

export default App;
