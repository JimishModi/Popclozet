import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/ui/Toast';
import { PageTransition } from './components/ui/PageTransition';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { CartPage } from './pages/cart/CartPage';
import { CheckoutPage } from './pages/checkout/CheckoutPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { OrderTrackingPage } from './pages/orders/OrderTrackingPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { ReturnPage } from './pages/orders/ReturnPage';
import { MapTestPage } from './pages/MapTestPage';
import { EnvCheckPage } from './pages/EnvCheckPage';
import { AddAddressPage } from './pages/profile/AddAddressPage';

// Phase 3: Admin Pages
import { AdminRoute } from './components/AdminRoute';
import { DashboardPage } from './pages/admin/DashboardPage';
import { OrdersAdminPage } from './pages/admin/OrdersAdminPage';

// Phase 4: Rider Pages
import { RiderRoute } from './components/RiderRoute';
import { RiderDashboardPage } from './pages/rider/RiderDashboardPage';
import { DeliveryNavigationPage } from './pages/rider/DeliveryNavigationPage';

function App() {
    const location = useLocation();

    return (
        <>
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    {/* Public Routes */}
                    <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
                    <Route path="/signup" element={<PageTransition><SignupPage /></PageTransition>} />
                    <Route path="/env-check" element={<PageTransition><EnvCheckPage /></PageTransition>} />

                    {/* Home - uses its own MobileShell */}
                    <Route
                        path="/"
                        element={<PageTransition><HomePage /></PageTransition>}
                    />

                    <Route
                        path="/products"
                        element={
                            <PageTransition>
                                <Layout>
                                    <ProductListPage />
                                </Layout>
                            </PageTransition>
                        }
                    />

                    <Route
                        path="/products/:id"
                        element={
                            <PageTransition>
                                <Layout>
                                    <ProductDetailPage />
                                </Layout>
                            </PageTransition>
                        }
                    />

                    <Route
                        path="/cart"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <Layout>
                                        <CartPage />
                                    </Layout>
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/checkout"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <Layout>
                                        <CheckoutPage />
                                    </Layout>
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/orders"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <Layout>
                                        <OrdersPage />
                                    </Layout>
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/orders/:id"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <Layout>
                                        <OrderTrackingPage />
                                    </Layout>
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/orders/:id/return"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <Layout>
                                        <ReturnPage />
                                    </Layout>
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/map-test"
                        element={
                            <PageTransition>
                                <Layout>
                                    <MapTestPage />
                                </Layout>
                            </PageTransition>
                        }
                    />

                    <Route
                        path="/add-address"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <AddAddressPage />
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    {/* Profile - uses its own MobileShell */}
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <PageTransition>
                                    <ProfilePage />
                                </PageTransition>
                            </ProtectedRoute>
                        }
                    />

                    {/* Phase 3: Admin Routes (read-only dashboards) */}
                    <Route
                        path="/admin"
                        element={
                            <AdminRoute>
                                <PageTransition>
                                    <Layout>
                                        <DashboardPage />
                                    </Layout>
                                </PageTransition>
                            </AdminRoute>
                        }
                    />
                    <Route
                        path="/admin/orders"
                        element={
                            <AdminRoute>
                                <PageTransition>
                                    <Layout>
                                        <OrdersAdminPage />
                                    </Layout>
                                </PageTransition>
                            </AdminRoute>
                        }
                    />

                    {/* Phase 4: Rider Routes */}
                    <Route
                        path="/rider"
                        element={
                            <RiderRoute>
                                <PageTransition>
                                    <Layout>
                                        <RiderDashboardPage />
                                    </Layout>
                                </PageTransition>
                            </RiderRoute>
                        }
                    />
                    <Route
                        path="/rider/delivery/:id"
                        element={
                            <RiderRoute>
                                <PageTransition>
                                    <DeliveryNavigationPage />
                                </PageTransition>
                            </RiderRoute>
                        }
                    />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AnimatePresence>

            <ToastContainer />
        </>
    );
}

export default App;
