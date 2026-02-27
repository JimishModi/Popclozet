import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ShoppingBag, Heart, Search, ArrowRight } from "lucide-react";

interface EmptyStateProps {
    type: "cart" | "wishlist" | "search";
    title?: string;
    description?: string;
    actionLabel?: string;
    actionLink?: string;
}

const EmptyState = ({
    type,
    title,
    description,
    actionLabel = "Start Exploring",
    actionLink = "/"
}: EmptyStateProps) => {

    const getContent = () => {
        switch (type) {
            case "cart":
                return {
                    icon: <ShoppingBag className="w-16 h-16 text-primary" />,
                    defaultTitle: "Your bag is empty",
                    defaultDesc: "Looks like you haven't added any items yet. Explore our latest collections to find your perfect look.",
                    gradient: "from-primary/20 to-secondary/20"
                };
            case "wishlist":
                return {
                    icon: <Heart className="w-16 h-16 text-accent" />,
                    defaultTitle: "Your wishlist is empty",
                    defaultDesc: "Save items you love to your wishlist. Review them anytime and easily add them to your bag.",
                    gradient: "from-accent/20 to-primary/20"
                };
            case "search":
                return {
                    icon: <Search className="w-16 h-16 text-secondary" />,
                    defaultTitle: "No results found",
                    defaultDesc: "We couldn't find what you're looking for. Try checking for typos or use different keywords.",
                    gradient: "from-secondary/20 to-primary/20"
                };
        }
    };

    const content = getContent();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center py-16 px-4"
        >
            <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${content.gradient} flex items-center justify-center mb-6 animate-pulse`}>
                <div className="bg-background w-28 h-28 rounded-full flex items-center justify-center shadow-sm">
                    {content.icon}
                </div>
            </div>

            <h3 className="text-2xl md:text-3xl font-bold mb-3">
                {title || content.defaultTitle}
            </h3>

            <p className="text-muted-foreground max-w-md mb-8 text-lg">
                {description || content.defaultDesc}
            </p>

            {type !== "search" && (
                <Link
                    to={actionLink}
                    className="btn-primary inline-flex items-center gap-2 group"
                >
                    {actionLabel}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            )}
        </motion.div>
    );
};

export default EmptyState;
