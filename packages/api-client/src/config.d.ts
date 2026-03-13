/**
 * Global Configuration
 *
 * Central place to manage application settings and feature flags.
 * Toggle USE_MOCK_DATA to switch between mock data and real Supabase backend.
 */
export declare const config: {
    USE_MOCK_DATA: boolean;
    features: {
        rentalWorkflow: boolean;
        riderWallet: boolean;
        geofencing: boolean;
    };
    api: {
        timeout: number;
    };
};
//# sourceMappingURL=config.d.ts.map