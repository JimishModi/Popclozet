
import { FloatingNav } from "./ui/floating-navbar";
import { IconHome, IconHanger, IconUser, IconShoppingBag, IconHelp } from "@tabler/icons-react";

export function PopClozetFloatingNav() {
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
            icon: <IconShoppingBag className="h-4 w-4 text-neutral-500 dark:text-white" />,
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
