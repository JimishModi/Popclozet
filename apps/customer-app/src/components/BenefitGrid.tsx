import { Sparkles, Clock, Leaf, Shirt } from "lucide-react";

const benefits = [
  {
    icon: Sparkles,
    title: "Event Ready 'Pop Looks'",
    description:
      "Got a date, party, or fest? Rent a complete, stylist-approved outfit with one tap. Your 'go to' look for any event.",
  },
  {
    icon: Shirt,
    title: "The 'Mix & Match' Closet",
    description:
      "Just need a new top? Browse thousands of individual pieces to complete the look you already have. Total creative freedom.",
  },
  {
    icon: Clock,
    title: "Rent It ASAP",
    description:
      "Your plans are spontaneous, so we are too. Your outfit arrives at your door fresh, clean, and ready to wear in 60 minutes.",
  },
  {
    icon: Leaf,
    title: "Smart, Simple, Sustainable",
    description:
      "Look amazing for 10 to 15% of the retail price. When you're done, just use the free return bag. We handle all the dry cleaning.",
  },
];

const BenefitGrid = () => {
  return (
    <section id="benefits" className="py-16 md:py-24 px-4 bg-background">
      <div className="container mx-auto max-w-7xl">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-headline text-center mb-12 md:mb-20">
          Your Endless Closet, Explained.
        </h2>

        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="group text-center space-y-4 md:space-y-5 p-6 md:p-8 rounded-2xl md:rounded-3xl bg-card shadow-card hover:shadow-soft transition-all duration-300 hover:-translate-y-2 border border-border/50"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
                  <Icon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-headline">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-base">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BenefitGrid;
