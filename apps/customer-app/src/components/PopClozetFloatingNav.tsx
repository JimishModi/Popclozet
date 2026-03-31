import { FloatingNav } from "./ui/floating-navbar";
import { IconHome, IconHanger, IconUser, IconShoppingBag, IconHelp } from "@tabler/icons-react";
import { useCart } from "@/context/CartContext";

export function popclozetFloatingNav() {
    const { totalItems } = useCart();
    const navItems = [
        {
            name: "Home",
            link: "/",
            icon: <IconHome className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
        {
            name: "Collections",
            link: "/collections",
            icon: <IconHanger className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
        {
            name: "How It Works",
            link: "/how-it-works",
            icon: <IconHelp className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
        {
            name: "Cart",
            link: "/cart",
            icon: (
                <div className="relative">
                    <IconShoppingBag className="h-4 w-4 text-neutral-500 dark:text-white" />
                    {totalItems > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[12px] h-3 flex items-center justify-center text-[7px] font-bold text-white bg-[#f2546d] rounded-full px-0.5 shadow-lg shadow-[#f2546d]/30">
                            {totalItems > 9 ? '9+' : totalItems}
                        </span>
                    )}
                </div>
            ),
        },
        {
            name: "Profile",
            link: "/profile",
            icon: <IconUser className="h-4 w-4 text-neutral-500 dark:text-white" />,
        },
    ];
    return (
        <div className="relative w-full hidden md:block">
            <FloatingNav navItems={navItems} />
        </div>
    );
}
