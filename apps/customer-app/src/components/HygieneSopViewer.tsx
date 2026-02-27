import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Droplet,
    Wind,
    Package,
    ClipboardCheck,
    AlertTriangle,
    X,
    Calendar,
    Hash,
    Shirt,
} from 'lucide-react';
import { HygieneSopRecord } from '@/services/hygieneSopService';
import { Product } from '@/services/productService';

interface HygieneSopViewerProps {
    productData: Product;
    sopData: HygieneSopRecord;
    onClose?: () => void;
}

export const HygieneSopViewer: React.FC<HygieneSopViewerProps> = ({
    productData,
    sopData,
    onClose,
}) => {
    const cleaningProc = sopData.cleaningProcedure;
    const hygieneSteps = sopData.hygieneSteps;

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <CardTitle className="text-2xl">{productData.name}</CardTitle>
                        <CardDescription className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="gap-1">
                                <Shirt className="h-3 w-3" />
                                {productData.gender} • {productData.eventCategory}
                            </Badge>
                            <Badge variant="secondary" className="gap-1">
                                <Hash className="h-3 w-3" />
                                Version {sopData.version}
                            </Badge>
                        </CardDescription>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Product Information */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                        <p className="text-sm text-muted-foreground">Fabric Type</p>
                        <p className="font-semibold">{sopData.fabricType}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Composition</p>
                        <p className="font-semibold text-sm">{sopData.fabricComposition}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Rental Count</p>
                        <p className="font-semibold">{productData.rentalCount || 0} times</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Condition</p>
                        <Badge variant={productData.conditionStatus === 'excellent' ? 'default' : 'secondary'}>
                            {productData.conditionStatus || 'excellent'}
                        </Badge>
                    </div>
                </div>

                <Separator />

                {/* Tabbed Content */}
                <Tabs defaultValue="cleaning" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="cleaning" className="gap-1">
                            <Droplet className="h-4 w-4" />
                            <span className="hidden sm:inline">Cleaning</span>
                        </TabsTrigger>
                        <TabsTrigger value="hygiene" className="gap-1">
                            <Wind className="h-4 w-4" />
                            <span className="hidden sm:inline">Hygiene</span>
                        </TabsTrigger>
                        <TabsTrigger value="storage" className="gap-1">
                            <Package className="h-4 w-4" />
                            <span className="hidden sm:inline">Storage</span>
                        </TabsTrigger>
                        <TabsTrigger value="inspection" className="gap-1">
                            <ClipboardCheck className="h-4 w-4" />
                            <span className="hidden sm:inline">Inspection</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Cleaning Procedure Tab */}
                    <TabsContent value="cleaning" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Droplet className="h-5 w-5 text-blue-500" />
                                Cleaning Procedure
                            </h3>
                            <div className="grid gap-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Method</p>
                                    <p className="text-blue-700 dark:text-blue-300">{cleaningProc.method}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-muted rounded-lg">
                                        <p className="text-sm font-medium">Temperature</p>
                                        <p className="text-sm">{cleaningProc.temperature}</p>
                                    </div>
                                    <div className="p-3 bg-muted rounded-lg">
                                        <p className="text-sm font-medium">Detergent</p>
                                        <p className="text-sm">{cleaningProc.detergent}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm font-medium">Drying Instructions</p>
                                    <p className="text-sm">{cleaningProc.drying}</p>
                                </div>
                                {cleaningProc.ironingTemp && (
                                    <div className="p-3 bg-muted rounded-lg">
                                        <p className="text-sm font-medium">Ironing</p>
                                        <p className="text-sm">{cleaningProc.ironingTemp}</p>
                                    </div>
                                )}
                                {cleaningProc.specialCare && cleaningProc.specialCare.length > 0 && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                                            Special Care Instructions
                                        </p>
                                        <ul className="space-y-1">
                                            {cleaningProc.specialCare.map((instruction: string, idx: number) => (
                                                <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                                    <span className="text-amber-500 mt-1">•</span>
                                                    <span>{instruction}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Hygiene Steps Tab */}
                    <TabsContent value="hygiene" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Wind className="h-5 w-5 text-green-500" />
                                Hygiene & Sanitization Steps
                            </h3>

                            {hygieneSteps.preCleaning && hygieneSteps.preCleaning.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">Pre-Cleaning</h4>
                                    <ul className="space-y-2">
                                        {hygieneSteps.preCleaning.map((step: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center justify-center text-xs font-medium">
                                                    {idx + 1}
                                                </span>
                                                <span className="pt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {hygieneSteps.sanitization && hygieneSteps.sanitization.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">Sanitization</h4>
                                    <ul className="space-y-2">
                                        {hygieneSteps.sanitization.map((step: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-medium">
                                                    {idx + 1}
                                                </span>
                                                <span className="pt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {hygieneSteps.postCleaning && hygieneSteps.postCleaning.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">Post-Cleaning</h4>
                                    <ul className="space-y-2">
                                        {hygieneSteps.postCleaning.map((step: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-medium">
                                                    {idx + 1}
                                                </span>
                                                <span className="pt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {hygieneSteps.qualityCheck && hygieneSteps.qualityCheck.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">Quality Check</h4>
                                    <ul className="space-y-2">
                                        {hygieneSteps.qualityCheck.map((step: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-medium">
                                                    {idx + 1}
                                                </span>
                                                <span className="pt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Storage Guidelines Tab */}
                    <TabsContent value="storage" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Package className="h-5 w-5 text-purple-500" />
                                Storage Guidelines
                            </h3>
                            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed">
                                    {sopData.storageGuidelines}
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Inspection Checklist Tab */}
                    <TabsContent value="inspection" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 text-orange-500" />
                                Pre-Rental Inspection Checklist
                            </h3>
                            <div className="space-y-2">
                                {sopData.inspectionChecklist.map((item: string, idx: number) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                                    >
                                        <div className="flex-shrink-0 w-5 h-5 rounded border-2 border-orange-500 mt-0.5" />
                                        <span className="text-sm">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Special Instructions */}
                {sopData.specialInstructions && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-5 w-5" />
                                Special Instructions
                            </h3>
                            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-line">
                                    {sopData.specialInstructions}
                                </p>
                            </div>
                        </div>
                    </>
                )}

                {/* Metadata */}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Last updated: {new Date(sopData.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <span>SOP Version {sopData.version}</span>
                </div>
            </CardContent>
        </Card>
    );
};
