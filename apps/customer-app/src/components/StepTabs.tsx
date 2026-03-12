// src/components/StepTabs.tsx
import React from "react";
import { AlarmCheck, Compass, Sparkle, Undo2 } from "lucide-react";
import { motion } from "framer-motion";

type Step = { id: number; label: string; icon: React.ReactNode };

const STEPS: Step[] = [
  { id: 1, label: "THE PANIC", icon: <AlarmCheck className="w-4 h-4" /> },
  { id: 2, label: "THE DISCOVERY", icon: <Compass className="w-4 h-4" /> },
  { id: 3, label: "THE MOMENT", icon: <Sparkle className="w-4 h-4" /> },
  { id: 4, label: "THE RETURN", icon: <Undo2 className="w-4 h-4" /> },
];

type Props = {
  activeId?: number;
  onChange?: (id: number) => void;
};

export default function StepTabs({ activeId = 1, onChange }: Props) {
  return (
    <nav aria-label="Process steps" className="flex items-center gap-6">
      {STEPS.map((s) => {
        const active = s.id === activeId;
        return (
          <motion.button
            key={s.id}
            onClick={() => onChange?.(s.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`inline-flex items-center gap-3 px-6 py-3 rounded-full transition-all focus:outline-none
              ${active
                ? "bg-gradient-to-r from-pink-500 to-red-500 text-white shadow-[0_10px_30px_rgba(249,115,22,0.18)]"
                : "bg-muted/80 text-foreground"}
            `}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full ${
                active ? "bg-white/10" : "bg-white/90"
              }`}
              aria-hidden="true"
            >
              <span className={active ? "text-white" : "text-gray-600"}>{s.icon}</span>
            </span>

            <span className="font-semibold tracking-wide text-sm">{s.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
