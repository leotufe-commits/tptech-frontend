// src/pages/AcceptInvite.tsx
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type VerifyState = "loading" | "valid" | "expired" | "used" | "invalid";

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

export default function AcceptInvite() {
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
        if (msg.includes("ya fue usado")) setVerifyState("used");
        else if (msg.includes("expiró")) setVerifyState("expired");
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
      setError("El link de invitación no es válido. Pedile al administrador que te reenvíe la invitación.");
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

      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword },
      });

      setOkMsg("¡Listo! Tu cuenta está activa. Ya podés iniciar sesión.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("ya fue usado")) {
        setError("Este link de invitación ya fue utilizado. Iniciá sesión o pedí una nueva invitación.");
      } else if (msg.includes("expiró")) {
        setError("Este link de invitación venció. Pedile al administrador que te reenvíe la invitación.");
      } else {
        setError(msg || "No se pudo activar la cuenta. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  const stateMessages: Record<Exclude<VerifyState, "valid" | "loading">, { title: string; body: string; action: React.ReactNode }> = {
    expired: {
      title: "Invitación vencida",
      body: "Este link de invitación expiró. Los links son válidos por 7 días.",
      action: <p className="mt-4 text-sm text-muted">Pedile al administrador que te reenvíe la invitación.</p>,
    },
    used: {
      title: "Invitación ya utilizada",
      body: "Esta invitación ya fue utilizada para activar una cuenta.",
      action: (
        <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          Iniciar sesión →
        </Link>
      ),
    },
    invalid: {
      title: "Link inválido",
      body: "El link de invitación no es válido.",
      action: <p className="mt-4 text-sm text-muted">Pedile al administrador que te reenvíe la invitación.</p>,
    },
  };

  const iconBtnClass =
    "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center " +
    "rounded-md bg-transparent text-text/70 hover:text-primary transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
        <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>

        {verifyState === "loading" && (
          <div className="mt-6 text-sm text-muted">Verificando invitación…</div>
        )}

        {verifyState !== "loading" && verifyState !== "valid" && (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-text">{stateMessages[verifyState].title}</h1>
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              {stateMessages[verifyState].body}
            </div>
            {stateMessages[verifyState].action}
          </>
        )}

        {verifyState === "valid" && (
          <>
            <h1 className="mt-2 text-3xl font-semibold text-text">Activar tu cuenta</h1>
            <p className="mt-1 text-sm text-muted">
              Creá una contraseña para completar la activación de tu cuenta.
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
                    autoFocus
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
                {loading ? "Activando cuenta…" : "Activar cuenta"}
              </button>

              <div className="flex items-center justify-center pt-1">
                <Link to="/login" className="text-sm text-muted hover:underline">
                  Ya tengo cuenta, iniciar sesión
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
