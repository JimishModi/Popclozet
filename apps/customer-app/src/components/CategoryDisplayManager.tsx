import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Image as ImageIcon, ExternalLink } from "lucide-react";
import { productService } from "@/services/productService";

interface CategoryConfig {
    category: string;
    display_name: string;
    image_url: string;
}

export const CategoryDisplayManager: React.FC = () => {
    const [categories, setCategories] = useState<CategoryConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const data = await productService.getCategoryConfigs();
            setCategories(data);
        } catch (error) {
            console.error('Error fetching categories:', error);
            toast.error("Failed to load categories");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateImage = async (category: string, newUrl: string) => {
        setUpdatingCategory(category);
        try {
            await productService.updateCategoryImage(category, newUrl);
            toast.success(`Updated ${category} image`);
            fetchCategories();
        } catch (error) {
            console.error('Error updating category image:', error);
            toast.error("Failed to update image");
        } finally {
            setUpdatingCategory(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#EB76C2]" />
            </div>
        );
    }

    return (
        <Card className="border-[#EB76C2]/20 shadow-sm mt-8">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-[#EB76C2]" />
                    <div>
                        <CardTitle className="text-lg">Collection Display Config</CardTitle>
                        <CardDescription>Update cover images for categories on the shop</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-6">
                    {categories.map((cat) => (
                        <div key={cat.category} className="space-y-3 p-4 rounded-lg bg-secondary/20 border border-border/50">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-[#EB76C2]">
                                    {cat.display_name} ({cat.category})
                                </Label>
                                <a 
                                    href={cat.image_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-[#EB76C2] transition-colors"
                                >
                                    View Current <ExternalLink className="w-2 h-2" />
                                </a>
                            </div>
                            
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Input 
                                        placeholder="Paste image URL here..."
                                        defaultValue={cat.image_url}
                                        id={`url-${cat.category}`}
                                        className="pr-10"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div 
                                            className="w-5 h-5 rounded overflow-hidden border border-border bg-muted flex items-center justify-center"
                                        >
                                            {cat.image_url ? (
                                                <img src={cat.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-3 h-3 text-muted-foreground" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    disabled={updatingCategory === cat.category}
                                    onClick={() => {
                                        const input = document.getElementById(`url-${cat.category}`) as HTMLInputElement;
                                        handleUpdateImage(cat.category, input.value);
                                    }}
                                    className="bg-gradient-to-r from-[#E3BBE6] to-[#C0E2AD] text-white hover:opacity-90"
                                >
                                    {updatingCategory === cat.category ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
