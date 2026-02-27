// src/components/SustainabilityImpact.tsx
import React from "react";
import { Repeat, Droplet, Globe, Leaf } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  {
    id: "life",
    icon: Repeat,
    title: "Extended Garment Life",
    text: "Each outfit gets worn more times, maximizing its value.",
    stat: "3.2x",
    arrow: "↑",
    statLabel: "Average reuse",
  },
  {
    id: "savings",
    icon: Droplet,
    title: "Resource Savings",
    text: "Less demand means fewer resources consumed.",
    stat: "40%",
    arrow: "↓",
    statLabel: "Water footprint",
  },
  {
    id: "emissions",
    icon: Globe,
    title: "Less Emissions",
    text: "Reduced production means lower carbon emissions.",
    stat: "32%",
    arrow: "↓",
    statLabel: "CO₂ per outfit",
  },
  {
    id: "circular",
    icon: Leaf,
    title: "Circular Economy",
    text: "Maximizing garment lifecycle and reducing waste.",
    stat: "68%",
    arrow: "♻︎",
    statLabel: "Materials reused",
  },
];

export default function SustainabilityImpact() {
  return (
    <section
      aria-labelledby="sustainability-title"
      className="relative overflow-hidden py-16 md:py-24 bg-[#F6F0E0] dark:bg-[#1A1A1A]"
    >
      <div className="container-custom relative z-10">
        {/* Header with Badge */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          {/* Badge - Green pill */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#C0E2AD] dark:bg-[#99C08D] rounded-full mb-6"
          >
            <Leaf className="w-4 h-4 text-black" />
            <span className="text-xs font-bold uppercase tracking-widest text-black">
              Conscious Consumption
            </span>
          </motion.div>

          {/* Title - "earth" highlighted in green */}
          <motion.h2
            id="sustainability-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-playfair text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-black dark:text-[#FAFAFA]"
          >
            Why is renting better{" "}
            <span className="italic text-[#C0E2AD] dark:text-[#99C08D]">for the earth</span>?
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg text-black/60 dark:text-[#FAFAFA]/60 max-w-2xl mx-auto"
          >
            Every rental makes a difference. Here's how sharing fashion helps the planet.
          </motion.p>
        </div>

        {/* 2x2 Grid of Cards - Purple boxes with green border */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#E3BBE6] dark:bg-[#302038] border-2 border-[#C0E2AD] dark:border-[#99C08D] p-8 relative group hover:shadow-xl transition-all rounded-2xl"
            >
              {/* Impact Badge - Green pill */}
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-[#C0E2AD] dark:bg-[#99C08D] text-black text-xs font-bold uppercase tracking-wider rounded-full">
                Impact
              </div>

              {/* Icon - Black thin-line */}
              <div className="mb-6">
                <div className="w-12 h-12 rounded-full border-2 border-black dark:border-[#FAFAFA]/30 flex items-center justify-center bg-white/50 dark:bg-[#282828]/50">
                  <item.icon className="w-6 h-6 text-black dark:text-[#FAFAFA] stroke-[1.5]" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-black dark:text-[#FAFAFA] mb-3 font-playfair">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-black/70 dark:text-[#FAFAFA]/60 mb-6 leading-relaxed">
                {item.text}
              </p>

              {/* Large Stat - Pink accent */}
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-bold text-[#EB76C2]">
                  {item.arrow} {item.stat}
                </span>
                <span className="text-sm uppercase tracking-wide text-black/60 dark:text-[#FAFAFA]/50 font-semibold">
                  {item.statLabel}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
