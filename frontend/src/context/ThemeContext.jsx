import { createContext, useContext, useEffect, useState } from "react";
import { Sun, Moon } from "@phosphor-icons/react";

const ThemeContext = createContext(null);

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("rb_theme") || "dark");

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("rb_theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label="Design umschalten"
      className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {isDark ? <Moon size={15} weight="fill" className="text-primary" /> : <Sun size={15} weight="fill" className="text-amber-500" />}
      <span className="hidden sm:inline">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
