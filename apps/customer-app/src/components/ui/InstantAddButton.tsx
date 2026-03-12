
import { Plus, Minus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFlyToCart } from "@/context/FlyToCartContext";

interface InstantAddButtonProps {
    quantity: number;
    onAdd: () => void;
    onIncrement: () => void;
    onDecrement: () => void;
    className?: string;
    productImage?: string;
}

const InstantAddButton = ({
    quantity,
    onAdd,
    onIncrement,
    onDecrement,
    className,
    productImage,
}: InstantAddButtonProps) => {
    const isInCart = quantity > 0;
    const { triggerFlyAnimation } = useFlyToCart();

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdd();

        if (productImage) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            triggerFlyAnimation(productImage, rect);
        }
    };

    return (
        <div
            className={cn(
                "relative h-10 overflow-hidden transition-all duration-300 ease-in-out",
                isInCart ? "w-32" : "w-full",
                className
            )}
        >
            {/* Add Button State */}
            <Button
                onClick={handleAdd}
                className={cn(
                    "absolute inset-0 w-full h-full transition-opacity duration-300",
                    isInCart ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
            >
                <ShoppingBag className="mr-2 h-4 w-4" /> Add
            </Button>

            {/* Counter State */}
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-between bg-primary text-primary-foreground rounded-md px-1 transition-opacity duration-300",
                    isInCart ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDecrement();
                    }}
                    aria-label="Decrease quantity"
                >
                    <Minus className="h-4 w-4" />
                </Button>
                <span className="font-bold text-sm tabular-nums">{quantity}</span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={(e) => {
                        e.stopPropagation();
                        onIncrement();
                    }}
                    aria-label="Increase quantity"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default InstantAddButton;
