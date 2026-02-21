/**
 * Status Toggle Component
 *
 * Online/Offline toggle for rider status
 */
interface StatusToggleProps {
    isOnline: boolean;
    onToggle: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
}
export declare function StatusToggle({ isOnline, onToggle, isLoading, disabled, className, }: StatusToggleProps): import("react/jsx-runtime").JSX.Element;
/**
 * Large Status Toggle with animation
 */
interface LargeStatusToggleProps extends StatusToggleProps {
    searchingText?: string;
}
export declare function LargeStatusToggle({ isOnline, onToggle, isLoading, disabled, searchingText, className, }: LargeStatusToggleProps): import("react/jsx-runtime").JSX.Element;
export default StatusToggle;
