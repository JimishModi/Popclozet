// src/components/ExperienceGrid.tsx
import { ArrowDownRight, Sparkles, Clock, Truck, RefreshCcw } from "lucide-react";

export default function ExperienceGrid() {
    const steps = [
        {
            id: "01",
            title: "Curate",
            description: "Browse our edit of runway-fresh looks. Filter by mood, occasion, or designer.",
            icon: Sparkles,
            color: "bg-emerald-50",
        },
        {
            id: "02",
            title: "Request",
            description: "Select your items and book a 60-minute delivery slot. No subscription required.",
            icon: Clock,
            color: "bg-purple-50",
        },
        {
            id: "03",
            title: "Receive",
            description: "A courier arrives with your garment bag. Try it on. Keep what you love for 4 days.",
            icon: Truck,
            color: "bg-rose-50",
        },
        {
            id: "04",
            title: "Return",
            description: "Pack it up in the reusable tote. We pick it up. We handle the dry cleaning.",
            icon: RefreshCcw,
            color: "bg-amber-50",
        },
    ];

    return (
        <section className="py-24 border-y border-black bg-[#F9F8F6] text-black">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-8">
                    <h2 className="text-5xl md:text-7xl font-playfair leading-[0.9]">
                        The <span className="italic text-purple-600">PopClozet</span> <br />
                        Experience
                    </h2>
                    <div className="max-w-md space-y-4 pt-4">
                        <h3 className="text-xl font-medium leading-relaxed">
                            We've reimagined the closet as a service. Fast, frictionless, and infinitely expandable.
                        </h3>
                        <div className="h-0.5 w-24 bg-black mt-6" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-black">
                    {steps.map((step) => (
                        <div
                            key={step.id}
                            className={`
                relative p-8 md:p-12 border-r border-b border-black min-h-[420px] flex flex-col justify-between group hover:bg-white transition-colors duration-500
              `}
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-8">
                                    <span className="block text-6xl font-playfair font-bold opacity-10">{step.id}</span>
                                    <step.icon className="w-6 h-6 stroke-[1.5]" />
                                </div>

                                <h3 className="text-xl font-bold uppercase tracking-widest mb-4">{step.title}</h3>
                                <p className="text-gray-600 leading-relaxed text-sm md:text-base">{step.description}</p>
                            </div>

                            <div className="relative z-10 flex justify-end opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                <ArrowDownRight className="w-5 h-5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
