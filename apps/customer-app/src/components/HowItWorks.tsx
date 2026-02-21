// src/components/HowItWorks.tsx
import React, { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  AlarmCheck,
  Compass,
  Sparkle as SparkleIcon,
  Undo2,
} from "lucide-react";

type Step = {
  id: number;
  phase: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string; // tailwind color class for inactive icon
  color: string; // gradient classes used for badges / accents
  bgColor: string;
  borderColor: string;
  image: string;
  stats: { label: string; value: string }[];
};

const HowItWorks: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [0.9, 1]);

  const steps: Step[] = [
    {
      id: 1,
      phase: "THE PANIC",
      title: "Last-Minute Fashion Crisis",
      description:
        "It's 2 days before the event. Your closet is full but nothing fits the vibe. Sound familiar?",
      icon: AlarmCheck,
      iconColor: "text-red-600",
      color: "from-red-500 via-rose-500 to-pink-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      image:
        "https://images.unsplash.com/photo-1558171813-4c088753af8f?q=80&w=1200&auto=format&fit=crop",
      stats: [
        { label: "Stressed renters", value: "89%" },
        { label: "Avg panic time", value: "48hrs" },
      ],
    },
    {
      id: 2,
      phase: "THE DISCOVERY",
      title: "Pop Open PopClozet",
      description: "Make it event based curated outfits according to person's aesthetics.",
      icon: Compass,
      iconColor: "text-sky-600",
      color: "from-blue-500 via-cyan-500 to-teal-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      image:
        "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop",
      stats: [
        { label: "Looks curated by stylists", value: "Human" },
        { label: "Booking time", value: "60 sec" },
      ],
    },
    {
      id: 3,
      phase: "THE MOMENT",
      title: "Arrive in Absolute Style",
      description:
        "Outfit delivered. You walk in owning the room. Compliments pour in. This is your moment.",
      icon: SparkleIcon,
      iconColor: "text-violet-600",
      color: "from-purple-500 via-violet-500 to-fuchsia-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
      image:
        "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=1200&auto=format&fit=crop",
      stats: [
        { label: "Compliments", value: "All night" },
        { label: "Confidence", value: "Sky high" },
      ],
    },
    {
      id: 4,
      phase: "THE RETURN",
      title: "Zero Hassle Return",
      description:
        "Pop it in the prepaid bag. Schedule pickup or drop-off. We handle dry-cleaning. Done.",
      icon: Undo2,
      iconColor: "text-emerald-600",
      color: "from-emerald-500 via-green-500 to-lime-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      image:
        "https://i.pinimg.com/736x/5f/ce/c8/5fcec88b5e42fad3216460a16e0a773e.jpg",
      stats: [
        { label: "Return ease", value: "100%" },
        { label: "Hassle", value: "0%" },
      ],
    },
  ];

  return (
    <section
      id="how-it-works-section"
      aria-label="How PopClozet works"
      ref={containerRef}
      className="py-24 md:py-32 bg-[#F6F0E0] dark:bg-[#1A1A1A] relative overflow-hidden"
    >
      {/* Subtle background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#E3BBE6]/20 dark:bg-[#302038]/30 rounded-full blur-3xl"
          animate={{ rotate: 360, scale: [1, 1.06, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-[#C0E2AD]/20 dark:bg-[#99C08D]/10 rounded-full blur-3xl"
          animate={{ rotate: -360, scale: [1, 1.08, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <motion.div className="container-custom relative" style={{ opacity, scale }}>
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#C0E2AD] dark:bg-[#99C08D] rounded-full text-sm font-semibold mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Sparkles className="w-5 h-5 text-black" />
            <span className="text-black">
              The PopClozet Experience
            </span>
          </motion.div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-playfair font-bold mb-6 leading-tight text-black dark:text-[#FAFAFA]">
            From{" "}
            <span className="text-[#EB76C2]">
              Crisis
            </span>{" "}
            to{" "}
            <span className="text-[#E3BBE6]">
              Confidence
            </span>
          </h2>
          <p className="text-xl text-black/60 dark:text-[#FAFAFA]/60 max-w-3xl mx-auto">
            Every great outfit has a story. Here's how we transform your fashion emergencies into
            unforgettable moments.
          </p>
        </motion.div>

        {/* ---------- Step Pills (icons instead of numbers) ---------- */}
        <motion.div
          className="flex justify-center gap-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {steps.map((step, idx) => {
            const isActive = idx === activeStep;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(idx)}
                aria-pressed={isActive}
                aria-label={`Go to ${step.phase}`}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-full font-medium transition-all duration-400
                  ${isActive ? `bg-gradient-to-r ${step.color} text-white shadow-lg scale-105` : "bg-muted/50 text-muted-foreground hover:bg-muted"}
                `}
              >
                {/* Icon circle (icon shown instead of a number) */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                    ${isActive ? "bg-white/10" : "bg-white"}`}
                >
                  {React.createElement(step.icon, {
                    className: `w-5 h-5 ${isActive ? "text-white" : step.iconColor}`,
                  })}
                </div>

                <span className="hidden md:inline text-sm">{step.phase}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Featured Step - Large Card */}
        <motion.div
          className="max-w-6xl mx-auto mb-20"
          key={activeStep}
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className={`relative rounded-[2rem] overflow-hidden border-2 ${steps[activeStep].borderColor} ${steps[activeStep].bgColor}`}
          >
            {/* Gradient overlay */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${steps[activeStep].color} opacity-10`}
            />

            <div className="grid lg:grid-cols-2 gap-8 p-8 md:p-12 relative">
              {/* Content */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-6">
                  {/* Large gradient-filled icon */}
                  <div className="w-20 h-20 rounded-full flex items-center justify-center bg-white/5 shadow-inner">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br ${steps[activeStep].color}`}
                    >
                      {React.createElement(steps[activeStep].icon, { className: "w-7 h-7 text-white" })}
                    </div>
                  </div>

                  <div>
                    <p
                      className={`text-sm font-bold uppercase tracking-widest bg-gradient-to-r ${steps[activeStep].color} bg-clip-text text-transparent`}
                    >
                      Step {steps[activeStep].id} · {steps[activeStep].phase}
                    </p>
                  </div>
                </div>

                <h3 className="text-3xl md:text-4xl font-playfair font-bold mb-4">
                  {steps[activeStep].title}
                </h3>

                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  {steps[activeStep].description}
                </p>

                {/* Stats */}
                <div className="flex gap-8">
                  {steps[activeStep].stats.map((stat, i) => (
                    <div key={i} className="text-center">
                      <p
                        className={`text-3xl font-bold bg-gradient-to-r ${steps[activeStep].color} bg-clip-text text-transparent`}
                      >
                        {stat.value}
                      </p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image */}
              <div className="relative">
                <motion.div
                  className="relative rounded-2xl overflow-hidden shadow-2xl"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.32 }}
                >
                  <img
                    src={steps[activeStep].image}
                    alt={steps[activeStep].title}
                    className="w-full h-[400px] object-cover"
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-t ${steps[activeStep].color} opacity-20`}
                  />
                </motion.div>
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="absolute bottom-8 right-8 flex gap-3">
              <button
                onClick={() => setActiveStep((p) => (p > 0 ? p - 1 : steps.length - 1))}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Previous step"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <button
                onClick={() => setActiveStep((p) => (p < steps.length - 1 ? p + 1 : 0))}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Next step"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Timeline View - All Steps */}
        <motion.div
          className="grid md:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ staggerChildren: 0.1 }}
        >
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            return (
              <motion.div
                key={step.id}
                className={`relative group cursor-pointer ${isActive ? "scale-[1.02]" : ""} h-full`}
                onClick={() => setActiveStep(index)}
                whileHover={{ scale: 1.05, y: -6 }}
                transition={{ duration: 0.28 }}
              >
                {/* connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-border to-transparent z-10" />
                )}

                {/* outer card is full height and a flex column so content stretches */}
                <div
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-300 h-full flex flex-col ${isActive ? `${step.borderColor} shadow-xl` : "border-border/30 hover:border-border/60"
                    }`}
                >
                  {/* image */}
                  <div className="relative h-48 overflow-hidden flex-shrink-0">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent`} />

                    {/* Step icon badge (left) - symbol only */}
                    <div
                      className={`absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg`}
                      aria-hidden
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${step.color}`}>
                        {React.createElement(step.icon, { className: "w-4 h-4 text-white" })}
                      </div>
                    </div>

                    {/* top-right: white badge with colored icon */}
                    <div className="absolute top-3 right-3">
                      <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-sm">
                        {React.createElement(step.icon, { className: `w-6 h-6 ${step.iconColor}` })}
                      </div>
                    </div>
                  </div>

                  {/* content - flex-grow so cards equalize height; min-h keeps content space */}
                  <div className={`p-5 ${step.bgColor} flex flex-col flex-grow min-h-[160px]`}>
                    <p
                      className={`text-xs font-bold uppercase tracking-wider mb-1 bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}
                    >
                      {step.phase}
                    </p>
                    <h4 className="font-bold text-foreground mb-2">{step.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-grow">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <a
            href="/#collections-section"
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-primary via-secondary to-accent text-white rounded-full font-bold text-lg shadow-2xl hover:shadow-primary/30 transition-all hover:scale-105"
          >
            Start Your PopClozet Story
            <ChevronRight className="w-5 h-5" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HowItWorks;
