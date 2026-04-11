// Vercel trigger-deploy: ensure latest checkout and bottom nav fixes are live
import { Toaster } from "@/components/ui/toaster";
import AuthGate from "@/components/auth/AuthGate";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import PageTransition from "./components/PageTransition";
import ScrollProgress from "./components/ScrollProgress";
import MobileHome from "./pages/MobileHome";
import LandingPage from "./pages/LandingPage";
import React, { lazy, useEffect, useState, Suspense } from "react";
import { MobileShell } from "./components/layout/MobileShell";
import { BottomNavBar } from "./components/layout/BottomNavBar";
import ScrollToTop from "./components/ScrollToTop";

import { SupabaseAuthProvider } from "./context/SupabaseAuthContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { FlyToCartProvider } from "./context/FlyToCartContext";

import { WelcomeScreen } from "./components/WelcomeScreen";
import { InstallPrompt } from "./components/InstallPrompt";
import { UpdatePrompt } from "./components/pwa/UpdatePrompt";
import { recoverPendingVerifications, recoverPendingCancellations } from "./services/razorpayService";
import { toast } from "sonner";
import { useAuth } from "./context/SupabaseAuthContext";
import { usePushNotifications } from "./hooks/usePushNotifications";

import { LocationGate } from "@/components/location/LocationGate";
import { CitySelectorModal } from "@/components/CitySelectorModal";
import { MandatoryReviewGate } from "@/components/MandatoryReviewGate";
import { clearReloadGuard, hasReloadGuard, safeGetSessionStorageItem, safeSetSessionStorageItem, setReloadGuard } from "@/lib/reloadGuard";
import { useStandalonePullToRefresh } from "@/hooks/useStandalonePullToRefresh";


// Retry dynamic imports once with a page reload to handle stale chunk hashes after deploys
// iOS Safari PWA (standalone mode) can throw on sessionStorage access — wrap in try/catch
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType<unknown> }>) {
  return lazy(() =>
    importFn().catch((error) => {
      if (!hasReloadGuard("chunk_reload")) {
        setReloadGuard("chunk_reload");
        window.location.reload();
        return new Promise(() => {}); // never resolves — page is reloading
      }

      clearReloadGuard("chunk_reload");
      throw error;
    })
  );
}

