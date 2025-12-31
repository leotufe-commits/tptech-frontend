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
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
        <p className="text-xs font-semibold tracking-wide text-[#F36A21]">TPTech</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#1F1F1F]">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Te enviaremos un link para restablecer tu contraseña.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {sent ? (
          <div className="mt-8">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Si el email existe, te enviamos un link de recuperación.
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Link to="/login" className="text-sm text-[#F36A21] hover:underline">
                Volver a iniciar sesión
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-sm text-gray-600 hover:underline"
              >
                Enviar a otro email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Email</label>
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
              className="w-full rounded-xl bg-[#F36A21] py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            <p className="text-center text-sm text-gray-600">
              <Link to="/login" className="text-[#F36A21] hover:underline">
                Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
