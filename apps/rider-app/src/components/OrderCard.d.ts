/**
 * Order Card Component
 *
 * Displays order details with pickup/dropoff locations
 */
export interface OrderCardProps {
    id: string;
    orderType?: 'delivery' | 'pickup';
    pickup: {
        name: string;
        address: string;
    };
    dropoff: {
        name: string;
        address: string;
    };
    earnings: number;
    distance: string;
    duration: string;
    status?: 'pending' | 'accepted' | 'picked_up' | 'delivering' | 'delivered';
    customerPhone?: string;
    customerName?: string;
    itemCount?: number;
    onCall?: () => void;
    onMessage?: () => void;
    onClick?: () => void;
    variant?: 'default' | 'compact' | 'detailed';
    className?: string;
}
export declare function OrderCard({ id, orderType, pickup, dropoff, earnings, distance, duration, status, customerPhone, customerName, itemCount, onCall, onMessage, onClick, variant, className, }: OrderCardProps): import("react/jsx-runtime").JSX.Element;
/**
 * Order Card Skeleton for loading states
 */
export declare function OrderCardSkeleton(): import("react/jsx-runtime").JSX.Element;
export default OrderCard;
