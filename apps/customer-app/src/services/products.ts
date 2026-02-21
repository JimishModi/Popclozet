
import { supabase } from "@popclozet/api-client";
import { Product, ProductCategory } from "@/config/products";
import { PRODUCTS as MOCK_PRODUCTS } from "@/config/products";

// Fallback to mock data if Supabase connection fails or table doesn't exist
const USE_MOCK_FALLBACK = true;

// Map DB column names to our Product type if they differ
const mapDBProductToType = (dbProduct: any): Product => {
    return {
        id: dbProduct.id,
        name: dbProduct.name,
        price: dbProduct.price,
        rating: dbProduct.rating || 0, // Default to 0 if missing
        image: dbProduct.image_url || dbProduct.image, // Handle potentially different column names
        category: dbProduct.category as ProductCategory,
        leadTimeMinutes: dbProduct.lead_time_minutes,
        color: dbProduct.color,
        video: dbProduct.video_url || dbProduct.video,
    };
};

export const fetchProducts = async (
    category?: string,
    sortBy: "price_asc" | "price_desc" | "rating" | "newest" = "newest"
): Promise<Product[]> => {
    try {
        // If client is not configured, return mock data
        if (!supabase) {
            console.warn("Supabase client not configured, using mock data");
            let filtered = [...MOCK_PRODUCTS];
            if (category && category !== "All") {
                filtered = filtered.filter(p => p.category === category);
            }
            return sortProducts(filtered, sortBy);
        }

        let query = supabase.from("products").select("*");

        if (category && category !== "All") {
            query = query.eq("category", category);
        }

        // Apply sorting
        switch (sortBy) {
            case "price_asc":
                query = query.order("price", { ascending: true });
                break;
            case "price_desc":
                query = query.order("price", { ascending: false });
                break;
            case "rating":
                query = query.order("rating", { ascending: false });
                break;
            case "newest":
            default:
                query = query.order("created_at", { ascending: false });
                break;
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching products from Supabase:", error);
            if (USE_MOCK_FALLBACK) {
                console.warn("Falling back to mock data due to error");
                let filtered = [...MOCK_PRODUCTS];
                if (category && category !== "All") {
                    filtered = filtered.filter(p => p.category === category);
                }
                return sortProducts(filtered, sortBy);
            }
            throw error;
        }

        if (!data || data.length === 0) {
            if (USE_MOCK_FALLBACK) {
                let filtered = [...MOCK_PRODUCTS];
                if (category && category !== "All") {
                    filtered = filtered.filter(p => p.category === category);
                }
                return sortProducts(filtered, sortBy);
            }
            return [];
        }

        return data.map(mapDBProductToType);
    } catch (err) {
        console.error("Unexpected error in fetchProducts:", err);
        if (USE_MOCK_FALLBACK) {
            let filtered = [...MOCK_PRODUCTS];
            if (category && category !== "All") {
                filtered = filtered.filter(p => p.category === category);
            }
            return sortProducts(filtered, sortBy);
        }
        return [];
    }
};

export const fetchProductById = async (id: string): Promise<Product | undefined> => {
    try {
        if (!supabase) {
            return MOCK_PRODUCTS.find(p => p.id === id);
        }

        const { data, error } = await supabase
            .from("products")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            console.error("Error fetching product by ID:", error);
            return MOCK_PRODUCTS.find(p => p.id === id);
        }

        if (!data) return undefined;

        return mapDBProductToType(data);

    } catch (err) {
        console.error("Error in fetchProductById:", err);
        return MOCK_PRODUCTS.find(p => p.id === id);
    }
}

// Helper for sorting mock data
const sortProducts = (products: Product[], sortBy: string): Product[] => {
    switch (sortBy) {
        case "price_asc":
            return products.sort((a, b) => a.price - b.price);
        case "price_desc":
            return products.sort((a, b) => b.price - a.price);
        case "rating":
            return products.sort((a, b) => b.rating - a.rating);
        case "newest":
        default:
            // Mock data doesn't have dates, just return as is or shuffle
            return products;
    }
};
