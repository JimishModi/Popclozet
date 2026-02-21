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
const MoodPage = lazy(() => import("./pages/MoodPage"));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const GenderCategoryPage = lazy(() => import("./pages/GenderCategoryPage"));
const CategoryProductsPage = lazy(() => import("./pages/CategoryProductsPage"));
const ClosetPage = lazy(() => import("./pages/ClosetPage"));
const LiveClosetPage = lazy(() => import("./pages/LiveClosetPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const OtpVerificationPage = lazy(() => import("./pages/OtpVerificationPage"));
const CreateAccountPage = lazy(() => import("./pages/CreateAccountPage"));

// Map & Location pages
const MapLocationPage = lazy(() => import("./pages/MapLocationPage"));
const DeliveryTrackingPage = lazy(() => import("./pages/DeliveryTrackingPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ScheduleReturnPage = lazy(() => import("./pages/ScheduleReturnPage"));

// Onboarding pages
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));

// Direct imports
import QRHygienePage from "./pages/QRHygienePage";
import QRScannerPage from "./pages/QRScannerPage";
import ProductIntakePage from "./pages/ProductIntakePage";
import AdminHygieneDashboard from "./pages/AdminHygieneDashboard";
import QRHygieneTestPage from "./pages/QRHygieneTestPage";
import ProductQRGalleryPage from "./pages/ProductQRGalleryPage";
import MobileProductDetailPage from "./pages/MobileProductDetailPage";
import OfflinePage from "./pages/OfflinePage";
import NotFound from "./pages/NotFound";

// Delivery partner screens
import OrderDeliveredPage from "./pages/OrderDeliveredPage";
import PickupTrackingPage from "./pages/PickupTrackingPage";
import PickupConfirmationPage from "./pages/PickupConfirmationPage";
import OrdersPage from "./pages/OrdersPage";

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

  // 🔑 LOCATION BOOTSTRAP LOGIC
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
    <AuthGate>
      <CartProvider>
          <WishlistProvider>
            <FlyToCartProvider>
              <TooltipProvider>

                {/* SYSTEM LEVEL */}
                <ScrollProgress />
                <Toaster />
                <Sonner />

                {/* GPS REQUEST (NON-BLOCKING) */}
                <LocationGate />

                {/* MANUAL FALLBACK */}
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

                <AnimatePresence mode="wait">
  <div key={location.pathname}>
    <Routes location={location}>

                      <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
                      <Route path="/home" element={<PageTransition><MobileHome /></PageTransition>} />

                      {/* Onboarding Routes */}
                      <Route path="/welcome" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-900">Loading...</div>}><WelcomePage /></Suspense></PageTransition>} />
                      <Route path="/onboarding" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-900">Loading...</div>}><OnboardingPage /></Suspense></PageTransition>} />

                      {/* Auth Routes */}
                      <Route path="/signin" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignInPage /></Suspense></PageTransition>} />
                      <Route path="/signup" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><SignUpPage /></Suspense></PageTransition>} />
                      <Route path="/auth/login" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><LoginPage /></Suspense></PageTransition>} />
                      <Route path="/auth/otp" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><OtpVerificationPage /></Suspense></PageTransition>} />
                      <Route path="/auth/create-account" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><CreateAccountPage /></Suspense></PageTransition>} />

                      <Route path="/qr-hygiene" element={<PageTransition><QRHygienePage /></PageTransition>} />
                      <Route path="/qr-scanner" element={<PageTransition><QRScannerPage /></PageTransition>} />
                      <Route path="/product-intake" element={<PageTransition><ProductIntakePage /></PageTransition>} />
                      <Route path="/admin/hygiene" element={<PageTransition><AdminHygieneDashboard /></PageTransition>} />
                      <Route path="/products/qr-gallery" element={<PageTransition><ProductQRGalleryPage /></PageTransition>} />
                      <Route path="/test-qr" element={<QRHygieneTestPage />} />

                      <Route path="/product/:productId" element={<PageTransition><MobileProductDetailPage /></PageTransition>} />

                      <Route path="/chromatic" element={<PageTransition><ChromaticClosetPage /></PageTransition>} />
                      <Route path="/cart" element={<PageTransition><CartPage /></PageTransition>} />
                      <Route path="/checkout" element={<PageTransition><Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}><CheckoutPage /></Suspense></PageTransition>} />

                      <Route
                        path="/closet"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
                              <ClosetPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />

                      <Route
                        path="/closet/live"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
                              <LiveClosetPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />

                      <Route
                        path="/closet/return"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}>
                              <ScheduleReturnPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />

                      <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
                      <Route path="/orders" element={<PageTransition><OrdersPage /></PageTransition>} />
                      <Route path="/how-it-works" element={<PageTransition><HowItWorksPage /></PageTransition>} />

                      <Route
                        path="/collections"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
                              <CollectionsPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />

                      <Route path="/shop/:gender" element={
                        <PageTransition>
                          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}>
                            <CategoryProductsPage />
                          </Suspense>
                        </PageTransition>
                      } />

                      {/* Map & Location routes */}
                      <Route
                        path="/map"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading map...</div>}>
                              <MapLocationPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />
                      <Route
                        path="/tracking/:orderId"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}>
                              <DeliveryTrackingPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />

                      {/* Delivery Partner Screens */}
                      <Route
                        path="/order/:orderId/delivered"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}>
                              <OrderDeliveredPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />
                      <Route
                        path="/pickup/:orderId"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}>
                              <PickupTrackingPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />
                      <Route
                        path="/pickup/:orderId/confirm"
                        element={
                          <PageTransition>
                            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">Loading...</div>}>
                              <PickupConfirmationPage />
                            </Suspense>
                          </PageTransition>
                        }
                      />

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
