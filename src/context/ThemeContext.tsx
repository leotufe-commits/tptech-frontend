import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeName = "classic" | "dark" | "blue" | "gray" | "emerald";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  themes: { value: ThemeName; label: string }[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeTheme(t: string | null): ThemeName {
  // compatibilidad: si antes existía "gold", lo convertimos a "blue"
  if (t === "gold") return "blue";

  if (t === "classic" || t === "dark" || t === "blue" || t === "gray" || t === "emerald") {
    return t;
  }
  return "classic";
}

function applyThemeToDom(theme: ThemeName) {
  if (theme === "classic") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themes = useMemo(
    () => [
      { value: "classic" as const, label: "Clásico" },
      { value: "dark" as const, label: "Oscuro" },
      { value: "blue" as const, label: "Azul" },
      { value: "gray" as const, label: "Gris" },
      { value: "emerald" as const, label: "Esmeralda" },
    ],
    []
  );

  const [theme, setThemeState] = useState<ThemeName>("classic");

  const setTheme = (t: ThemeName) => {
    const normalized = normalizeTheme(t);
    setThemeState(normalized);

    try {
      localStorage.setItem("tptech_theme", normalized);
    } catch {
      // ignore
    }

    applyThemeToDom(normalized);
  };

  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem("tptech_theme");
      const saved = normalizeTheme(savedRaw);

      // si estaba "gold", lo reemplazamos por "blue" (limpieza)
      if (savedRaw === "gold") {
        try {
          localStorage.setItem("tptech_theme", "blue");
        } catch {
          // ignore
        }
      }

      setThemeState(saved);
      applyThemeToDom(saved);
    } catch {
      applyThemeToDom("classic");
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes }), [theme, themes]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
