import { FocusCards } from "@/components/ui/focus-cards";

export function FocusCardsDemo() {
    const cards = [
        {
            title: "Summer Breeze",
            src: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=3540&auto=format&fit=crop",
        },
        {
            title: "Office Chic",
            src: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?q=80&w=3546&auto=format&fit=crop",
        },
        {
            title: "Party Night",
            src: "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=3540&auto=format&fit=crop",
        },
        {
            title: "Wedding Guest",
            src: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=3483&auto=format&fit=crop",
        },
        {
            title: "Vacation Vibes",
            src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=3546&auto=format&fit=crop",
        },
        {
            title: "Date Night",
            src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=3546&auto=format&fit=crop",
        },
    ];
    return <FocusCards cards={cards} />;
}
