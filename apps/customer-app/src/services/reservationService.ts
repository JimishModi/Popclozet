/**
 * Reservation Service
 * Handles product and bundle reservations with offline support
 * NOW INTEGRATED with sync engine for optimistic updates
 */

// import { supabase } from '@popclozet/api-client';
import { supabase } from '@popclozet/api-client';

// =====================================================
// Types
// =====================================================

export interface ReservationRequest {
    inventoryItemId?: string;
    bundleId?: string;
    productId?: string;
    startDate: Date;
    endDate: Date;
    deliveryAddress?: string;
    deliveryNotes?: string;
}

export interface Reservation {
    id: string;
    userId: string;
    inventoryItemId: string;
    bundleId?: string;
    bookingPeriod: {
        start: Date;
        end: Date;
    };
    status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'returned';
    rentalPrice: number;
    discountApplied?: number;
    deliveryAddress?: string;
    deliveryNotes?: string;
    createdAt: Date;
    confirmedAt?: Date;
}

export interface AvailabilityCheck {
    productId: string;
    startDate: Date;
    endDate: Date;
}

export interface ProductAvailability {
    isAvailable: boolean;
    availableItems: Array<{
        inventoryItemId: string;
        size: string;
        conditionGrade: string;
    }>;
}

export interface BundleAvailability {
    isAvailable: boolean;
    components: Array<{
        productId: string;
        productName: string;
        isRequired: boolean;
        requiredQuantity: number;
        availableQuantity: number;
        isAvailable: boolean;
    }>;
}

// =====================================================
// Service Class
// =====================================================

class ReservationService {
    // =====================================================
    // Availability Checking
    // =====================================================

