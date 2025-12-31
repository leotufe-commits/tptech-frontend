import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name?: string | null };
type Jewelry = any;

type AuthState = {
  token: string | null;
  user: User | null;
  jewelry: Jewelry | null;
  loading: boolean;

  setSession: (payload: { token: string; user: User; jewelry?: Jewelry | null }) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const LS_TOKEN_KEY = "tptech_token";

function getApiBase() {
  // lee VITE_API_URL del .env del frontend
  return import.meta.env.VITE_API_URL || "http://localhost:3001";
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: any; token?: string | null } = {}
): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  // Intentar leer JSON siempre que se pueda
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [jewelry, setJewelry] = useState<Jewelry | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession: AuthState["setSession"] = ({ token, user, jewelry }) => {
    setToken(token);
    localStorage.setItem(LS_TOKEN_KEY, token);
    setUser(user);
    setJewelry(jewelry ?? null);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(LS_TOKEN_KEY);
    setUser(null);
    setJewelry(null);
  };

  const refreshMe = async () => {
    if (!token) {
      setUser(null);
      setJewelry(null);
      return;
    }
    // /auth/me devuelve { user, jewelry }
    const data = await api<{ user: User; jewelry: Jewelry | null }>("/auth/me", { token });
    setUser(data.user);
    setJewelry(data.jewelry ?? null);
  };

  // Al iniciar la app: si hay token, validarlo
  useEffect(() => {
    (async () => {
      try {
        if (token) await refreshMe();
      } catch (e) {
        // token inválido -> logout
        logout();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, user, jewelry, loading, setSession, refreshMe, logout }),
    [token, user, jewelry, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
