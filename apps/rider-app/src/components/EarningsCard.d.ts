/**
 * Earnings Card Component
 *
 * Displays today's earnings with stats
 */
interface EarningsCardProps {
    todayEarnings: number;
    predictedEarnings?: number;
    ordersCount: number;
    onlineHours: number;
    bonusPay?: number;
    bonusProgress?: number;
    isOnline?: boolean;
    onClick?: () => void;
    className?: string;
}
export declare function EarningsCard({ todayEarnings, predictedEarnings, ordersCount, onlineHours, bonusPay, bonusProgress, isOnline, onClick, className, }: EarningsCardProps): import("react/jsx-runtime").JSX.Element;
/**
 * Bonus Progress Card
 */
interface BonusCardProps {
    bonusPay: number;
    currentOrders: number;
    targetOrders: number;
    milestones: number[];
    className?: string;
}
export declare function BonusCard({ bonusPay, currentOrders, targetOrders, milestones, className, }: BonusCardProps): import("react/jsx-runtime").JSX.Element;
export default EarningsCard;
