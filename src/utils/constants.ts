export const API_ENDPOINTS = {
    // Products
    PRODUCTS: '/products',
    PRODUCT_DETAIL: (id: string) => `/products/${id}`,

    // Cart
    CART: '/cart_items',
    CART_ITEM: (id: string) => `/cart_items/${id}`,

    // Orders
    ORDERS: '/orders',
    ORDER_DETAIL: (id: string) => `/orders/${id}`,
    ORDER_ITEMS: '/order_items',

    // Profile
    PROFILE: '/profiles',
    ADDRESSES: '/addresses',
    ADDRESS: (id: string) => `/addresses/${id}`,

    // Returns
    RETURN_REQUESTS: '/return_requests',
    RETURN_REQUEST: (id: string) => `/return_requests/${id}`,

    // Realtime
    RIDER_LOCATIONS: '/rider_locations',
} as const;

export const ORDER_STATUSES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PACKED: 'packed',
    DISPATCHED: 'dispatched',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    IN_USE: 'in_use',
    RETURN_REQUESTED: 'return_requested',
    RETURN_DISPATCHED: 'return_dispatched',
    RETURN_PICKED_UP: 'return_picked_up',
    RETURNED: 'returned',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const;

export const PROXIMITY_THRESHOLDS = {
    FAR: 1000, // meters
    NEAR: 100, // meters
} as const;

export const CART_RESERVATION_MINUTES = 15;

export const HYGIENE_RATINGS = {
    'A+': { color: 'green', label: 'Excellent' },
    'A': { color: 'green', label: 'Very Good' },
    'B': { color: 'yellow', label: 'Good' },
    'C': { color: 'orange', label: 'Fair' },
} as const;

export const OCCASIONS = [
    'wedding',
    'party',
    'casual',
    'formal',
    'festive',
    'business',
    'date',
    'vacation',
] as const;

export const GENDERS = [
    { value: 'women', label: 'Women' },
    { value: 'men', label: 'Men' },
    { value: 'unisex', label: 'Unisex' },
] as const;

export const RETURN_REASONS = [
    { value: 'wrong_size', label: 'Wrong Size' },
    { value: 'damaged', label: 'Damaged Item' },
    { value: 'not_as_described', label: 'Not as Described' },
    { value: 'changed_mind', label: 'Changed Mind' },
    { value: 'poor_quality', label: 'Poor Quality' },
    { value: 'other', label: 'Other' },
] as const;
