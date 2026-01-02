import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = email.trim();
    if (!v) {
      setError("Ingresá tu email.");
      return;
    }

    try {
      setLoading(true);

      // Backend: POST /auth/forgot-password
      await apiFetch<{ ok: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: v }),
      });

      // Por seguridad, el backend siempre responde ok:true
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar el email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
        }}
      >
        <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--primary)" }}>
          TPTech
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-text">Recuperar contraseña</h1>

        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Te enviaremos un link para restablecer tu contraseña.
        </p>

        {error && (
          <div
            className="mt-6 rounded-xl px-4 py-3 text-sm"
            style={{
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.12)",
              color: "color-mix(in oklab, var(--text) 85%, #ef4444)",
            }}
          >
            {error}
          </div>
        )}

        {sent ? (
          <div className="mt-8">
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                border: "1px solid rgba(16,185,129,0.35)",
                background: "rgba(16,185,129,0.12)",
                color: "color-mix(in oklab, var(--text) 85%, #10b981)",
              }}
            >
              Si el email existe, te enviamos un link de recuperación.
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Link
                to="/login"
                className="text-sm hover:underline"
                style={{ color: "var(--primary)" }}
              >
                Volver a iniciar sesión
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-sm hover:underline"
                style={{ color: "var(--muted)" }}
              >
                Enviar a otro email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm mb-2" style={{ color: "var(--muted)" }}>
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@ejemplo.com"
                className="tp-input"
              />
            </div>

            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="tp-btn-primary w-full"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
              <Link to="/login" className="hover:underline" style={{ color: "var(--primary)" }}>
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
