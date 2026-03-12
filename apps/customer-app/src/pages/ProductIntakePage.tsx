import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductIntakeForm } from '@/components/ProductIntakeForm';

const ProductIntakePage: React.FC = () => {
    return (
        <div className="min-h-screen bg-background">
            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#C0E2AD]/20 to-transparent rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#E3BBE6]/20 to-transparent rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
            </div>

            <div className="relative z-10">
                {/* Header */}
                <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-4xl">
                        <Link to="/qr-hygiene">
                            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Hub
                            </Button>
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4 text-[#EB76C2]" />
                            <span>AI-Powered</span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="container mx-auto px-4 py-8 max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        {/* Page Header */}
                        <div className="text-center space-y-4">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#C0E2AD]/20 rounded-full"
                            >
                                <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                                <span className="text-sm font-medium text-foreground/80">New Product</span>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-4xl md:text-5xl font-playfair font-bold"
                            >
                                <span className="bg-gradient-to-r from-[#C0E2AD] via-[#22C55E] to-[#16A34A] bg-clip-text text-transparent">
                                    Product Intake
                                </span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-lg text-muted-foreground max-w-xl mx-auto"
                            >
                                Add new inventory with minimal details. AI will automatically generate
                                hygiene SOPs and assign QR codes.
                            </motion.p>
                        </div>

                        {/* Form Component */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <ProductIntakeForm />
                        </motion.div>
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default ProductIntakePage;
