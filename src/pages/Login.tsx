// src/pages/Login.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const LS_TOKEN_KEY = "tptech_token";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {!open && (
        <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { refreshMe, broadcastLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => Boolean(email.trim()) && Boolean(pass.trim()), [email, pass]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Completá email y contraseña.");
      return;
    }

    try {
      setLoading(true);

      // 1) Login (backend setea cookie httpOnly + devuelve token)
      const resp = await apiFetch<{ token?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      });

      // ✅ guardar token como fallback (robusto)
      if (resp?.token) {
        localStorage.setItem(LS_TOKEN_KEY, resp.token);
      }

      // 2) Traer sesión real (/auth/me)
      await refreshMe();

      // 3) Sincronizar otras pestañas
      broadcastLogin();

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(String(err?.message || "Email o contraseña incorrectos."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
        <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>
        <h1 className="mt-2 text-3xl font-semibold text-text">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-muted">Ingresá tus credenciales para continuar.</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="tp-input"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="tp-input pr-11"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPass ? "Ocultar" : "Mostrar"}
              >
                <EyeIcon open={showPass} />
              </button>
            </div>
          </div>

          <button type="submit" disabled={!canSubmit || loading} className="tp-btn-primary w-full">
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          <div className="flex items-center justify-between pt-1">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link to="/register" className="text-sm text-muted hover:underline">
              Crear cuenta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
