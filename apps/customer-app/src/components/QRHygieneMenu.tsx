import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Package, Scan, Settings } from 'lucide-react';

export const QRHygieneMenu: React.FC = () => {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold">QR Scanner & Hygiene SOP System</h1>
                    <p className="text-lg text-muted-foreground">
                        AI-Powered Inventory Hygiene Management
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Product Intake */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-6 w-6 text-blue-500" />
                                Product Intake
                            </CardTitle>
                            <CardDescription>
                                Add new products with AI-generated hygiene SOPs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link to="/product-intake">
                                <Button className="w-full" size="lg">
                                    <Package className="mr-2 h-5 w-5" />
                                    Add New Product
                                </Button>
                            </Link>
                            <p className="text-sm text-muted-foreground mt-3">
                                Enter minimal product details and let AI generate complete hygiene procedures
                            </p>
                        </CardContent>
                    </Card>

                    {/* QR Scanner */}
                    <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Scan className="h-6 w-6 text-green-500" />
                                QR Scanner
                            </CardTitle>
                            <CardDescription>
                                Scan product QR codes to view hygiene information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link to="/qr-scanner">
                                <Button className="w-full" size="lg" variant="outline">
                                    <Scan className="mr-2 h-5 w-5" />
                                    Open QR Scanner
                                </Button>
                            </Link>
                            <p className="text-sm text-muted-foreground mt-3">
                                Use your camera to scan QR codes and access hygiene SOPs
                            </p>
                        </CardContent>
                    </Card>

                    {/* Admin Dashboard */}
                    <Card className="hover:shadow-lg transition-shadow md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-6 w-6 text-purple-500" />
                                Admin Hygiene Dashboard
                            </CardTitle>
                            <CardDescription>
                                Manage hygiene SOPs and QR codes for your entire inventory
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link to="/admin/hygiene">
                                <Button className="w-full" size="lg" variant="secondary">
                                    <Settings className="mr-2 h-5 w-5" />
                                    Open Admin Dashboard
                                </Button>
                            </Link>
                            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-blue-500">📊</p>
                                    <p className="text-sm text-muted-foreground">View Stats</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-500">🤖</p>
                                    <p className="text-sm text-muted-foreground">Bulk Generate SOPs</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-purple-500">📱</p>
                                    <p className="text-sm text-muted-foreground">Generate QR Codes</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Info */}
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-blue-900 dark:text-blue-100">
                            <QrCode className="inline mr-2 h-5 w-5" />
                            How It Works
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-blue-800 dark:text-blue-200 space-y-2">
                        <p>✅ <strong>Add Products</strong>: Enter basic details, AI generates hygiene SOPs automatically</p>
                        <p>✅ <strong>Scan QR Codes</strong>: Access cleaning procedures instantly</p>
                        <p>✅ <strong>Bulk Operations</strong>: Process your entire inventory at once</p>
                        <p>✅ <strong>Offline Support</strong>: Works without internet connection</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
