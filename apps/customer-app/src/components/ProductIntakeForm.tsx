import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Upload,
    Sparkles,
    QrCode,
    CheckCircle2,
    Loader2,
    ImagePlus,
    Tag,
    Palette,
    Shirt,
    DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface ProductFormData {
    name: string;
    description: string;
    price: string;
    rentalPrice: string;
    gender: string;
    eventCategory: string;
    color: string;
    fabricType: string;
    size: string;
    imageUrl: string;
}

const initialFormData: ProductFormData = {
    name: '',
    description: '',
    price: '',
    rentalPrice: '',
    gender: '',
    eventCategory: '',
    color: '',
    fabricType: '',
    size: '',
    imageUrl: '',
};

const genderOptions = ['men', 'women', 'unisex'];
const eventOptions = ['casual', 'formal', 'party', 'cocktail', 'streetwear', 'vacation', 'wedding'];
const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const fabricOptions = ['Cotton', 'Silk', 'Polyester', 'Linen', 'Wool', 'Denim', 'Velvet', 'Satin', 'Chiffon'];

export function ProductIntakeForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<ProductFormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setImagePreview(result);
                setFormData(prev => ({ ...prev, imageUrl: result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Simulate API call for product creation
            // In production, this would call the productService
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate AI SOP generation
            await new Promise(resolve => setTimeout(resolve, 1000));

            setIsSuccess(true);

            // Reset form after delay
            setTimeout(() => {
                setFormData(initialFormData);
                setImagePreview(null);
                setIsSuccess(false);
            }, 3000);

        } catch (error) {
            console.error('Error creating product:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormValid = formData.name && formData.gender && formData.eventCategory && formData.price;

    if (isSuccess) {
        return (
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-16 space-y-6"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                    className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#C0E2AD] to-[#22C55E] flex items-center justify-center"
                >
                    <CheckCircle2 className="w-12 h-12 text-white" />
                </motion.div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-foreground">Product Added Successfully!</h3>
                    <p className="text-muted-foreground">AI is generating hygiene SOPs and QR code...</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="w-4 h-4 animate-pulse" />
                    <span>QR Code will be available in the product gallery</span>
                </div>
            </motion.div>
        );
    }

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-[#C0E2AD]" />
                    Add New Product
                </CardTitle>
                <CardDescription>
                    Enter product details below. AI will automatically generate care instructions and hygiene protocols.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label htmlFor="image">Product Image</Label>
                        <div className="flex items-center gap-4">
                            <label
                                htmlFor="image-upload"
                                className="flex flex-col items-center justify-center w-32 h-32 rounded-xl border-2 border-dashed border-border hover:border-[#C0E2AD] transition-colors cursor-pointer bg-muted/30 overflow-hidden"
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <ImagePlus className="w-8 h-8 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground mt-2">Upload</span>
                                    </>
                                )}
                                <input
                                    id="image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </label>
                            <div className="text-sm text-muted-foreground">
                                <p>Upload a clear product image</p>
                                <p className="text-xs">JPG, PNG up to 5MB</p>
                            </div>
                        </div>
                    </div>

                    {/* Product Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            <Tag className="w-4 h-4 inline mr-2" />
                            Product Name *
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., Elegant Evening Gown"
                            className="bg-background"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Describe the product, its features, and styling suggestions..."
                            className="bg-background min-h-[100px]"
                        />
                    </div>

                    {/* Gender & Event Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Gender Category *</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) => handleSelectChange('gender', value)}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    {genderOptions.map(option => (
                                        <SelectItem key={option} value={option}>
                                            {option.charAt(0).toUpperCase() + option.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Event Category *</Label>
                            <Select
                                value={formData.eventCategory}
                                onValueChange={(value) => handleSelectChange('eventCategory', value)}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select event type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventOptions.map(option => (
                                        <SelectItem key={option} value={option}>
                                            {option.charAt(0).toUpperCase() + option.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Price & Rental Price */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">
                                <DollarSign className="w-4 h-4 inline mr-1" />
                                Retail Price *
                            </Label>
                            <Input
                                id="price"
                                name="price"
                                type="number"
                                value={formData.price}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                className="bg-background"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rentalPrice">
                                <DollarSign className="w-4 h-4 inline mr-1" />
                                Rental Price (per day)
                            </Label>
                            <Input
                                id="rentalPrice"
                                name="rentalPrice"
                                type="number"
                                value={formData.rentalPrice}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                className="bg-background"
                            />
                        </div>
                    </div>

                    {/* Color, Fabric, Size */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="color">
                                <Palette className="w-4 h-4 inline mr-2" />
                                Color
                            </Label>
                            <Input
                                id="color"
                                name="color"
                                value={formData.color}
                                onChange={handleInputChange}
                                placeholder="e.g., Navy Blue"
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fabric Type</Label>
                            <Select
                                value={formData.fabricType}
                                onValueChange={(value) => handleSelectChange('fabricType', value)}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select fabric" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fabricOptions.map(option => (
                                        <SelectItem key={option} value={option.toLowerCase()}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Size</Label>
                            <Select
                                value={formData.size}
                                onValueChange={(value) => handleSelectChange('size', value)}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sizeOptions.map(option => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* AI Features Notice */}
                    <div className="rounded-xl bg-gradient-to-r from-[#E3BBE6]/20 to-[#C0E2AD]/20 p-4 border border-[#E3BBE6]/30">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-[#EB76C2] mt-0.5" />
                            <div>
                                <h4 className="font-medium text-sm">AI-Powered Features</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Upon submission, our AI will automatically:
                                </p>
                                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                                        Generate fabric-specific hygiene SOPs
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                                        Create unique QR code for tracking
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                                        Suggest optimal rental pricing
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate('/qr-hygiene')}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isFormValid || isSubmitting}
                            className="flex-1 bg-gradient-to-r from-[#C0E2AD] to-[#22C55E] text-white hover:opacity-90"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Add Product
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
