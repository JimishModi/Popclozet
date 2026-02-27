import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    QrCode,
    Camera,
    Package,
    Settings,
    CheckCircle2,
    Sparkles,
    ArrowRight,
    Zap,
    Scan,
    Shield,
    Cpu,
    Grid3X3
} from 'lucide-react';

const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const QRHygienePage: React.FC = () => {
    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-12 pb-16 px-4">
                {/* Background decoration */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#C0E2AD]/20 via-transparent to-[#E3BBE6]/20 pointer-events-none" />
                <div className="absolute top-20 left-10 w-72 h-72 bg-[#EB76C2]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#C0E2AD]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="container mx-auto max-w-6xl relative z-10">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={staggerContainer}
                        className="text-center"
                    >
                        {/* Badge */}
                        <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-[#E3BBE6]/30 dark:bg-[#E3BBE6]/20 rounded-full border border-[#E3BBE6]/50">
                            <Sparkles className="w-4 h-4 text-[#EB76C2]" />
                            <span className="text-sm font-semibold text-foreground/80">AI-Powered Hygiene System</span>
                        </motion.div>

                        {/* Main Headline */}
                        <motion.h1
                            variants={fadeInUp}
                            className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
                        >
                            <span className="bg-gradient-to-r from-[#EB76C2] via-[#C084FC] to-[#7DD3FC] bg-clip-text text-transparent">
                                QR & Hygiene
                            </span>
                            <br />
                            <span className="text-foreground">Management Hub</span>
                        </motion.h1>

                        <motion.p
                            variants={fadeInUp}
                            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4"
                        >
                            Automated pipeline: Product Intake → AI SOP Generation → QR Code Assignment → Secure Scanning
                        </motion.p>

                        {/* Quick action buttons */}
                        <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4 mt-8">
                            <Link to="/product-intake">
                                <Button size="lg" className="bg-gradient-to-r from-[#EB76C2] to-[#C084FC] hover:opacity-90 text-white shadow-lg shadow-[#EB76C2]/25">
                                    <Package className="mr-2 h-5 w-5" />
                                    Add New Product
                                </Button>
                            </Link>
                            <Link to="/qr-scanner">
                                <Button size="lg" variant="outline" className="border-[#C0E2AD] hover:bg-[#C0E2AD]/10">
                                    <Camera className="mr-2 h-5 w-5" />
                                    Open Scanner
                                </Button>
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Feature Cards - Bento Grid */}
            <section className="px-4 pb-16">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                    >
                        {/* Product Intake Card */}
                        <motion.div variants={fadeInUp} className="lg:col-span-2">
                            <Link to="/product-intake" className="block group">
                                <Card className="h-full overflow-hidden border-0 bg-gradient-to-br from-[#C0E2AD]/20 to-[#C0E2AD]/5 dark:from-[#C0E2AD]/10 dark:to-transparent hover:shadow-xl hover:shadow-[#C0E2AD]/20 transition-all duration-500 hover:-translate-y-1">
                                    <CardHeader className="pb-2">
                                        <div className="w-14 h-14 rounded-2xl bg-[#C0E2AD] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                            <Package className="h-7 w-7 text-black" />
                                        </div>
                                        <CardTitle className="text-2xl font-playfair group-hover:text-[#22C55E] transition-colors">
                                            Product Intake
                                        </CardTitle>
                                        <CardDescription className="text-base">
                                            Add new inventory with minimal details. AI automatically generates hygiene SOPs.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className="text-xs px-2 py-1 rounded-full bg-[#C0E2AD]/30 text-foreground/70">AI-Generated SOPs</span>
                                            <span className="text-xs px-2 py-1 rounded-full bg-[#C0E2AD]/30 text-foreground/70">Auto QR Codes</span>
                                            <span className="text-xs px-2 py-1 rounded-full bg-[#C0E2AD]/30 text-foreground/70">Zero Manual Work</span>
                                        </div>
                                        <div className="flex items-center text-[#22C55E] font-medium group-hover:gap-3 gap-2 transition-all">
                                            Add Product <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>

                        {/* QR Scanner Card */}
                        <motion.div variants={fadeInUp}>
                            <Link to="/qr-scanner" className="block group h-full">
                                <Card className="h-full overflow-hidden border-0 bg-gradient-to-br from-[#E3BBE6]/20 to-[#E3BBE6]/5 dark:from-[#E3BBE6]/10 dark:to-transparent hover:shadow-xl hover:shadow-[#E3BBE6]/20 transition-all duration-500 hover:-translate-y-1">
                                    <CardHeader className="pb-2">
                                        <div className="w-12 h-12 rounded-xl bg-[#E3BBE6] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                            <Scan className="h-6 w-6 text-black" />
                                        </div>
                                        <CardTitle className="text-xl font-playfair group-hover:text-[#A855F7] transition-colors">
                                            QR Scanner
                                        </CardTitle>
                                        <CardDescription className="text-sm">
                                            Scan codes to access hygiene info instantly
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-[#A855F7] font-medium text-sm group-hover:gap-2 gap-1 transition-all">
                                            Open Scanner <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>

                        {/* Product Gallery Card */}
                        <motion.div variants={fadeInUp}>
                            <Link to="/products/qr-gallery" className="block group h-full">
                                <Card className="h-full overflow-hidden border-0 bg-gradient-to-br from-[#EB76C2]/20 to-[#EB76C2]/5 dark:from-[#EB76C2]/10 dark:to-transparent hover:shadow-xl hover:shadow-[#EB76C2]/20 transition-all duration-500 hover:-translate-y-1">
                                    <CardHeader className="pb-2">
                                        <div className="w-12 h-12 rounded-xl bg-[#EB76C2] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                            <Grid3X3 className="h-6 w-6 text-white" />
                                        </div>
                                        <CardTitle className="text-xl font-playfair group-hover:text-[#EB76C2] transition-colors">
                                            QR Gallery
                                        </CardTitle>
                                        <CardDescription className="text-sm">
                                            Browse all products with QR codes
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-[#EB76C2] font-medium text-sm group-hover:gap-2 gap-1 transition-all">
                                            View Gallery <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>

                        {/* Admin Dashboard Card */}
                        <motion.div variants={fadeInUp} className="lg:col-span-2">
                            <Link to="/admin/hygiene" className="block group">
                                <Card className="h-full overflow-hidden border border-dashed border-foreground/20 bg-card/50 hover:border-foreground/40 transition-all duration-300">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <Settings className="h-6 w-6 text-foreground/70" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl font-playfair">Admin Dashboard</CardTitle>
                                                <CardDescription>Manage SOPs, bulk operations, and more</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-foreground/70 font-medium text-sm group-hover:gap-2 gap-1 transition-all">
                                            Open Dashboard <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>

                        {/* Test Page Card */}
                        <motion.div variants={fadeInUp} className="lg:col-span-2">
                            <Link to="/test-qr" className="block group">
                                <Card className="h-full overflow-hidden border border-dashed border-foreground/20 bg-card/50 hover:border-foreground/40 transition-all duration-300">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <Zap className="h-6 w-6 text-foreground/70" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl font-playfair">Test Environment</CardTitle>
                                                <CardDescription>Quick access to all features in one place</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-foreground/70 font-medium text-sm group-hover:gap-2 gap-1 transition-all">
                                            Open Test Page <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* How It Works - Pipeline */}
            <section className="px-4 pb-16">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#C0E2AD]/10 via-[#E3BBE6]/10 to-[#EB76C2]/10 dark:from-[#C0E2AD]/5 dark:via-[#E3BBE6]/5 dark:to-[#EB76C2]/5">
                            <CardHeader className="text-center pb-4">
                                <div className="inline-flex items-center justify-center gap-2 mx-auto mb-2">
                                    <Cpu className="w-5 h-5 text-[#EB76C2]" />
                                    <span className="text-sm font-semibold text-[#EB76C2]">AUTOMATED PIPELINE</span>
                                </div>
                                <CardTitle className="text-2xl md:text-3xl font-playfair">
                                    How It Works
                                </CardTitle>
                                <CardDescription className="text-base">
                                    From intake to QR code in seconds — fully automated
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                                    {/* Step 1 */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.1 }}
                                        className="text-center"
                                    >
                                        <div className="relative mx-auto mb-4">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C0E2AD] to-[#22C55E] flex items-center justify-center mx-auto shadow-lg shadow-[#C0E2AD]/30">
                                                <span className="text-2xl font-bold text-black">1</span>
                                            </div>
                                            <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-gradient-to-r from-[#C0E2AD] to-[#E3BBE6] -translate-y-1/2" />
                                        </div>
                                        <h4 className="font-playfair font-bold text-lg mb-2">Minimal Intake</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Enter category, gender, and basic product details
                                        </p>
                                    </motion.div>

                                    {/* Step 2 */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.2 }}
                                        className="text-center"
                                    >
                                        <div className="relative mx-auto mb-4">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E3BBE6] to-[#A855F7] flex items-center justify-center mx-auto shadow-lg shadow-[#E3BBE6]/30">
                                                <Sparkles className="h-7 w-7 text-white" />
                                            </div>
                                            <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-gradient-to-r from-[#E3BBE6] to-[#EB76C2] -translate-y-1/2" />
                                        </div>
                                        <h4 className="font-playfair font-bold text-lg mb-2">AI SOP Generation</h4>
                                        <p className="text-sm text-muted-foreground">
                                            AI infers fabric type and generates cleaning procedures
                                        </p>
                                    </motion.div>

                                    {/* Step 3 */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.3 }}
                                        className="text-center"
                                    >
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EB76C2] to-[#EC4899] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#EB76C2]/30">
                                            <QrCode className="h-7 w-7 text-white" />
                                        </div>
                                        <h4 className="font-playfair font-bold text-lg mb-2">QR Assignment</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Unique QR code automatically generated and linked
                                        </p>
                                    </motion.div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </section>

            {/* Key Features */}
            <section className="px-4 pb-20">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {[
                            {
                                icon: Cpu,
                                title: "Works with Incomplete Data",
                                description: "AI infers fabric types and cleaning methods even when only basic product info is available"
                            },
                            {
                                icon: QrCode,
                                title: "Automatic QR Generation",
                                description: "Every new product automatically gets a unique QR code linked to its hygiene SOP"
                            },
                            {
                                icon: Shield,
                                title: "Secure Access Control",
                                description: "QR codes only reveal internal hygiene information to admin/staff users"
                            },
                            {
                                icon: Scan,
                                title: "Multi-Format Scanner",
                                description: "Supports QR codes, barcodes, and multiple code formats for flexible scanning"
                            }
                        ].map((feature, index) => (
                            <motion.div key={index} variants={fadeInUp}>
                                <Card className="h-full border-0 bg-card/50 hover:bg-card transition-colors duration-300">
                                    <CardContent className="pt-6">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-[#C0E2AD]/20 dark:bg-[#C0E2AD]/10 flex items-center justify-center flex-shrink-0">
                                                <feature.icon className="h-5 w-5 text-[#22C55E]" />
                                            </div>
                                            <div>
                                                <h4 className="font-playfair font-bold text-lg mb-1">{feature.title}</h4>
                                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Testing Mode Notice */}
            <section className="px-4 pb-12">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 border border-amber-500/20 p-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <Zap className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="font-playfair font-bold text-lg mb-1 text-amber-700 dark:text-amber-400">
                                    🧪 Testing Mode Active
                                </h4>
                                <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
                                    Authentication is bypassed for testing purposes. All features are accessible.
                                    Start by adding a product, then scan its QR code to see the complete flow!
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default QRHygienePage;
