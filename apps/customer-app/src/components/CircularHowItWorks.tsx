import { motion } from "framer-motion";
import { Sparkles, Package, RefreshCw } from "lucide-react";

const CircularHowItWorks = () => {
  const steps = [
    {
      number: "01",
      title: "Pick Your Look",
      description: "Browse endless styles for any occasion. From casual to glam, we've got you covered.",
      icon: Sparkles,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      number: "02",
      title: "Delivered in 60 Mins",
      description: "Your outfit arrives, ready to wear. Lightning-fast delivery straight to your door.",
      icon: Package,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      number: "03",
      title: "Wear & Return",
      description: "Enjoy the moment, create memories. We handle cleaning and logistics.",
      icon: RefreshCw,
      gradient: "from-emerald-500 to-teal-500",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-32 px-4 bg-gradient-to-b from-background via-primary/5 to-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30"></div>

      <div className="container mx-auto max-w-6xl relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 md:mb-24"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            <span className="text-headline">How </span>
            <span className="text-gradient">It Works</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to unlock your endless wardrobe
          </p>
        </motion.div>

        {/* Desktop Circular Layout */}
        <div className="hidden md:block relative w-full max-w-3xl mx-auto aspect-square mb-12">
          {/* Circular background */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30"></div>

          {/* Animated Circle Path */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(280, 80%, 50%)" />
                <stop offset="50%" stopColor="hsl(210, 100%, 50%)" />
                <stop offset="100%" stopColor="hsl(150, 80%, 45%)" />
              </linearGradient>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="url(#pathGradient)" />
              </marker>
            </defs>

            <motion.circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="3"
              strokeDasharray="10 5"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: "easeInOut" }}
              markerEnd="url(#arrowhead)"
            />
          </svg>

          {/* Central Icon */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow"
          >
            <RefreshCw className="w-10 h-10 text-white animate-spin" style={{ animationDuration: "8s" }} />
          </motion.div>

          {/* Steps positioned around the circle */}
          {steps.map((step, index) => {
            const angle = (index * 120) - 90; // Distribute evenly around circle
            const radius = 52; // Percentage from center
            const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
            const y = 50 + radius * Math.sin((angle * Math.PI) / 180);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.2 }}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="glass-strong p-6 rounded-2xl shadow-card-premium max-w-[280px] group hover:scale-105 transition-transform">
                  <div className={`w-14 h-14 bg-gradient-to-br ${step.gradient} rounded-xl flex items-center justify-center mb-4 shadow-glow group-hover:scale-110 transition-transform`}>
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-gradient mb-2">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-headline mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile Version - Stacked */}
        <div className="md:hidden space-y-6">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-strong p-6 rounded-2xl shadow-card-premium border border-primary/20"
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${step.gradient} rounded-xl flex items-center justify-center shadow-glow flex-shrink-0`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-3xl font-bold text-gradient mb-1">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-headline mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <p className="text-lg text-muted-foreground mb-4">Ready to revolutionize your wardrobe?</p>
          <button className="bg-gradient-primary hover:shadow-glow text-white px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-button">
            Get Started Now
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default CircularHowItWorks;
