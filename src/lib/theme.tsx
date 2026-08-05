import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const DEFAULT_BRAND_THEME = "default";

/** Inline IIFE for <head>: applies brand + light/dark before React/hydration. SSR-safe. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var root = document.documentElement;
    root.setAttribute("data-brand-theme", "${DEFAULT_BRAND_THEME}");
    var stored = localStorage.getItem("tf_theme");
    var isDark;
    if (stored === "dark") isDark = true;
    else if (stored === "light") isDark = false;
    else isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } catch (_) {}
})();
`.trim();

function ensureBrandThemeAttribute() {
  if (typeof document === "undefined") return;
  if (!document.documentElement.getAttribute("data-brand-theme")) {
    document.documentElement.setAttribute("data-brand-theme", DEFAULT_BRAND_THEME);
  }
}

const Ctx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: "light",
  toggle: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Important for SSR/hydration consistency:
  // - SSR can't know user's theme, so the server-rendered tree is effectively "light".
  // - THEME_INIT_SCRIPT applies data-brand-theme + <html class="dark"> before hydration to avoid flash.
  // - We keep the first client render aligned with SSR ("light") and then sync in an effect.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    ensureBrandThemeAttribute();
    const stored = window.localStorage.getItem("tf_theme") as Theme | null;
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initial = stored ?? prefers;
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const apply = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      ensureBrandThemeAttribute();
      window.localStorage.setItem("tf_theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    }
  };

  return (
    <Ctx.Provider
      value={{ theme, setTheme: apply, toggle: () => apply(theme === "dark" ? "light" : "dark") }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={
        "grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/35 " +
        className
      }
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
