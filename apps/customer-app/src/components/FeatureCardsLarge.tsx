// src/components/FeatureCardsLarge.tsx
import React from "react";

/**
 * FeatureCardsLarge
 * Large rounded cards layout that presents four features with a premium look.
 * Uses Tailwind classes already present in your project (container-custom, text-gradient-brand, bg-card, etc).
 *
 * Usage:
 *   import FeatureCardsLarge from "@/components/FeatureCardsLarge";
 *   ...
 *   <FeatureCardsLarge />
 */

const FEATURES = [
  {
    id: "event-ready",
    title: "Event-Ready 'Pop Looks'",
    body:
      "Got a date, party, or fest? Rent a complete, stylist-approved outfit with one tap. Your 'go-to' look for any event.",
    // simple inline SVG icon for visual
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 21h14a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "mix-match",
    title: "The 'Mix & Match' Closet",
    body:
      "Just need a new top? Browse thousands of individual pieces to complete the look you already have. Total creative freedom.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "rent-asap",
    title: "Rent It ASAP",
    body:
      "Your plans are spontaneous, so are we. Your outfit arrives at your door, fresh, clean, and ready to wear in 60 minutes.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 8v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: "sustainable",
    title: "Smart, Simple, Sustainable",
    body:
      "Look amazing for 10–15% of the retail price. When you're done, use the free return bag. We handle the dry cleaning and QA.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5c1.657 0 3 1.343 3 3 0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 19s2.5-4 7-4 7 4 7 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function FeatureCardsLarge() {
  return (
    <section className="py-20 lg:py-28 bg-transparent">
      <div className="container-custom text-center">
        {/* Headline styled like your premium hero */}
        <h2 className="max-w-4xl mx-auto text-4xl sm:text-5xl md:text-6xl font-playfair font-extrabold leading-tight text-headline">
          Done Using?{" "}
          <span className="text-gradient-brand text-transparent bg-clip-text">Return Without Worries</span>
        </h2>

        <p className="mt-6 text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
          No stress, no hassle. Just pack it up and we'll handle the rest.
        </p>

        <div className="mt-12 lg:mt-16">
          {/* Grid: mobile 1 column, tablet 2, desktop 3 or 4 */}
          {/* To match the first design (three large cards across on large screens) use lg:grid-cols-3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {FEATURES.map((f) => (
              <article
                key={f.id}
                className="bg-card rounded-3xl p-8 shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col"
                aria-labelledby={`${f.id}-title`}
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(16,185,129,0.12))",
                      }}
                      aria-hidden
                    >
                      <div className="w-9 h-9 text-headline" style={{ color: "rgba(10,10,10,0.9)" }}>
                        {f.icon}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 id={`${f.id}-title`} className="text-xl md:text-2xl font-playfair font-semibold text-headline mb-2">
                      {f.title}
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {f.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
