import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { initTheme, toggleTheme } from "@/utils/theme";

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return (document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light";
  });

  useEffect(() => {
    initTheme();
    setTheme((document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light");
  }, []);

  const handleToggle = useCallback(() => {
    toggleTheme();
    const next = (document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light";
    setTheme(next);
  }, []);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="relative inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors"
      aria-label="Toggle color theme"
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
};

export default ThemeToggle;