// ErrorBoundary — prevents the entire app from going white on unhandled errors (iOS Safari)
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static isWebSocketError(error: Error | null): boolean {
    const msg = error?.message ?? '';
    return (
      msg.includes('The operation is insecure') ||
      msg.includes('WebSocket') ||
      msg.includes('wss://') ||
      msg.includes('ws://')
    );
  }

  static getDerivedStateFromError(error: Error) {
    // WebSocket errors: don't show crash screen — let the app continue without realtime
    if (AppErrorBoundary.isWebSocketError(error)) {
      console.warn('[AppErrorBoundary] WebSocket error caught — silently recovering:', error.message);
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (AppErrorBoundary.isWebSocketError(error)) {
      // Already handled in getDerivedStateFromError — no crash screen
      return;
    }
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: '#a1a1aa', textAlign: 'center', maxWidth: 300 }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/home'; }}
            style={{ marginTop: 8, padding: '12px 28px', borderRadius: 14, background: '#f2546d', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy pages
const SignInPage = lazyWithRetry(() => import("./pages/SignInPage"));
const SignUpPage = lazyWithRetry(() => import("./pages/SignUpPage"));
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"));
const OtpVerificationPage = lazyWithRetry(() => import("./pages/OtpVerificationPage"));
const EmailVerifyCallbackPage = lazyWithRetry(() => import("./pages/EmailVerifyCallbackPage"));
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"));
const CollectionsPage = lazyWithRetry(() => import("./pages/CollectionsPage"));
const CategoryProductsPage = lazyWithRetry(() => import("./pages/CategoryProductsPage"));
const ClosetPage = lazyWithRetry(() => import("./pages/ClosetPage"));
const LiveClosetPage = lazyWithRetry(() => import("./pages/LiveClosetPage"));
const HowItWorksPage = lazyWithRetry(() => import("./pages/HowItWorksPage"));
const CartPage = lazyWithRetry(() => import("./pages/CartPage"));
const CreateAccountPage = lazyWithRetry(() => import("./pages/CreateAccountPage"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const MapLocationPage = lazyWithRetry(() => import("./pages/MapLocationPage"));
const DeliveryTrackingPage = lazyWithRetry(() => import("./pages/DeliveryTrackingPage"));
const AddressSelectionPage = lazyWithRetry(() => import("./pages/AddressSelectionPage"));
const AddressAccuracyPage = lazyWithRetry(() => import("./pages/AddressAccuracyPage"));
const ScheduleReturnPage = lazyWithRetry(() => import("./pages/ScheduleReturnPage"));
const CheckoutReturnSchedulePage = lazyWithRetry(() => import("./pages/CheckoutReturnSchedulePage"));
const WelcomePage = lazyWithRetry(() => import("./pages/WelcomePage"));
const OnboardingPage = lazyWithRetry(() => import("./pages/OnboardingPage"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const SignOutPage = lazyWithRetry(() => import("./pages/SignOutPage"));
const OrderConfirmedPage = lazyWithRetry(() => import("./pages/OrderConfirmedPage"));
// const SubscriptionPlansPage = lazyWithRetry(() => import("./pages/SubscriptionPlansPage"));
const PaymentProcessingPage = lazyWithRetry(() => import("./pages/PaymentProcessingPage"));
const PaymentSuccessPage = lazyWithRetry(() => import("./pages/PaymentSuccessPage"));
const PaymentFailedPage = lazyWithRetry(() => import("./pages/PaymentFailedPage"));
// const SubscriptionProfilePage = lazyWithRetry(() => import("./pages/SubscriptionProfilePage"));
// Direct imports
import QRHygienePage from "./pages/QRHygienePage";
import QRScannerPage from "./pages/QRScannerPage";
import ProductIntakePage from "./pages/ProductIntakePage";
import AdminHygieneDashboard from "./pages/AdminHygieneDashboard";
import ProductQRGalleryPage from "./pages/ProductQRGalleryPage";
import MobileProductDetailPage from "./pages/MobileProductDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import OfflinePage from "./pages/OfflinePage";
import NotFound from "./pages/NotFound";
import SearchResultsPage from "./pages/SearchResultsPage";
import BrandsPage from "./pages/BrandsPage";

import OrdersPage from "./pages/OrdersPage";
import GenderCategoryPage from "./pages/GenderCategoryPage";
import MoodPage from "./pages/MoodPage";
import PickupConfirmationPage from "./pages/PickupConfirmationPage";
import PickupTrackingPage from "./pages/PickupTrackingPage";
import OrderDeliveredPage from "./pages/OrderDeliveredPage";
import VirtualTryOnPage from "./pages/VirtualTryOnPage";
import WelcomeGridPage from "./pages/WelcomeGridPage";
import WelcomeGridPage2 from "./pages/WelcomeGridPage2";
import WishlistPage from "./pages/WishlistPage";
import PaymentsPage from "./pages/PaymentsPage";
import NotificationsPage from "./pages/NotificationsPage";
import HelpPage from "./pages/HelpPage";
import PrivacyPage from "./pages/PrivacyPage";
import CookiePolicyPage from "./pages/CookiePolicyPage";
import TermsPage from "./pages/TermsPage";
import AboutUsProcessPage from "./pages/AboutUsProcessPage";

import { configureMapbox } from '@popclozet/map-core';

// Ensure WebWorker has access to Mapbox Token globally on init
if (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
  configureMapbox(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);
}

const queryClient = new QueryClient();

function App() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);

  useStandalonePullToRefresh();

  useEffect(() => {
    if (!showWelcome && typeof window !== "undefined") {
      safeSetSessionStorageItem("welcomeSeen", "true");
    }
  }, [showWelcome]);

  useEffect(() => {
    let hasGps: string | null = null;
    let hasManual: string | null = null;

    try {
      hasGps = localStorage.getItem("user_location");
      hasManual = localStorage.getItem("service_availability");
    } catch {
      return;
    }

    if (!hasGps && !hasManual) {
      setShowCitySelector(true);
    }
  }, []);

  // Recover any interrupted payment verifications or cancellations
  useEffect(() => {
    const runRecovery = async () => {
      const results = await recoverPendingVerifications();
      for (const r of results) {
        if (r.status === 'confirmed') {
          toast.success(`Your payment for order has been confirmed!`);
        } else if (r.status === 'pending') {
          toast.info('We\'re still verifying a recent payment. This usually takes a few minutes.');
        } else if (r.status === 'cancelled') {
          toast.info('A recent order was cancelled. If money was deducted, it will be refunded within 5-7 business days.');
        }
      }
      await recoverPendingCancellations();
    };

    runRecovery();

    // Also run recovery when the app regains focus (user returns after being offline)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRecovery();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Analytics />
      <SupabaseAuthProvider>
        <AuthGate>
          <CartProvider>
            <WishlistProvider>
              <FlyToCartProvider>
                <TooltipProvider>
                  <ScrollToTop />
                  {/* SYSTEM UI */}
                  <ScrollProgress />
                  <Toaster />
                  <Sonner />
                  <UpdatePrompt />
                  <PushNotificationManager />

                  {/* LOCATION */}
                  <LocationGate />
                  <MandatoryReviewGate />
                  <CitySelectorModal
                    open={showCitySelector}
                    onClose={() => setShowCitySelector(false)}
                  />

                  {showWelcome && (
                    <WelcomeScreen onComplete={() => setShowWelcome(false)} />
                  )}

                  {/* ROUTES */}
                  {/* ROUTES CONTAINER with persistent background to prevent flashes */}
                  <AppErrorBoundary>
                  <GlobalLayout>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="w-full min-h-screen"
                      >
                        <Routes location={location}>
                          <Route path="/" element={<Navigate to="/home" replace />} />
                          <Route path="/home" element={<PageTransition><MobileHome /></PageTransition>} />

                          <Route path="/signin" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignInPage /></Suspense></PageTransition>} />
                        <Route path="/signup" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignUpPage /></Suspense></PageTransition>} />
                        <Route path="/auth/login" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><LoginPage /></Suspense></PageTransition>} />
                        <Route path="/auth/otp" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><OtpVerificationPage /></Suspense></PageTransition>} />
                        <Route path="/auth/create-account" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><CreateAccountPage /></Suspense></PageTransition>} />
                        <Route path="/auth/callback" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><AuthCallback /></Suspense></PageTransition>} />
                        <Route path="/auth/verify-email-callback" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><EmailVerifyCallbackPage /></Suspense></PageTransition>} />
                        <Route path="/auth/signout" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignOutPage /></Suspense></PageTransition>} />
                          <Route path="/cart" element={<PageTransition><CartPage /></PageTransition>} />
                          <Route path="/checkout/address" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><AddressSelectionPage /></Suspense></PageTransition>} />
                          <Route path="/checkout/address-details" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><AddressAccuracyPage /></Suspense></PageTransition>} />
                          <Route path="/checkout/return-schedule" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><CheckoutReturnSchedulePage /></Suspense></PageTransition>} />
                          <Route path="/checkout" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><CheckoutPage /></Suspense></PageTransition>} />
                          <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
                          <Route path="/orders" element={<PageTransition><OrdersPage /></PageTransition>} />
                          <Route path="/wishlist" element={<PageTransition><WishlistPage /></PageTransition>} />
                          <Route path="/payments" element={<PageTransition><PaymentsPage /></PageTransition>} />
                          <Route path="/notifications" element={<PageTransition><NotificationsPage /></PageTransition>} />
                          <Route path="/help" element={<PageTransition><HelpPage /></PageTransition>} />
                          <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
                          <Route path="/cookies" element={<PageTransition><CookiePolicyPage /></PageTransition>} />
                          <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
                          <Route path="/settings" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><SettingsPage /></Suspense></PageTransition>} />
                          <Route path="/order/:orderId/delivered" element={<PageTransition><OrderDeliveredPage /></PageTransition>} />
                          <Route path="/order-confirmed/:orderId" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><OrderConfirmedPage /></Suspense></PageTransition>} />

                           <Route path="/map" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><MapLocationPage /></Suspense></PageTransition>} />
                           <Route path="/map-location" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><MapLocationPage /></Suspense></PageTransition>} />

                          <Route path="/tracking/:orderId" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}><DeliveryTrackingPage /></Suspense></PageTransition>} />

                          <Route path="/collections" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><CollectionsPage /></Suspense></PageTransition>} />
                        <Route path="/shop/:gender" element={<PageTransition><CategoryProductsPage /></PageTransition>} />
                        <Route path="/category" element={<PageTransition><CategoryProductsPage /></PageTransition>} />
                        <Route path="/closet" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><ClosetPage /></Suspense></PageTransition>} />
                        <Route path="/live-closet" element={<PageTransition><LiveClosetPage /></PageTransition>} />
                        <Route path="/product/:id" element={<PageTransition><MobileProductDetailPage /></PageTransition>} />
                        <Route path="/how-it-works" element={<PageTransition><HowItWorksPage /></PageTransition>} />
                        <Route path="/qr-hygiene" element={<PageTransition><QRHygienePage /></PageTransition>} />
                        <Route path="/qr-scanner" element={<PageTransition><QRScannerPage /></PageTransition>} />
                        <Route path="/product-intake" element={<PageTransition><ProductIntakePage /></PageTransition>} />
                        <Route path="/admin/hygiene" element={<PageTransition><AdminHygieneDashboard /></PageTransition>} />
                        <Route path="/product-qr-gallery" element={<PageTransition><ProductQRGalleryPage /></PageTransition>} />
                        <Route path="/schedule-return" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><ScheduleReturnPage /></Suspense></PageTransition>} />
                        <Route path="/schedule-return/:orderId" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><ScheduleReturnPage /></Suspense></PageTransition>} />
                        <Route path="/pickup-confirmation" element={<PageTransition><PickupConfirmationPage /></PageTransition>} />
                        <Route path="/pickup-tracking/:pickupId" element={<PageTransition><PickupTrackingPage /></PageTransition>} />
                        <Route path="/order-delivered/:orderId" element={<PageTransition><OrderDeliveredPage /></PageTransition>} />
                        <Route path="/virtual-try-on" element={<PageTransition><VirtualTryOnPage /></PageTransition>} />
                        <Route path="/welcome" element={<Navigate to="/home" replace />} />
                        <Route path="/welcome-grid" element={<Navigate to="/home" replace />} />
                        <Route path="/welcome-grid-2" element={<Navigate to="/home" replace />} />
                        <Route path="/gender" element={<PageTransition><GenderCategoryPage /></PageTransition>} />
                        <Route path="/mood" element={<PageTransition><MoodPage /></PageTransition>} />
                        <Route path="/onboarding" element={<Navigate to="/home" replace />} />

                          <Route path="/search" element={<PageTransition><SearchResultsPage /></PageTransition>} />
                          <Route path="/brands" element={<PageTransition><BrandsPage /></PageTransition>} />
                          <Route path="/about-us" element={<PageTransition><AboutUsProcessPage /></PageTransition>} />

                        <Route path="/offline" element={<PageTransition><OfflinePage /></PageTransition>} />
                        {/* <Route path="/subscription-plans" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SubscriptionPlansPage /></Suspense></PageTransition>} />
                        <Route path="/subscription-profile" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SubscriptionProfilePage /></Suspense></PageTransition>} /> */}
                        <Route path="/payment-processing" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><PaymentProcessingPage /></Suspense></PageTransition>} />
                        <Route path="/payment-success" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><PaymentSuccessPage /></Suspense></PageTransition>} />
                        <Route path="/payment-failed" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><PaymentFailedPage /></Suspense></PageTransition>} />
                        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                      </Routes>
                    </motion.div>
                  </AnimatePresence>
                </GlobalLayout>
                </AppErrorBoundary>
                </TooltipProvider>
              </FlyToCartProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthGate>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

