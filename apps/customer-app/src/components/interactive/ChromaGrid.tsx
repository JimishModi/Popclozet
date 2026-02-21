// src/components/interactive/ChromaGrid.tsx
import React from "react";
import { formatPrice } from "@/utils/format";

export interface ChromaGridItem {
  image: string;
  title: string;
  subtitle?: string; // We'll override this to show MRP + ready time
  handle?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
}

interface ChromaGridProps {
  items: ChromaGridItem[];
  columns?: number;
}

const ChromaGrid: React.FC<ChromaGridProps> = ({ items, columns = 4 }) => {
  return (
    <div
      className="grid gap-6"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {items.map((it, i) => {
        // Extract MRP from subtitle pattern or fallback
        let mrp = it.subtitle?.match(/\d+/)?.[0];
        const formattedMRP = mrp ? formatPrice(Number(mrp)) : "₹ ";

        return (
          <a
            key={i}
            href={it.url || "#"}
            className="group block relative overflow-hidden rounded-2xl border border-border shadow-sm"
            style={{
              background: it.gradient ?? undefined,
              boxShadow: it.borderColor
                ? `0 8px 28px ${it.borderColor}20`
                : undefined,
            }}
          >
            {/* Image */}
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={it.image}
                alt={it.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* subtle top overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/25 to-transparent pointer-events-none" />
            </div>

            {/* Bottom information panel */}
            <div
              className="absolute left-0 right-0 bottom-0 p-4"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.98) 100%)",
                backdropFilter: "blur(6px)",
              }}
            >
              {/* Title */}
              <h3 className="font-bold text-lg text-foreground mb-1 truncate">
                {it.title}
              </h3>

              {/* STRUCK PRICE ONLY */}
              <p className="text-sm text-muted-foreground line-through">
                {formattedMRP}
              </p>

              {/* Additional metadata */}
              {it.handle && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {it.handle}
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default ChromaGrid;
