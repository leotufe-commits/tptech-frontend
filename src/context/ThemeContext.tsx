// tptech-frontend/src/context/ThemeContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

export type ThemeName = "classic" | "dark" | "blue" | "gray" | "emerald";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  themes: { value: ThemeName; label: string }[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeTheme(t: string | null): ThemeName {
  if (t === "gold") return "blue"; // legacy
  if (t === "classic" || t === "dark" || t === "blue" || t === "gray" || t === "emerald") return t;
  return "classic";
}

function applyThemeToDom(theme: ThemeName) {
  const root = document.documentElement;

  // ✅ limpiar tanto clases nuevas como posibles legacy
  root.classList.remove(
    "classic",
    "dark",
    "blue",
    "gray",
    "emerald",
    "theme-classic",
    "theme-dark",
    "theme-blue",
    "theme-gray",
    "theme-emerald"
  );

  // ✅ esto es lo que usa tu themes.css actual
  root.setAttribute("data-theme", theme);

  // ✅ compat: si en algún lugar quedó CSS viejo por clases
  root.classList.add(`theme-${theme}`);
  root.classList.add(theme);
}

function keyPublic() {
  return "tptech_theme:public";
}

function keyUser(userId: string) {
  return `tptech_theme:${userId}`;
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function migrateLegacyThemeOnce() {
  try {
    const legacy = localStorage.getItem("tptech_theme");
    if (legacy == null) return;
    safeSet(keyPublic(), normalizeTheme(legacy));
    localStorage.removeItem("tptech_theme");
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

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
  const lastUserIdRef = useRef<string | null>(null);

  const setTheme = (t: ThemeName) => {
    const normalized = normalizeTheme(String(t));
    setThemeState(normalized);
    applyThemeToDom(normalized);

    // ✅ guardado público + por usuario
    safeSet(keyPublic(), normalized);
    const uid = user?.id ?? null;
    if (uid) safeSet(keyUser(uid), normalized);
  };

  // ✅ boot (1 sola vez)
  useEffect(() => {
    migrateLegacyThemeOnce();
    const saved = normalizeTheme(safeGet(keyPublic()));
    setThemeState(saved);
    applyThemeToDom(saved);
  }, []);

  // ✅ cambio de usuario / quick switch
  useEffect(() => {
    const uid = user?.id ?? null;
    if (lastUserIdRef.current === uid) return;
    lastUserIdRef.current = uid;

    const next = uid
      ? normalizeTheme(safeGet(keyUser(uid)) ?? safeGet(keyPublic()))
      : normalizeTheme(safeGet(keyPublic()));

    setThemeState(next);
    applyThemeToDom(next);
  }, [user?.id]);

  const value = useMemo(() => ({ theme, setTheme, themes }), [theme, themes]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
