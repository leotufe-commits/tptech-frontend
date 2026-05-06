// tptech-frontend/src/context/ThemeContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { updateMyTheme } from "../services/users";

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

  // useCallback con [user?.id] garantiza que setTheme siempre captura el user actual.
  // Sin esto, si el usuario cambia pero el tema queda igual, useMemo no re-ejecuta
  // y setTheme queda con el user del render anterior (stale closure).
  const setTheme = useCallback((t: ThemeName) => {
    const normalized = normalizeTheme(String(t));
    setThemeState(normalized);
    applyThemeToDom(normalized);

    // cache local: boot anti-flash + fallback offline
    safeSet(keyPublic(), normalized);
    const uid = user?.id ?? null;
    if (uid) {
      safeSet(keyUser(uid), normalized);
      // persistir en backend (fire-and-forget: no bloqueamos la UI)
      updateMyTheme(normalized).catch(() => {/* fallo silencioso, localStorage como backup */});
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ boot (1 sola vez)
  useEffect(() => {
    migrateLegacyThemeOnce();
    const saved = normalizeTheme(safeGet(keyPublic()));
    setThemeState(saved);
    applyThemeToDom(saved);
  }, []);

  // cambio de usuario / login / quick switch
  // Prioridad: 1) themePreference del backend  2) localStorage por usuario  3) localStorage público
  useEffect(() => {
    const uid = user?.id ?? null;
    if (lastUserIdRef.current === uid) return; // mismo usuario, nada que hacer
    lastUserIdRef.current = uid;

    const backendPref = uid ? (user?.themePreference ?? null) : null;
    const next = uid
      ? normalizeTheme(backendPref ?? safeGet(keyUser(uid)) ?? safeGet(keyPublic()))
      : normalizeTheme(safeGet(keyPublic()));

    setThemeState(next);
    applyThemeToDom(next);

    // actualizar localStorage para que el boot próximo no flashee
    if (uid) {
      safeSet(keyUser(uid), next);
      safeSet(keyPublic(), next);
    }
  }, [user?.id]); // user?.themePreference se lee vía closure al moment en que user.id cambia

  // setTheme en deps: cuando cambia user?.id, useCallback genera una nueva referencia
  // → useMemo re-ejecuta → consumidores reciben el setTheme correcto para el user actual
  const value = useMemo(() => ({ theme, setTheme, themes }), [theme, setTheme, themes]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
