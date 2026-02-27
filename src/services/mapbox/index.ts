/**
 * Mapbox Services - Role-Based Module Structure
 * 
 * Phase 2: Re-export pattern for backward compatibility
 * 
 * Import paths:
 * - General: import { ... } from '@/services/mapbox'
 * - Customer: import { ... } from '@/services/mapbox/customer'
 * - Delivery: import { ... } from '@/services/mapbox/delivery'
 */

// Core utilities (shared)
export {
    initializeMap,
    destroyMap,
    getMapInstance,
    drawRoute,
    isMapboxAvailable,
    getMapboxToken,
} from './core';

// Customer-specific (lazy-loaded, static fallback)
export {
    getStaticMapUrl,
    initCustomerTrackingMap,
    addCustomerMarker,
    shouldUseStaticFallback,
} from './customer';

// Delivery-specific (navigation-focused)
export {
    initDeliveryNavigationMap,
    addRiderMarker,
    updateRiderLocation,
    removeRiderMarker,
} from './delivery';
