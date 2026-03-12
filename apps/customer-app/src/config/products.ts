export type ProductCategory = "Wedding" | "Party" | "Casual" | "Office";

export interface Product {
    id: string;
    name: string;
    price: number;
    rating: number;
    image: string;
    category: ProductCategory;
    leadTimeMinutes?: number;
    color: string;
    video?: string;
    gender?: string;
    eventCategory?: string;
    sizes?: string[];
    // Discount fields
    discount_type?: 'percentage' | 'fixed_amount';
    discount_value?: number;
    discounted_price?: number;
}

export const PRODUCTS: Product[] = [
    { id: "1", name: "Summer Breeze Dress", price: 499, rating: 4.8, image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1200&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 60, color: "Blue", video: "https://cdn.coverr.co/videos/coverr-young-woman-in-yellow-dress-1434/1080p.mp4" },
    { id: "2", name: "Royal Silk Saree", price: 1299, rating: 4.9, image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=1000&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 45, color: "Red" },
    { id: "3", name: "Midnight Party Gown", price: 899, rating: 4.7, image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=1000&auto=format&fit=crop", category: "Party", leadTimeMinutes: 50, color: "Black" },
    { id: "4", name: "Corporate Chic Blazer", price: 599, rating: 4.6, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop", category: "Office", leadTimeMinutes: 40, color: "Grey" },
    { id: "5", name: "Boho Maxi Skirt", price: 399, rating: 4.5, image: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 35, color: "Orange" },
    { id: "6", name: "Velvet Evening Suit", price: 999, rating: 4.8, image: "https://images.unsplash.com/photo-1507680434567-5739c80be1ac?q=80&w=1000&auto=format&fit=crop", category: "Party", leadTimeMinutes: 55, color: "Blue" },
    { id: "7", name: "Designer Lehenga", price: 1499, rating: 5.0, image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 70, color: "Pink" },
    { id: "8", name: "Casual Denim Jacket", price: 299, rating: 4.4, image: "https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 30, color: "Blue" },
    { id: "9", name: "Emerald Silk Gown", price: 1199, rating: 4.9, image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=1000&auto=format&fit=crop", category: "Party", leadTimeMinutes: 60, color: "Green" },
    { id: "10", name: "Classic Tuxedo", price: 899, rating: 4.7, image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 45, color: "Black" },
    { id: "11", name: "Floral Summer Dress", price: 349, rating: 4.5, image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 30, color: "Pink" },
    { id: "12", name: "Power Suit Set", price: 799, rating: 4.8, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop", category: "Office", leadTimeMinutes: 50, color: "Red", video: "https://cdn.coverr.co/videos/coverr-stylish-businesswoman-9943/1080p.mp4" },
    { id: "13", name: "Sequin Mini Dress", price: 599, rating: 4.6, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1000&auto=format&fit=crop", category: "Party", leadTimeMinutes: 40, color: "Gold" },
    { id: "14", name: "Linen Beach Shirt", price: 249, rating: 4.3, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 25, color: "White" },
    { id: "15", name: "Sherwani Set", price: 1399, rating: 4.9, image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?q=80&w=1000&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 75, color: "Gold" },
    { id: "16", name: "Pencil Skirt", price: 299, rating: 4.4, image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=1200&auto=format&fit=crop", category: "Office", leadTimeMinutes: 35, color: "Black" },
    { id: "17", name: "Leather Jacket", price: 699, rating: 4.7, image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=1200&auto=format&fit=crop", category: "Party", leadTimeMinutes: 45, color: "Black" },
    { id: "18", name: "Chiffon Saree", price: 799, rating: 4.6, image: "https://images.unsplash.com/photo-1542060748-10c28b62716d?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 55, color: "Blue", video: "https://cdn.coverr.co/videos/coverr-indian-bride-dancing-8088/1080p.mp4" },
    { id: "19", name: "Striped Shirt", price: 199, rating: 4.2, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 20, color: "Blue" },
    { id: "20", name: "Formal Trousers", price: 399, rating: 4.5, image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?q=80&w=1000&auto=format&fit=crop", category: "Office", leadTimeMinutes: 30, color: "Grey" },
    { id: "21", name: "Coral Maxi Dress", price: 549, rating: 4.7, image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=1000&auto=format&fit=crop", category: "Party", leadTimeMinutes: 40, color: "Orange" },
    { id: "22", name: "Navy Blazer Set", price: 699, rating: 4.6, image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1000&auto=format&fit=crop", category: "Office", leadTimeMinutes: 45, color: "Blue" },
    { id: "23", name: "Burgundy Evening Gown", price: 1099, rating: 4.8, image: "https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&w=1200&auto=format&fit=crop", category: "Party", leadTimeMinutes: 50, color: "Red" },
    { id: "24", name: "Pastel Anarkali", price: 899, rating: 4.7, image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 60, color: "Pink" },
    { id: "25", name: "White Linen Suit", price: 599, rating: 4.5, image: "https://images.unsplash.com/photo-1593030103066-0093718efeb9?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 35, color: "White" },
    { id: "26", name: "Emerald Cocktail Dress", price: 799, rating: 4.6, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1000&auto=format&fit=crop", category: "Party", leadTimeMinutes: 45, color: "Green" },
    { id: "27", name: "Charcoal Suit", price: 899, rating: 4.8, image: "https://images.unsplash.com/photo-1598522325074-042db73aa4e6?q=80&w=1000&auto=format&fit=crop", category: "Office", leadTimeMinutes: 50, color: "Grey" },
    { id: "28", name: "Golden Banarasi Saree", price: 1599, rating: 5.0, image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 70, color: "Gold" },
    { id: "29", name: "Denim Jumpsuit", price: 449, rating: 4.4, image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=1200&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 30, color: "Blue" },
    { id: "30", name: "Black Cocktail Dress", price: 699, rating: 4.7, image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=1200&auto=format&fit=crop", category: "Party", leadTimeMinutes: 40, color: "Black" },
    { id: "31", name: "Peach Floor Length Gown", price: 999, rating: 4.8, image: "https://images.unsplash.com/photo-1518577915332-c2a19f149a75?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 65, color: "Orange" },
    { id: "32", name: "Grey Pinstripe Suit", price: 749, rating: 4.6, image: "https://images.unsplash.com/photo-1594938291221-94f18cbb5660?q=80&w=1000&auto=format&fit=crop", category: "Office", leadTimeMinutes: 45, color: "Grey" },
    { id: "33", name: "Mint Sundress", price: 349, rating: 4.5, image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 25, color: "Green" },
    { id: "34", name: "Red Carpet Gown", price: 1299, rating: 4.9, image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop", category: "Party", leadTimeMinutes: 55, color: "Red" },
    { id: "35", name: "Rose Gold Lehenga", price: 1499, rating: 5.0, image: "https://images.unsplash.com/photo-1583391733952-4c3102554433?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 75, color: "Pink" },
    { id: "36", name: "Khaki Trench Coat", price: 599, rating: 4.6, image: "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?q=80&w=1000&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 35, color: "Grey" },
    { id: "37", name: "Sapphire Silk Dress", price: 899, rating: 4.7, image: "https://images.unsplash.com/photo-1496747611180-206a5c8c8b53?q=80&w=1200&auto=format&fit=crop", category: "Party", leadTimeMinutes: 50, color: "Blue" },
    { id: "38", name: "Ivory Blazer Dress", price: 649, rating: 4.5, image: "https://images.unsplash.com/photo-1594951887308-e1d856d7a137?q=80&w=1200&auto=format&fit=crop", category: "Office", leadTimeMinutes: 40, color: "White" },
    { id: "39", name: "Printed Palazzo Set", price: 399, rating: 4.4, image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop", category: "Casual", leadTimeMinutes: 30, color: "Pink" },
    { id: "40", name: "Classic Black Sherwani", price: 1299, rating: 4.9, image: "https://images.unsplash.com/photo-1594938328870-9623159c8c99?q=80&w=1200&auto=format&fit=crop", category: "Wedding", leadTimeMinutes: 70, color: "Black" },
];

export const getProductById = (id: string) => PRODUCTS.find((item) => item.id === id);
