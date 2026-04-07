const STORAGE_KEY = "popclozet-theme";

type Theme = "light" | "dark";

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.remove("no-theme-transitions");
  
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    // iOS Safari PWA might throw SecurityError
    console.warn("localStorage not available", e);
  }

  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
};

export const initTheme = () => {
  const root = document.documentElement;
  root.classList.add("no-theme-transitions");
  
  let saved: Theme | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  } catch (e) {
    console.warn("localStorage not available", e);
  }

  const theme: Theme = saved ?? "light";
  root.setAttribute("data-theme", theme);
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
  requestAnimationFrame(() => {
    root.classList.remove("no-theme-transitions");
  });
};

export const setTheme = (theme: Theme) => {
  applyTheme(theme);
};

export const toggleTheme = () => {
  const current = document.documentElement.getAttribute("data-theme") as Theme | null;
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next);
};
