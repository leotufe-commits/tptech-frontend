// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

type User = { id: string; email: string; name?: string | null };
type Jewelry = any;

type AuthState = {
  user: User | null;
  jewelry: Jewelry | null;
  loading: boolean;

  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;

  // ✅ sync tabs (nombres “oficiales”)
  notifyLogin: () => void;
  notifyLogout: () => void;

  // ✅ aliases para no romper Login.tsx actual
  broadcastLogin: () => void;
  broadcastLogout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const AUTH_SYNC_KEY = "tptech_auth_sync";
const LS_TOKEN_KEY = "tptech_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [jewelry, setJewelry] = useState<Jewelry | null>(null);
  const [loading, setLoading] = useState(true);

  const bootedRef = useRef(false);

  const refreshMe = async () => {
    try {
      const data = await apiFetch<{ user: User; jewelry: Jewelry | null }>("/auth/me");
      setUser(data.user);
      setJewelry(data.jewelry ?? null);
    } catch {
      // ✅ si sesión/token inválido → limpiar
      localStorage.removeItem(LS_TOKEN_KEY);
      setUser(null);
      setJewelry(null);
    }
  };

  const notifyLogin = () => {
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ type: "login", at: Date.now() }));
  };

  const notifyLogout = () => {
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ type: "logout", at: Date.now() }));
  };

  // Aliases (para Login.tsx que usa broadcastLogin/broadcastLogout)
  const broadcastLogin = notifyLogin;
  const broadcastLogout = notifyLogout;

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}

    localStorage.removeItem(LS_TOKEN_KEY);

    setUser(null);
    setJewelry(null);

    notifyLogout();
  };

  // bootstrap sesión (evita múltiples boots en dev)
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      await refreshMe();
      setLoading(false);
    })();
  }, []);

  // ✅ escuchar cambios desde OTRAS pestañas
  useEffect(() => {
    const onStorage = async (e: StorageEvent) => {
      if (e.key !== AUTH_SYNC_KEY || !e.newValue) return;

      try {
        const msg = JSON.parse(e.newValue);

        if (msg.type === "login") {
          await refreshMe();
        }

        if (msg.type === "logout") {
          localStorage.removeItem(LS_TOKEN_KEY);
          setUser(null);
          setJewelry(null);
        }
      } catch {}
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      jewelry,
      loading,
      refreshMe,
      logout,
      notifyLogin,
      notifyLogout,
      broadcastLogin,
      broadcastLogout,
    }),
    [user, jewelry, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
