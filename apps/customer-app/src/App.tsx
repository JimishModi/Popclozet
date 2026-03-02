import { Toaster } from "@/components/ui/toaster";
import AuthGate from "@/components/auth/AuthGate";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./components/PageTransition";
import ScrollProgress from "./components/ScrollProgress";
import MobileHome from "./pages/MobileHome";
import LandingPage from "./pages/LandingPage";
import { lazy, useEffect, useState, Suspense } from "react";

import { SupabaseAuthProvider } from "./context/SupabaseAuthContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { FlyToCartProvider } from "./context/FlyToCartContext";

import { WelcomeScreen } from "./components/WelcomeScreen";
import { StyleAssistant } from "./components/StyleAssistant";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { InstallPrompt } from "./components/InstallPrompt";
import { SyncNotifications } from "./components/SyncNotifications";
import { useOfflineSync } from "./hooks/useOfflineSync";

import { LocationGate } from "@/components/location/LocationGate";
import { CitySelectorModal } from "@/components/CitySelectorModal";


// Lazy pages
const CartPage = lazy(() => import("./pages/CartPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const ChromaticClosetPage = lazy(() => import("./pages/ChromaticClosetPage"));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const CategoryProductsPage = lazy(() => import("./pages/CategoryProductsPage"));
const ClosetPage = lazy(() => import("./pages/ClosetPage"));
const LiveClosetPage = lazy(() => import("./pages/LiveClosetPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const OtpVerificationPage = lazy(() => import("./pages/OtpVerificationPage"));
const CreateAccountPage = lazy(() => import("./pages/CreateAccountPage"));
const MapLocationPage = lazy(() => import("./pages/MapLocationPage"));
const DeliveryTrackingPage = lazy(() => import("./pages/DeliveryTrackingPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ScheduleReturnPage = lazy(() => import("./pages/ScheduleReturnPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));

// Direct imports
import QRHygienePage from "./pages/QRHygienePage";
import QRScannerPage from "./pages/QRScannerPage";
import ProductIntakePage from "./pages/ProductIntakePage";
import AdminHygieneDashboard from "./pages/AdminHygieneDashboard";
import ProductQRGalleryPage from "./pages/ProductQRGalleryPage";
import MobileProductDetailPage from "./pages/MobileProductDetailPage";
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

const queryClient = new QueryClient();

function App() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);

  useOfflineSync();

  useEffect(() => {
    if (!showWelcome && typeof window !== "undefined") {
      sessionStorage.setItem("welcomeSeen", "true");
    }
  }, [showWelcome]);

  useEffect(() => {
    const hasGps = localStorage.getItem("user_location");
    const hasManual = localStorage.getItem("service_availability");

    if (!hasGps && !hasManual) {
      setShowCitySelector(true);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>

        {/* 🔴 THIS MUST BE ABOVE AUTHGATE */}


        <AuthGate>
          <CartProvider>
            <WishlistProvider>
              <FlyToCartProvider>
                <TooltipProvider>

                  {/* SYSTEM UI */}
                  <ScrollProgress />
                  <Toaster />
                  <Sonner />

                  {/* LOCATION */}
                  <LocationGate />
                  <CitySelectorModal
                    open={showCitySelector}
                    onClose={() => setShowCitySelector(false)}
                  />

                  {showWelcome && (
                    <WelcomeScreen onComplete={() => setShowWelcome(false)} />
                  )}

                  <StyleAssistant />
                  <OfflineIndicator />
                  <InstallPrompt />
                  <SyncNotifications />

                  {/* ROUTES */}
                  <AnimatePresence mode="wait">
                    <div key={location.pathname}>
                      <Routes location={location}>
                        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
                        <Route path="/home" element={<PageTransition><MobileHome /></PageTransition>} />

                        <Route path="/signin" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignInPage /></Suspense></PageTransition>} />
                        <Route path="/signup" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignUpPage /></Suspense></PageTransition>} />
                        <Route path="/auth/login" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><LoginPage /></Suspense></PageTransition>} />
                        <Route path="/auth/otp" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><OtpVerificationPage /></Suspense></PageTransition>} />
                        <Route path="/auth/create-account" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><CreateAccountPage /></Suspense></PageTransition>} />

                        <Route path="/cart" element={<PageTransition><CartPage /></PageTransition>} />
                        <Route path="/checkout" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><CheckoutPage /></Suspense></PageTransition>} />
                        <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
                        <Route path="/orders" element={<PageTransition><OrdersPage /></PageTransition>} />
                        <Route path="/wishlist" element={<PageTransition><WishlistPage /></PageTransition>} />
                        <Route path="/payments" element={<PageTransition><PaymentsPage /></PageTransition>} />
                        <Route path="/notifications" element={<PageTransition><NotificationsPage /></PageTransition>} />
                        <Route path="/help" element={<PageTransition><HelpPage /></PageTransition>} />
                        <Route path="/privacy" element={<PageTransition><PrivacyPage /></PageTransition>} />
                        <Route path="/order/:orderId/delivered" element={<PageTransition><OrderDeliveredPage /></PageTransition>} />

                        <Route path="/map" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><MapLocationPage /></Suspense></PageTransition>} />
                        <Route path="/tracking/:orderId" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><DeliveryTrackingPage /></Suspense></PageTransition>} />

                        {/* Additional explicit routes for all pages to avoid accidental 404s */}
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
                        <Route path="/pickup-confirmation" element={<PageTransition><PickupConfirmationPage /></PageTransition>} />
                        <Route path="/pickup-tracking/:pickupId" element={<PageTransition><PickupTrackingPage /></PageTransition>} />
                        <Route path="/order-delivered/:orderId" element={<PageTransition><OrderDeliveredPage /></PageTransition>} />
                        <Route path="/virtual-try-on" element={<PageTransition><VirtualTryOnPage /></PageTransition>} />
                        <Route path="/welcome" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><WelcomePage /></Suspense></PageTransition>} />
                        <Route path="/welcome-grid" element={<PageTransition><WelcomeGridPage /></PageTransition>} />
                        <Route path="/welcome-grid-2" element={<PageTransition><WelcomeGridPage2 /></PageTransition>} />
                        <Route path="/gender" element={<PageTransition><GenderCategoryPage /></PageTransition>} />
                        <Route path="/mood" element={<PageTransition><MoodPage /></PageTransition>} />
                        <Route path="/onboarding" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><OnboardingPage /></Suspense></PageTransition>} />

                        <Route path="/search" element={<PageTransition><SearchResultsPage /></PageTransition>} />
                        <Route path="/brands" element={<PageTransition><BrandsPage /></PageTransition>} />

                        <Route path="/offline" element={<PageTransition><OfflinePage /></PageTransition>} />
                        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                      </Routes>
                    </div>
                  </AnimatePresence>

                </TooltipProvider>
              </FlyToCartProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthGate>

      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;