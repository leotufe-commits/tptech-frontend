import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

type ResetResponse = { ok: true };

export default function ResetPassword() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const token = search.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(token) && newPassword.trim().length >= 6 && newPassword === confirm;
  }, [token, newPassword, confirm]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!token) {
      setError("Falta el token. Volvé a solicitar el link de recuperación.");
      return;
    }
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch<ResetResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });

      setOkMsg("Contraseña actualizada. Ya podés iniciar sesión.");
      setTimeout(() => navigate("/login"), 900);
    } catch (err: any) {
      setError(err?.message || "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#F36A21]">TPTech</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#1F1F1F]">Restablecer contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingresá tu nueva contraseña para recuperar el acceso.
          </p>
        </div>

        {!token && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El link no tiene token. Volvé a{" "}
            <Link className="text-[#F36A21] underline" to="/forgot-password">
              solicitar recuperación
            </Link>
            .
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {okMsg && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {okMsg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Nueva contraseña</label>
            <div className="relative">
              <input
                type={show1 ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="tp-input pr-11"
                disabled={!token || loading}
              />
              <button
                type="button"
                onClick={() => setShow1((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#F36A21] transition"
                aria-label={show1 ? "Ocultar contraseña" : "Ver contraseña"}
                disabled={!token || loading}
              >
                <EyeIcon open={show1} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Repetir contraseña</label>
            <div className="relative">
              <input
                type={show2 ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña"
                className="tp-input pr-11"
                disabled={!token || loading}
              />
              <button
                type="button"
                onClick={() => setShow2((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#F36A21] transition"
                aria-label={show2 ? "Ocultar contraseña" : "Ver contraseña"}
                disabled={!token || loading}
              >
                <EyeIcon open={show2} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-xl bg-[#F36A21] py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>

          <div className="flex items-center justify-between pt-1">
            <Link to="/login" className="text-sm text-gray-600 hover:underline">
              Volver al login
            </Link>
            <Link to="/forgot-password" className="text-sm text-[#F36A21] hover:underline">
              Pedir otro link
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
