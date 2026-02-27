import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/ui/Toast';

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
    return (
        <>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/env-check" element={<EnvCheckPage />} />

                {/* Home - uses its own MobileShell */}
                <Route
                    path="/"
                    element={<HomePage />}
                />

                <Route
                    path="/products"
                    element={
                        <Layout>
                            <ProductListPage />
                        </Layout>
                    }
                />

                <Route
                    path="/products/:id"
                    element={
                        <Layout>
                            <ProductDetailPage />
                        </Layout>
                    }
                />

                <Route
                    path="/cart"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <CartPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/checkout"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <CheckoutPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/orders"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <OrdersPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/orders/:id"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <OrderTrackingPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/orders/:id/return"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <ReturnPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/map-test"
                    element={
                        <Layout>
                            <MapTestPage />
                        </Layout>
                    }
                />

                <Route
                    path="/add-address"
                    element={
                        <ProtectedRoute>
                            <AddAddressPage />
                        </ProtectedRoute>
                    }
                />

                {/* Profile - uses its own MobileShell */}
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <ProfilePage />
                        </ProtectedRoute>
                    }
                />

                {/* Phase 3: Admin Routes (read-only dashboards) */}
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <Layout>
                                <DashboardPage />
                            </Layout>
                        </AdminRoute>
                    }
                />
                <Route
                    path="/admin/orders"
                    element={
                        <AdminRoute>
                            <Layout>
                                <OrdersAdminPage />
                            </Layout>
                        </AdminRoute>
                    }
                />

                {/* Phase 4: Rider Routes */}
                <Route
                    path="/rider"
                    element={
                        <RiderRoute>
                            <Layout>
                                <RiderDashboardPage />
                            </Layout>
                        </RiderRoute>
                    }
                />
                <Route
                    path="/rider/delivery/:id"
                    element={
                        <RiderRoute>
                            <DeliveryNavigationPage />
                        </RiderRoute>
                    }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <ToastContainer />
        </>
    );
}

export default App;