// Internal component to manage Push Notifications (subscription, clicks, prompts)
function PushNotificationManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const push = usePushNotifications();

  // 1. Listen for clicks from the Service Worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NOTIFICATION_CLICK") {
        console.log("🔔 Handling push notification click navigation to:", event.data.url);
        const urlToNavigate = event.data.url || "/";
        navigate(urlToNavigate);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [navigate]);

  // 2. Auto-subscribe if permission is already granted but sync is missing
  useEffect(() => {
    // Only attempt auto-subscribe if initialization is complete
    if (user && !push.isInitializing && push.isSupported && push.permission === 'granted' && !push.isSubscribed && !push.isLoading) {
      push.autoSubscribe();
    }
  }, [user, push.isInitializing, push.isSupported, push.permission, push.isSubscribed, push.isLoading]);

  // 3. Proactive prompt for new users (if permission is 'default')
  // Trigger the native prompt once they land on home/orders so setup
  // happens inline instead of sending them to Settings manually.
  useEffect(() => {
    const isPushPromptPage = location.pathname === '/home' || location.pathname === '/orders';
    const hasBeenPrompted = safeGetSessionStorageItem('push_prompt_seen');

    if (user && !push.isInitializing && push.isSupported && push.permission === 'default' && isPushPromptPage && !hasBeenPrompted && !push.isLoading) {
      // Delay slightly to not overwhelm on page load
      const timer = setTimeout(() => {
        console.log("[Push] Showing proactive notification prompt...");
        // Mark as prompted so we do not spam the system permission dialog.
        safeSetSessionStorageItem('push_prompt_seen', 'true');

        void push.subscribe();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, location.pathname, push.isInitializing, push.permission, push.isSupported, push.isLoading]);

  return null;
}

// Persistent layout to keep BottomNav and Shell stable during page transitions
const GlobalLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const noNavPaths = ['/', '/signin', '/signup', '/auth', '/welcome', '/onboarding', '/qr-scanner', '/product-intake', '/map'];
  const hideBottomNav = noNavPaths.some(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p)));

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <MobileShell hideBottomNav={hideBottomNav} isGlobalShell={true}>
        {children}
        <InstallPrompt />
      </MobileShell>
    </div>
  );
};

export default App;
