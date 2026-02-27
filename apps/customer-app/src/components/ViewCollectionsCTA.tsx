// src/components/ViewCollectionsCTA.tsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * ViewCollectionsCTA
 *
 * - Smooth-scrolls to #collections-section when on the homepage.
 * - Navigates to "/#collections-section" from other routes.
 * - Uses Tailwind gradient utilities consistent with your theme.
 */

const ViewCollectionsCTA: React.FC<{ className?: string }> = ({ className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const goToCollections = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    const scrollToSection = (): boolean => {
      const el = document.getElementById("collections-section");
      if (el) {
        // attempt smooth scroll and focus for accessibility
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        try {
          (el as HTMLElement).focus?.();
        } catch {
          // ignore if not focusable
        }
        return true;
      }
      return false;
    };

    if (location.pathname === "/") {
      // already on homepage: try in-page scroll first
      if (!scrollToSection()) {
        // fallback: attach hash so homepage logic can act on it
        navigate("/#collections-section");
      }
      return;
    }

    // on another page: navigate to home with hash
    navigate("/#collections-section");
  };

  return (
    <button
      type="button"
      onClick={goToCollections}
      aria-label="View all collections"
      className={`relative inline-flex items-center gap-3 px-6 py-3 rounded-full text-lg font-semibold text-white shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30 transform transition hover:scale-[1.02] ${className}`}
    >
      {/* Background gradient layer */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-secondary to-accent blur-sm opacity-95 -z-10"
      />
      {/* Subtle glow behind */}
      <span
        aria-hidden
        className="absolute -inset-2 rounded-2xl blur-2xl opacity-10 pointer-events-none -z-20"
        style={{ background: "linear-gradient(90deg, rgba(154,230,180,0.12), rgba(96,165,250,0.08), rgba(192,132,252,0.08))" }}
      />
      <span className="relative inline-flex items-center gap-3 z-10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-white">
          <path d="M3 12h14M14 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <span>View All Collections</span>
      </span>

      <ArrowRight className="w-4 h-4 relative z-10" />
    </button>
  );
};

export default ViewCollectionsCTA;
