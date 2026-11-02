"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "wb_theme";

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(KEY, theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const next: Theme = saved === "light" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      apply(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
