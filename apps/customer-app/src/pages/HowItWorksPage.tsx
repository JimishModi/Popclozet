// src/pages/HowItWorksPage.tsx
import { motion } from "framer-motion";
import { MobileShell } from "@/components/layout/MobileShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { ArrowLeft, Package, Truck, RefreshCw, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Package,
    title: "Browse & Select",
    description: "Choose from 1000+ designer outfits",
    color: "bg-blue-500/20 text-blue-500"
  },
  {
    icon: Truck,
    title: "Fast Delivery",
    description: (() => {
        try {
            const loc = JSON.parse(localStorage.getItem('locationStorage') || '{}');
            return loc.delivery_estimate === 'delayed' ? 'Get it with Delayed Delivery' : 'Get it delivered in 60 minutes';
        } catch {
            return 'Get it delivered in 60 minutes';
        }
    })(),
    color: "bg-green-500/20 text-green-500"
  },
  {
    icon: Check,
    title: "Wear & Enjoy",
    description: "Rock your outfit at the event",
    color: "bg-purple-500/20 text-purple-500"
  },
  {
    icon: RefreshCw,
    title: "Easy Returns",
    description: "We pick it up when you're done",
    color: "bg-primary/20 text-primary"
  }
];

const faqs = [
  {
    question: "How does the rental process work?",
    answer: "Browse our collection, select your outfit, and we'll deliver it to you. Wear it and we'll pick it up when you're done!"
  },
  {
    question: "What if the outfit doesn't fit?",
    answer: "We offer free size exchanges. Just let us know and we'll swap it out within 2 hours."
  },
  {
    question: "How do I return the items?",
    answer: "We'll pick up from your doorstep. No need to wash or clean - just leave it in the bag!"
  },
  {
    question: "What's included in the rental?",
    answer: "Your rental includes the outfit, dry cleaning before and after, delivery, and pickup."
  }
];

const HowItWorksPage = () => {
  return (
    <MobileShell>
      <MobileHeader />

      <main className="flex-1 overflow-y-auto bg-background dark:bg-[#0a0a0a]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Link to="/home" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-all active:scale-95">
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <h1 className="text-xl font-bold text-white">How It Works</h1>
          </div>
        </header>

        {/* Hero Section */}
        <div className={cn(
          "mx-4 mt-4 p-6 rounded-2xl text-center",
          "bg-gradient-to-br from-primary/10 to-purple-500/10",
          "dark:from-primary/20 dark:to-purple-500/20",
          "border border-primary/20 dark:border-primary/30"
        )}>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-foreground dark:text-white mb-2"
          >
            Rent, Wear, Return
          </motion.h2>
          <p className="text-sm text-muted-foreground dark:text-white/60">
            It's that simple. No hassle, no worries.
          </p>
        </div>

        {/* Steps */}
        <div className="px-4 py-6">
          <h3 className="text-lg font-bold text-foreground dark:text-white mb-4">How It Works</h3>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl",
                    "bg-card dark:bg-[#1a1a1a]",
                    "border border-border/20 dark:border-white/10"
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", step.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground dark:text-white/50">STEP {index + 1}</span>
                    </div>
                    <h4 className="font-semibold text-foreground dark:text-white">{step.title}</h4>
                    <p className="text-xs text-muted-foreground dark:text-white/60">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* FAQs */}
        <div className="px-4 pb-6">
          <h3 className="text-lg font-bold text-foreground dark:text-white mb-4">FAQs</h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className={cn(
                  "p-4 rounded-2xl",
                  "bg-card dark:bg-[#1a1a1a]",
                  "border border-border/20 dark:border-white/10"
                )}
              >
                <h4 className="font-semibold text-foreground dark:text-white mb-2">{faq.question}</h4>
                <p className="text-sm text-muted-foreground dark:text-white/60">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 pb-6">
          <Link
            to="/collections"
            className="block w-full py-3 rounded-full bg-primary text-primary-foreground font-bold text-center"
          >
            Start Browsing
          </Link>
        </div>
      </main>
    </MobileShell>
  );
};

export default HowItWorksPage;

