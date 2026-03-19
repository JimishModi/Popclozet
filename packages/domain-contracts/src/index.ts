/**
 * Domain Contracts - Shared Types
 * 
 * @popclozet/domain-contracts v1.0.0
 * 
 * CONTRACT FREEZE RULE:
 * This package is versioned and treated as immutable within a release cycle.
 * No app may define its own order states, roles, or status strings.
 */

// ==========================================
// ROLE TYPES (FROZEN)
// ==========================================


export type UserRole = 'customer' | 'rider' | 'warehouse' | 'admin';

export type ActorRole = 'customer' | 'rider' | 'warehouse';

// ==========================================
// ORDER STATUS (FROZEN)
// ==========================================

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'packed'
    | 'ready_for_pickup'
    | 'rider_assigned'
    | 'driver_arrived_warehouse'
    | 'order_picked_up'
    | 'dispatched'
    | 'out_for_delivery'
    | 'delivered'
    | 'in_use'
    | 'return_requested'
    | 'return_scheduled'
    | 'return_dispatched'
    | 'return_picked_up'
    | 'return_at_warehouse'
    | 'returned'
    | 'return_completed'
    | 'completed'
    | 'cancelled';

// ==========================================
// USER & PROFILE
// ==========================================

export interface User {
    id: string;
    email: string;
    role: UserRole;
    profile?: UserProfile;
    created_at: string;
}

export interface UserProfile {
    id: string;
    user_id: string;
    full_name: string;
    phone: string;
    avatar_url?: string;
    role: UserRole;
    onboarding_completed: boolean;
    measurements?: BodyMeasurements;
    created_at: string;
    updated_at: string;
}

export interface BodyMeasurements {
    bust?: number;
    waist?: number;
    hip?: number;
    height?: number;
    weight?: number;
    shoulder_width?: number;
    inseam?: number;
    preferred_fit?: 'tight' | 'regular' | 'loose';
}

// ==========================================
// ADDRESS
// ==========================================

export interface Address {
    id: string;
    user_id: string;
    label: string;
    full_address: string;
    latitude: number;
    longitude: number;
    geohash: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

// ==========================================
// PRODUCT
// ==========================================

export interface Product {
    id: string;
    name: string;
    brand: string;
    description: string;
    category: string;
    gender: 'men' | 'women' | 'unisex';
    occasion: string[];
    rental_price: number;
    deposit_amount: number;
    images: string[];
    fabric_details: FabricDetails;
    sizes_available: ProductSize[];
    hygiene_info: HygieneInfo;
    is_available: boolean;
    created_at: string;
}

export interface FabricDetails {
    composition: string;
    stretch_percentage: number;
    care_instructions: string[];
    comfort_rating: number;
}

export interface ProductSize {
    size: string;
    measurements: {
        bust?: number;
        waist?: number;
        hip?: number;
        length?: number;
    };
    stock_count: number;
}

export interface HygieneInfo {
    last_sanitized: string;
    hygiene_rating: 'A+' | 'A' | 'B' | 'C';
    is_sealed: boolean;
    lifecycle_count: number;
    sanitization_method: string;
}

// ==========================================
// CART
// ==========================================

export interface CartItem {
    id: string;
    product_id: string;
    product: Product;
    size: string;
    rental_duration_days: number;
    reservation_expires_at: string;
    added_at: string;
}

// ==========================================
// ORDER
// ==========================================

export interface Order {
    id: string;
    user_id: string;
    items: OrderItem[];
    delivery_address: Address;
    rental_start_date: string;
    rental_end_date: string;
    total_amount: number;
    deposit_amount: number;
    status: OrderStatus;
    delivery_eta?: string;
    rider_id?: string;
    rider_distance?: number;
    otp_delivery?: string;
    otp_return?: string;
    return_pickup_date?: string;
    return_time_slot?: string;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    individual_id?: string | null;
    product: Product;
    size: string;
    rental_price: number;
    deposit_amount: number;
}

// ==========================================
// RIDER & PROXIMITY
// ==========================================

export interface RiderLocation {
    rider_id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

export interface ProximityState {
    distance: number;
    status: 'far' | 'near' | 'arrived';
    showMap: boolean;
}

// ==========================================
// RETURN
// ==========================================

export interface ReturnRequest {
    id: string;
    order_id: string;
    reason: string;
    pickup_slot: string;
    pickup_address: Address;
    status: 'requested' | 'approved' | 'dispatched' | 'picked_up' | 'completed';
    pickup_eta?: string;
    rider_id?: string;
    approved_at?: string;
    picked_up_at?: string;
    received_at?: string;
    completed_at?: string;
    created_at: string;
}

// ==========================================
// UI TYPES
// ==========================================

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

export interface SearchFilters {
    gender?: 'men' | 'women' | 'unisex';
    occasion?: string[];
    category?: string[];
    priceRange?: {
        min: number;
        max: number;
    };
    size?: string[];
    availability?: boolean;
}

// ==========================================
// STATE MACHINE TYPES
// ==========================================

export interface TransitionResult {
    success: boolean;
    from?: OrderStatus;
    to?: OrderStatus;
    code?: string;
    message?: string;
    actor_role?: ActorRole;
    actor_id?: string;
}
