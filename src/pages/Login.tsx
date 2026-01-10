// tptech-frontend/src/pages/Login.tsx
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, SS_TOKEN_KEY } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type LoginResponse = {
  accessToken?: string;
  token?: string;
};

export default function Login() {
  const navigate = useNavigate();
  const { setTokenOnly, refreshMe } = useAuth();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => Boolean(email.trim()) && Boolean(pass.trim()), [email, pass]);

  const hasEmail = email.trim().length > 0;
  const hasPass = pass.trim().length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Completá email y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const resp = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password: pass },
      });

      const token = resp?.accessToken || resp?.token;
      if (!token) throw new Error("No se recibió token.");

      try {
        sessionStorage.setItem(SS_TOKEN_KEY, token);
      } catch {
        // noop
      }

      setTokenOnly(token);
      navigate("/dashboard", { replace: true });
      void refreshMe();
    } catch (err: any) {
      setEmail((v) => v.trim());
      setError(String(err?.message || "Email o contraseña incorrectos."));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Botón de icono:
   * - SIN borde visible
   * - color basado en tokens del theme (text-text) => se adapta a fondo claro/oscuro
   * - visible SOLO cuando corresponde (cuando hay texto)
   */
  const iconBtnClass =
    "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center " +
    "rounded-md bg-transparent text-text/70 hover:text-text " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

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

            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`tp-input ${hasEmail ? "pr-11" : ""}`}
                autoComplete="email"
              />

              {/* X visible SOLO cuando hay texto */}
              {hasEmail && (
                <button
                  type="button"
                  onClick={() => setEmail("")}
                  className={iconBtnClass}
                  aria-label="Limpiar email"
                  title="Limpiar"
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted">Contraseña</label>

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className={`tp-input ${hasPass ? "pr-11" : ""}`}
                autoComplete="current-password"
              />

              {/* Eye visible SOLO cuando hay texto */}
              {hasPass && (
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className={iconBtnClass}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPass ? "Ocultar" : "Mostrar"}
                >
                  <EyeIcon open={showPass} />
                </button>
              )}
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
