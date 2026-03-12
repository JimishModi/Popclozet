import type { Config } from "tailwindcss";

export default {
  // Use the class strategy so `.dark` on <html> or <body> toggles dark mode
  darkMode: "class",

  // Files to scan for class names
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // include any other folders you may place components in
  ],

  // Force Tailwind utilities to be applied after other rules if needed
  // important: true, // <-- enable if other global rules are overriding tailwind utilities

  // A small safelist to prevent purge from removing dynamically-built class names
  // Add additional patterns here if you build classnames dynamically (e.g. `bg-${color}`)
  safelist: [
    // exact classes you might need in emergency override
    "force-dark-section",

    // common background/text/card variants you use in components
    "bg-white",
    "bg-rose-50",
    "dark:bg-neutral-800",
    "dark:bg-neutral-800/60",
    "dark:bg-slate-900",
    "text-gray-900",
    "dark:text-gray-100",

    // pattern-based entries (regex) - keeps any utility starting with these prefixes
    {
      pattern: /^(bg|text|border|from|to|via)-(slate|gray|neutral|pink|rose|emerald|green|cyan|purple|indigo|yellow|orange|red|accent|card|popover|sidebar)(-\d{1,3}|-\d{1,3}\/\d{1,3}|)$/i,
    },
  ],

  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },

    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        headline: "hsl(var(--headline))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },

      fontFamily: {
        // Primary site sans (Inter) and a dedicated heading font (Playfair Display)
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["'Playfair Display'", "serif"],
      },

      boxShadow: {
        soft: "0 2px 8px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.06)",
        glow: "0 0 40px -10px rgba(139, 92, 246, 0.4), 0 0 20px -5px rgba(74, 222, 128, 0.3)",
        "neon-purple": "0 0 20px rgba(139, 92, 246, 0.6), 0 0 40px rgba(139, 92, 246, 0.3)",
        "neon-green": "0 0 20px rgba(74, 222, 128, 0.6), 0 0 40px rgba(74, 222, 128, 0.3)",
        "neon-cyan": "0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3)",
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
          },
          "50%": {
            opacity: "0.8",
            boxShadow: "0 0 40px rgba(139, 92, 246, 0.8)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "rotate-3d": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        "gradient-shift": "gradient-shift 15s ease infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        "rotate-3d": "rotate-3d 20s linear infinite",
        fadeIn: "fadeIn 0.6s ease-out",
        slideIn: "slideIn 0.6s ease-out",
      },

      backgroundImage: {
        "gradient-radial":
          "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, #8B5CF6 0deg, #4ADE80 120deg, #8B5CF6 240deg, #4ADE80 360deg)",
      },
    },
  },

  // Keep the animation plugin you already use
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
