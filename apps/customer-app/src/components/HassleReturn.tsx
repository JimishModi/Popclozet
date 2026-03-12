// src/components/HassleReturn.tsx
import { motion } from "framer-motion";
import { Gift, Shirt, Clock, Leaf } from "lucide-react";

const HassleReturn = () => {
  const steps = [
    {
      icon: Gift,
      iconBg: "from-pink-200 to-pink-100",
      iconColor: "text-pink-600",
      title: "Event-Ready 'Pop Looks'",
      description: "Got a date, party, or test? Rent a complete, stylist-approved outfit with one tap. Your 'go-to' look for any event.",
    },
    {
      icon: Shirt,
      iconBg: "from-blue-200 to-cyan-100",
      iconColor: "text-blue-600",
      title: "The 'Mix & Match' Closet",
      description: "Just need a new top? Browse thousands of individual pieces to complete the look you already have. Total creative freedom.",
    },
    {
      icon: Clock,
      iconBg: "from-emerald-200 to-green-100",
      iconColor: "text-emerald-600",
      title: "Rent It ASAP",
      description: "Your plans are spontaneous, so are we. Your outfit arrives at your door, fresh, clean, and ready to wear in 60 minutes.",
    },
    {
      icon: Leaf,
      iconBg: "from-purple-200 to-violet-100",
      iconColor: "text-purple-600",
      title: "Smart, Simple, Sustainable",
      description: "Look amazing for 10-15% of the retail price. When you're done, use free return pickup. We handle the dry cleaning and QA.",
    },
  ];

  return (
    <section className="bg-[#F6F0E0] dark:bg-[#1A1A1A] py-16 md:py-24">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-playfair font-bold mb-3">
            <span className="text-[#C0E2AD] dark:text-[#99C08D]">Return Without Worries</span>
          </h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-playfair font-bold mb-4 text-black dark:text-[#FAFAFA]">
            We Handle Every Step
          </h3>
          <p className="text-base md:text-lg text-black/60 dark:text-[#FAFAFA]/60 max-w-2xl mx-auto">
            No stress, no hassle. Just pack it up and we'll handle the rest.
          </p>
        </div>

        {/* Minimal Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-[#282828] rounded-3xl p-8 text-center shadow-sm hover:shadow-lg transition-all duration-300"
            >
              {/* Circular Gradient Icon */}
              <div className="flex justify-center mb-6">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.iconBg} dark:from-[#282828] dark:to-[#1A1A1A] dark:border dark:border-[#FAFAFA]/10 flex items-center justify-center`}>
                  <step.icon className={`w-7 h-7 ${step.iconColor} dark:text-[#FAFAFA]`} strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold mb-3 text-black dark:text-[#FAFAFA] font-playfair">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-sm leading-relaxed text-black/60 dark:text-[#FAFAFA]/60">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HassleReturn;
