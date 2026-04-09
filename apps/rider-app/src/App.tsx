/**
 * Rider App - Entry Point
 * 
 * NO ROLE SWITCHING RULE:
 * Users do not switch roles inside an app.
 * Role mismatch results in a blocking screen, not a redirect.
 */

import { Routes, Route, Navigate, useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ScanLine } from 'lucide-react';
import { QRScannerOverlay } from './components/QRScannerOverlay';
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
import { AvailableRidesPage } from './pages/AvailableRidesPage';
import { InstallPrompt } from './components/InstallPrompt';
import {
    ensurePushSubscription,
    getPermissionState,
    isPushSupported,
    subscribeToPush,
} from './services/pushNotificationService';

function App() {
    const { loading, user } = useAuth();
    const { startWatching, stopWatching } = useLocation();
    const [isRider, setIsRider] = useState<boolean | null>(null);
    const [riderCheckLoading, setRiderCheckLoading] = useState(false);
    const [showGlobalQR, setShowGlobalQR] = useState(false);
    const routerPath = useRouterLocation().pathname;
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

    // Pages with their own QR button — don't show the global one there
    const pagesWithOwnQR = routerPath === '/' ||
        routerPath.startsWith('/delivery/') ||
        routerPath.startsWith('/warehouse/');

    return (
        <>
        <PushNotificationManager enabled={isRider === true} />
        <InstallPrompt />
        {!pagesWithOwnQR && (
            <button
                onClick={() => setShowGlobalQR(true)}
                className="fixed top-4 right-4 z-40 w-10 h-10 rounded-full bg-zinc-900/90 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-sm hover:bg-zinc-800 active:scale-90 transition-all"
                aria-label="Scan QR Code"
            >
                <ScanLine size={18} className="text-zinc-300" />
            </button>
        )}
        {showGlobalQR && <QRScannerOverlay onClose={() => setShowGlobalQR(false)} />}
        <Routes>
            {/* Home / Dashboard */}
            <Route path="/" element={<HomePage />} />
            <Route path="/available-rides" element={<AvailableRidesPage />} />

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

function PushNotificationManager({ enabled }: { enabled: boolean }) {
    const navigate = useNavigate();
    const location = useRouterLocation();
    const { user } = useAuth();

    useEffect(() => {
        if (!enabled || !("serviceWorker" in navigator)) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK') {
                navigate(event.data.url || '/');
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, [enabled, navigate]);

    useEffect(() => {
        if (!enabled || !user || !isPushSupported()) return;
        if (getPermissionState() !== 'granted') return;

        void ensurePushSubscription();
    }, [enabled, user?.id]);

    useEffect(() => {
        if (!enabled || !user || !isPushSupported()) return;
        if (location.pathname !== '/') return;
        if (getPermissionState() !== 'default') return;
        if (sessionStorage.getItem('rider_push_prompt_seen')) return;

        const timer = window.setTimeout(() => {
            sessionStorage.setItem('rider_push_prompt_seen', 'true');
            void subscribeToPush();
        }, 3000);

        return () => window.clearTimeout(timer);
    }, [enabled, location.pathname, user?.id]);

    return null;
}
