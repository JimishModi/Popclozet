/**
 * Swipe To Accept Component
 *
 * Swipeable button for accepting orders with haptic feedback
 */
interface SwipeToAcceptProps {
    onAccept: () => void;
    text?: string;
    disabled?: boolean;
    className?: string;
}
export declare function SwipeToAccept({ onAccept, text, disabled, className }: SwipeToAcceptProps): import("react/jsx-runtime").JSX.Element;
export default SwipeToAccept;
