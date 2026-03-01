import { GenderCategory, EventCategory } from "@/services/productService";

export interface Product {
    id: string;
    name: string;
    brand?: string;
    price: number;
    rental_price?: number;
    rentalPrice?: number;
    images?: string[];
    imageUrl: string;
    sizes?: string[];
    category: string;
    eventCategory: EventCategory;
    color: string;
    rating: number;
    gender: GenderCategory;
    leadTimeMinutes?: number;
    video?: string;
}

const JACKET_BRANDS = ["Zara", "H&M", "Mango", "Forever 21", "Uniqlo", "Gap"];
const SHOE_BRANDS = ["Nike", "Adidas", "Puma", "Reebok", "Vans"];
const ACCESSORY_BRANDS = ["Fossil", "Coach", "Guess", "Michael Kors"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE_SIZES = ["6", "7", "8", "9", "10", "11"];

export const ALL_MOCK_PRODUCTS: Product[] = [
    // 15 Jackets (10 Mens, 5 Womens)
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `jacket-mens-${i + 1}`,
        name: `Men Leather Jacket ${i + 1}`,
        brand: "Zara",
        rental_price: 699,
        price: 4000,
        rentalPrice: 699,
        images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop"],
        imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop",
        sizes: ["M", "L", "XL"],
        category: "jackets",
        eventCategory: "casual" as EventCategory,
        color: "Black",
        rating: 4.5,
        gender: "mens" as GenderCategory,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `jacket-womens-${i + 1}`,
        name: `Women Leather Jacket ${i + 1}`,
        brand: "H&M",
        rental_price: 599,
        price: 3500,
        rentalPrice: 599,
        images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop"],
        imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop",
        sizes: ["S", "M", "L"],
        category: "jackets",
        eventCategory: "casual" as EventCategory,
        color: "Black",
        rating: 4.6,
        gender: "womens" as GenderCategory,
    })),
    // 10 Shoes (5 Mens, 5 Womens)
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `shoe-mens-${i + 1}`,
        name: `Men Running Shoe ${i + 1}`,
        brand: "Nike",
        rental_price: 399,
        price: 2000,
        rentalPrice: 399,
        images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop"],
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop",
        sizes: ["8", "9", "10"],
        category: "footwear",
        eventCategory: "casual" as EventCategory,
        color: "White",
        rating: 4.8,
        gender: "mens" as GenderCategory,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `shoe-womens-${i + 1}`,
        name: `Women Running Shoe ${i + 1}`,
        brand: "Adidas",
        rental_price: 349,
        price: 1800,
        rentalPrice: 349,
        images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop"],
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop",
        sizes: ["6", "7", "8"],
        category: "footwear",
        eventCategory: "casual" as EventCategory,
        color: "White",
        rating: 4.7,
        gender: "womens" as GenderCategory,
    })),
    // 10 Accessories (4 Mens, 6 Womens)
    ...Array.from({ length: 4 }, (_, i) => ({
        id: `accessory-mens-${i + 1}`,
        name: `Men Watch ${i + 1}`,
        brand: "Fossil",
        rental_price: 299,
        price: 1500,
        rentalPrice: 299,
        images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop"],
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop",
        sizes: ["onesize"],
        category: "accessories",
        eventCategory: "formal" as EventCategory,
        color: "Gold",
        rating: 4.6,
        gender: "mens" as GenderCategory,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
        id: `accessory-womens-${i + 1}`,
        name: `Women Handbag ${i + 1}`,
        brand: "Coach",
        rental_price: 499,
        price: 2500,
        rentalPrice: 499,
        images: ["https://images.unsplash.com/photo-1584917033904-493bb3c3ccad?q=80&w=1000&auto=format&fit=crop"],
        imageUrl: "https://images.unsplash.com/photo-1584917033904-493bb3c3ccad?q=80&w=1000&auto=format&fit=crop",
        sizes: ["onesize"],
        category: "accessories",
        eventCategory: "party" as EventCategory,
        color: "Brown",
        rating: 4.8,
        gender: "womens" as GenderCategory,
    })),
];
