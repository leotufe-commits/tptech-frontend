import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!open && (
        <path
          d="M4 20 20 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="h-4 w-4"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
  token: string;
  user: { id: string; email: string; name?: string | null };
};

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(email.trim()) && Boolean(pass.trim()),
    [email, pass]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !pass) {
      setError("Completá email y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      });

      localStorage.setItem("tptech_token", data.token);
      localStorage.setItem("tptech_user", JSON.stringify(data.user));

      navigate("/dashboard");
    } catch (err: any) {
      const msg = String(err?.message || "");

      if (
        msg.includes("No autorizado") ||
        msg.includes("incorrect") ||
        msg.includes("Invalid") ||
        msg.includes("Token") ||
        msg.includes("Usuario") ||
        msg.includes("User") ||
        msg.includes("Error interno")
      ) {
        setError("Email o contraseña incorrectos.");
      } else {
        setError("Error al iniciar sesión.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>
            <h1 className="mt-2 text-3xl font-semibold text-text">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-muted">
              Ingresá tus credenciales para continuar.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {/* EMAIL */}
          <div>
            <label className="mb-2 block text-sm text-muted">Email</label>

            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@ejemplo.com"
                className="tp-input pr-11"
                autoComplete="email"
              />

              {email.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEmail("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1
                             text-white mix-blend-difference
                             opacity-90 hover:opacity-100 transition
                             focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  aria-label="Limpiar email"
                  title="Limpiar"
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="mb-2 block text-sm text-muted">Contraseña</label>

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Ingresá tu contraseña"
                className="tp-input pr-11"
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1
                           text-white mix-blend-difference
                           opacity-90 hover:opacity-100 transition
                           focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                title={showPass ? "Ocultar" : "Ver"}
              >
                <EyeIcon open={showPass} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="tp-btn-primary w-full"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          <div className="flex items-center justify-between pt-1">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>

            <Link to="/register" className="text-sm text-muted hover:underline hover:text-text">
              Crear cuenta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
