// tptech-frontend/src/pages/VerifyEmail.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Loader2, MailCheck } from "lucide-react";
import { apiFetch } from "../lib/api";
import TPInput from "../components/ui/TPInput";
import { TPButton } from "../components/ui/TPButton";
import { TPFeedbackCard } from "../components/ui/TPFeedbackCard";

type VerifyState = "loading" | "success" | "already_verified" | "error";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<VerifyState>(token ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState<string>("El link de verificación es inválido.");

  const [email, setEmail] = useState<string>(() => {
    try { return sessionStorage.getItem("tptech_pending_email") ?? ""; } catch { return ""; }
  });
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("El link de verificación es inválido.");
      return;
    }

    apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`, { on401: "throw" } as any)
      .then((resp: any) => {
        if (resp?.alreadyVerified) {
          setState("already_verified");
        } else {
          setState("success");
          try { sessionStorage.removeItem("tptech_pending_email"); } catch { /* ignore */ }
        }
      })
      .catch((err: any) => {
        setState("error");
        const msg = String(err?.data?.message || err?.message || "").trim();
        setErrorMsg(msg || "El link expiró o ya fue usado.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResend() {
    if (!email.trim()) {
      setResendError("Ingresá tu email para reenviar la verificación.");
      return;
    }
    setResendError(null);
    setResendLoading(true);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
        on401: "throw",
      } as any);
      setResendDone(true);
    } catch {
      setResendError("No se pudo reenviar el email. Intentá de nuevo.");
    } finally {
      setResendLoading(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted">Verificando tu cuenta…</p>
        </div>
      </div>
    );
  }

  // ── Éxito ─────────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <TPFeedbackCard
        tone="success"
        icon={<CheckCircle className="w-8 h-8" />}
        title="Cuenta activada"
        description="Tu email fue verificado correctamente. Ya podés iniciar sesión."
        actions={
          <TPButton variant="primary" className="w-full" onClick={() => navigate("/login")}>
            Iniciar sesión
          </TPButton>
        }
      />
    );
  }

  // ── Ya verificado ─────────────────────────────────────────────────────────
  if (state === "already_verified") {
    return (
      <TPFeedbackCard
        tone="primary"
        icon={<CheckCircle className="w-8 h-8" />}
        title="Email ya verificado"
        description="Tu cuenta ya estaba activa. Podés iniciar sesión normalmente."
        actions={
          <TPButton variant="primary" className="w-full" onClick={() => navigate("/login")}>
            Ir a iniciar sesión
          </TPButton>
        }
      />
    );
  }

  // ── Error / token inválido ─────────────────────────────────────────────────
  return (
    <TPFeedbackCard
      tone="error"
      icon={<AlertCircle className="w-8 h-8" />}
      title="Link inválido"
      description={errorMsg}
      footer={
        <Link to="/login" className="text-sm text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      }
    >
      {!resendDone ? (
        <div className="space-y-3">
          <p className="text-sm text-text font-medium text-center">
            Solicitar nuevo email de verificación
          </p>
          <div>
            <label className="mb-2 block text-sm text-muted">Email</label>
            <TPInput
              type="email"
              value={email}
              onChange={(v) => { setEmail(v); setResendError(null); }}
              placeholder="tuemail@ejemplo.com"
              disabled={resendLoading}
            />
            {resendError && (
              <p className="mt-1.5 text-xs text-red-500">{resendError}</p>
            )}
          </div>
          <TPButton
            variant="primary"
            onClick={handleResend}
            disabled={resendLoading}
            loading={resendLoading}
            className="w-full"
          >
            Reenviar email de verificación
          </TPButton>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Te enviamos un nuevo email a{" "}
            <strong className="text-text">{email}</strong>. Revisá tu bandeja de entrada.
          </p>
        </div>
      )}
    </TPFeedbackCard>
  );
}
