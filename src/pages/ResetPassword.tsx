import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type VerifyState = "loading" | "valid" | "expired" | "invalid";

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

const iconBtnClass =
  "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center " +
  "rounded-md bg-transparent text-text/70 hover:text-primary transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const token = search.get("token") || "";

  const [verifyState, setVerifyState] = useState<VerifyState>(token ? "loading" : "invalid");

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setVerifyState("invalid"); return; }
    apiFetch<{ ok: boolean }>(`/auth/verify-token?token=${encodeURIComponent(token)}`, { on401: "throw" })
      .then(() => setVerifyState("valid"))
      .catch((err: any) => {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("expiró")) setVerifyState("expired");
        else setVerifyState("invalid");
      });
  }, [token]);

  const canSubmit = useMemo(() => {
    return Boolean(token) && newPassword.trim().length >= 6 && newPassword === confirm;
  }, [token, newPassword, confirm]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
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
        body: { token, newPassword },
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
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">

        <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>

        {/* ── ESTADO: verificando ── */}
        {verifyState === "loading" && (
          <div className="mt-6 text-sm text-muted">Verificando link…</div>
        )}

        {/* ── ESTADO: expirado ── */}
        {verifyState === "expired" && (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-text">Link vencido</h1>
            <p className="mt-1 text-sm text-muted">
              Los links de recuperación son válidos por 30 minutos.
            </p>
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              Este link ya expiró. Solicitá uno nuevo para continuar.
            </div>
            <div className="mt-6">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Solicitar nuevo link →
              </Link>
            </div>
          </>
        )}

        {/* ── ESTADO: inválido ── */}
        {verifyState === "invalid" && (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-text">Link inválido</h1>
            <p className="mt-1 text-sm text-muted">
              El link no es válido o ya fue utilizado.
            </p>
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              Si creés que esto es un error, solicitá un nuevo link de recuperación.
            </div>
            <div className="mt-6">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Solicitar nuevo link →
              </Link>
            </div>
          </>
        )}

        {/* ── ESTADO: válido ── */}
        {verifyState === "valid" && (
          <>
            <h1 className="mt-2 text-3xl font-semibold text-text">Crear nueva contraseña</h1>
            <p className="mt-1 text-sm text-muted">
              Ingresá tu nueva contraseña para recuperar el acceso.
            </p>

            {error && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {okMsg && (
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {okMsg}
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-muted">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={show1 ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="tp-input pr-11"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShow1((s) => !s)}
                    className={iconBtnClass}
                    aria-label={show1 ? "Ocultar contraseña" : "Ver contraseña"}
                    disabled={loading}
                  >
                    <EyeIcon open={show1} />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">Repetir contraseña</label>
                <div className="relative">
                  <input
                    type={show2 ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetí la contraseña"
                    className="tp-input pr-11"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShow2((s) => !s)}
                    className={iconBtnClass}
                    aria-label={show2 ? "Ocultar contraseña" : "Ver contraseña"}
                    disabled={loading}
                  >
                    <EyeIcon open={show2} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="tp-btn-primary w-full"
              >
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <Link to="/login" className="text-sm text-muted hover:underline">
                  Volver al login
                </Link>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Pedir otro link
                </Link>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
