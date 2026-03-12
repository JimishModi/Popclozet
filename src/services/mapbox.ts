/**
 * Mapbox Service - Legacy Re-export
 * 
 * Phase 2: This file now re-exports from the role-based module structure.
 * Maintained for backward compatibility with existing imports.
 * 
 * New imports should use:
 * - '@/services/mapbox/customer' for customer-facing maps
 * - '@/services/mapbox/delivery' for rider navigation
 * - '@/services/mapbox/core' for shared utilities
 * 
 * @deprecated Import from '@/services/mapbox' instead
 */

export * from './mapbox/index';
