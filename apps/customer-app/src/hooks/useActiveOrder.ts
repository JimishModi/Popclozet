import { useEffect, useState } from "react";
import { useAuth } from "@popclozet/auth";

type OrderStatus = "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "in_use" | "return_requested";

export interface ActiveOrder {
    id: string;
    status: OrderStatus;
    etaMinutes?: number;
    itemCount: number;
    deliveryPartner?: string;
    created_at: string;
    // Rental-specific fields
    isRental?: boolean;
    rentalDurationDays?: number;
    rentalEndDate?: string;
    pickupScheduledAt?: string;
}

/**
 * Hook to fetch and monitor active orders for the current user
 * Returns the most recent active order (not delivered)
 */
export function useActiveOrder() {
    const { user } = useAuth();
    const config = { USE_MOCK_DATA: true }; // TODO: Import from @popclozet/api-client when package exports are fixed

    const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActiveOrders = async () => {
            if (config.USE_MOCK_DATA) {
                // Calculate rental end date (3 days from now for demo)
                const rentalEndDate = new Date();
                rentalEndDate.setDate(rentalEndDate.getDate() + 3);

                // Mock data for development - REMOVE IN PRODUCTION
                const mockOrder: ActiveOrder = {
                    id: "ORD123456",
                    status: "in_use", // Changed to rental status
                    etaMinutes: 15,
                    itemCount: 2,
                    deliveryPartner: "Mukesh",
                    created_at: new Date().toISOString(),
                    // Rental fields
                    isRental: true,
                    rentalDurationDays: 3,
                    rentalEndDate: rentalEndDate.toISOString(),
                };

                setActiveOrder(mockOrder);
                setLoading(false);
                return;
            }

            // Real Supabase integration logic would go here
            if (!user) return;

            // ... implementation specific to real data
        };

        fetchActiveOrders();

        // Poll every 30 seconds for updates
        const interval = setInterval(fetchActiveOrders, 30000);
        return () => clearInterval(interval);
    }, [user, config.USE_MOCK_DATA]);

    return { activeOrder, loading };
}
