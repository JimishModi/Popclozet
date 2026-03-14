/**
 * Global Configuration
 * 
 * Central place to manage application settings and feature flags.
 * Toggle USE_MOCK_DATA to switch between mock data and real Supabase backend.
 */

export const config = {
    // Toggle this to false to use real Supabase data
    USE_MOCK_DATA: false,

    // Feature flags
    features: {
        rentalWorkflow: true,
        riderWallet: true,
        geofencing: true,
    },

    // API endpoints (if any)
    api: {
        timeout: 10000,
    }
};