    /**
     * Check if a product has available inventory for given dates
     */
    async checkProductAvailability(
        productId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ProductAvailability> {
        try {
            const { data, error } = await (supabase.rpc as any)('check_product_availability', {
                p_product_id: productId,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            });

            if (error) throw error;

            return {
                isAvailable: data && data.length > 0,
                availableItems: (data || []).map((item: any) => ({
                    inventoryItemId: item.inventory_item_id,
                    size: item.size,
                    conditionGrade: item.condition_grade
                }))
            };
        } catch (error) {
            console.error('❌ Error checking product availability:', error);
            return { isAvailable: false, availableItems: [] };
        }
    }

    /**
     * Check if all components of a bundle are available
     */
    async checkBundleAvailability(
        bundleId: string,
        startDate: Date,
        endDate: Date
    ): Promise<BundleAvailability> {
        try {
            // First check overall availability
            const { data: isAvailable, error: availError } = await (supabase.rpc as any)('check_bundle_availability', {
                p_bundle_id: bundleId,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            });

            if (availError) throw availError;

            // Get detailed component availability
            const { data: details, error: detailsError } = await (supabase.rpc as any)('get_bundle_availability_details', {
                p_bundle_id: bundleId,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            });

            if (detailsError) throw detailsError;

            return {
                isAvailable: !!isAvailable,
                components: (details || []).map((item: any) => ({
                    productId: item.product_id,
                    productName: item.product_name,
                    isRequired: item.is_required,
                    requiredQuantity: item.required_quantity,
                    availableQuantity: Number(item.available_quantity),
                    isAvailable: item.is_available
                }))
            };
        } catch (error) {
            console.error('❌ Error checking bundle availability:', error);
            return { isAvailable: false, components: [] };
        }
    }

    /**
     * Get available dates for a product (next 30 days)
     */
    async getProductAvailableDates(
        productId: string,
        daysAhead: number = 30
    ): Promise<Map<string, number>> {
        try {
            const { data, error } = await (supabase.rpc as any)('get_product_available_dates', {
                p_product_id: productId,
                p_days_ahead: daysAhead
            });

            if (error) throw error;

            const availabilityMap = new Map<string, number>();
            (data || []).forEach((item: any) => {
                availabilityMap.set(item.available_date, Number(item.available_count));
            });

            return availabilityMap;
        } catch (error) {
            console.error('❌ Error getting available dates:', error);
            return new Map();
        }
    }

    // =====================================================
    // Reservations
    // =====================================================

    /**
     * Create a reservation (with offline support and optimistic updates)
     * Returns immediately with optimistic response
     */
    async createReservation(request: ReservationRequest): Promise<{
        success: boolean;
        reservationId?: string;
        error?: string;
    }> {

        // Online - try to create directly
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) {
                return { success: false, error: 'Please sign in to make a reservation' };
            }

            let reservationId: string | undefined;

            // Bundle reservation
            if (request.bundleId) {
                const { data, error } = await (supabase.rpc as any)('reserve_bundle', {
                    p_bundle_id: request.bundleId,
                    p_user_id: user.user.id,
                    p_start_date: request.startDate.toISOString(),
                    p_end_date: request.endDate.toISOString(),
                    p_delivery_address: request.deliveryAddress,
                    p_delivery_notes: request.deliveryNotes
                });

                if (error) throw error;

                const result = data?.[0];
                if (!result?.success) {
                    return { success: false, error: result?.error_message || 'Reservation failed' };
                }

                reservationId = result.reservation_ids?.[0];
            }
            // Single item reservation
            else if (request.inventoryItemId) {
                const { data, error } = await (supabase.from('reservations') as any).insert({
                    user_id: user.user.id,
                    inventory_item_id: request.inventoryItemId,
                    booking_period: `[${request.startDate.toISOString()},${request.endDate.toISOString()}]`,
                    delivery_address: request.deliveryAddress,
                    delivery_notes: request.deliveryNotes
                }).select().single();

                if (error) {
                    // Check for overlap constraint violation
                    if (error.code === '23P01') {
                        return { success: false, error: 'This item is no longer available for the selected dates' };
                    }
                    throw error;
                }

                return { success: true, reservationId: data.id };
            }

            return { success: false, error: 'No item or bundle specified' };
        } catch (error) {
            console.error('❌ Reservation error:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Reservation failed'
            };
        }
    }


    /**
     * Get user's reservations
     */
    async getUserReservations(): Promise<Reservation[]> {
        try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.user) return [];

            const { data, error } = await (supabase.from('reservations') as any)
                .select(`
                    *,
                    inventory_items (
                        id,
                        size,
                        products (
                            id,
                            name,
                            image_url
                        )
                    ),
                    bundles (
                        id,
                        name,
                        image_url
                    )
                `)
                .eq('user_id', user.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map((r: any) => this.transformReservation(r));
        } catch (error) {
            console.error('❌ Error fetching reservations:', error);
            return [];
        }
    }

    async cancelReservation(reservationId: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        // Online - try to cancel directly
        try {
            const { error } = await (supabase.from('reservations') as any)
                .update({ status: 'cancelled' })
                .eq('id', reservationId);

            if (error) throw error;

            console.log('✅ Reservation cancelled:', reservationId);

            return { success: true };
        } catch (error) {
            console.error('❌ Cancellation failed:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Cancellation failed'
            };
        }
    }
    /**
     * Get reservation by ID
     */
    async getReservation(reservationId: string): Promise<Reservation | null> {
        try {
            const { data, error } = await (supabase.from('reservations') as any)
                .select('*')
                .eq('id', reservationId)
                .single();

            if (error) throw error;
            return data ? this.transformReservation(data) : null;
        } catch (error) {
            console.error('❌ Error fetching reservation:', error);
            return null;
        }
    }

    // =====================================================
    // Helpers
    // =====================================================

    private transformReservation(data: any): Reservation {
        // Parse PostgreSQL range format [start,end]
        const periodMatch = data.booking_period?.match(/\[(.*?),(.*?)\]/);

        return {
            id: data.id,
            userId: data.user_id,
            inventoryItemId: data.inventory_item_id,
            bundleId: data.bundle_id,
            bookingPeriod: {
                start: periodMatch ? new Date(periodMatch[1]) : new Date(),
                end: periodMatch ? new Date(periodMatch[2]) : new Date()
            },
            status: data.status,
            rentalPrice: parseFloat(data.rental_price) || 0,
            discountApplied: data.discount_applied ? parseFloat(data.discount_applied) : undefined,
            deliveryAddress: data.delivery_address,
            deliveryNotes: data.delivery_notes,
            createdAt: new Date(data.created_at),
            confirmedAt: data.confirmed_at ? new Date(data.confirmed_at) : undefined
        };
    }
}

// Export singleton instance
export const reservationService = new ReservationService();
