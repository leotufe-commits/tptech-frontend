// tptech-frontend/src/pages/Register.tsx
// Dos flujos claramente separados:
//   Google → formulario reducido (joyería + teléfono + ciudad/provincia/país) → login inmediato
//   Manual → formulario completo (acceso + responsable + joyería + teléfono + dirección) → verificación por email
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, Eye, EyeOff, MailCheck } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "../lib/toast";
import { TPButton } from "../components/ui/TPButton";
import TPInput from "../components/ui/TPInput";
import { TPField } from "../components/ui/TPField";
import { TPFeedbackCard } from "../components/ui/TPFeedbackCard";

// ─────────────────────────────────────────────────────────────────────────────

type FormState = {
  jewelryName:     string;
  email:           string;
  firstName:       string;
  lastName:        string;
  phoneCountry:    string;
  phoneNumber:     string;
  // Dirección completa (solo flujo manual)
  street:          string;
  number:          string;
  floor:           string;
  apartment:       string;
  postalCode:      string;
  city:            string;
  province:        string;
  country:         string;
  password:        string;
  confirmPassword: string;
};

type RegisterResponse = { accessToken?: string; token?: string };

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

const iconBtnCls =
  "inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:text-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

// ─────────────────────────────────────────────────────────────────────────────

export default function Register() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { setTokenOnly, refreshMe } = useAuth();

  const [showPass,  setShowPass]  = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<FormState>({
    jewelryName:     "",
    email:           "",
    firstName:       "",
    lastName:        "",
    phoneCountry:    "+54",
    phoneNumber:     "",
    street:          "",
    number:          "",
    floor:           "",
    apartment:       "",
    postalCode:      "",
    city:            "",
    province:        "",
    country:         "Argentina",
    password:        "",
    confirmPassword: "",
  });

  const [apiError,          setApiError]          = useState<string | null>(null);
  const [loading,           setLoading]           = useState(false);
  const [googleLoading,     setGoogleLoading]     = useState(false);
  const [registrationDone,  setRegistrationDone]  = useState(false);
  const [googleCredential,  setGoogleCredential]  = useState<string | null>(null);
  const [resendLoading,     setResendLoading]     = useState(false);
  const [resendDone,        setResendDone]        = useState(false);
  const [resendError,       setResendError]       = useState<string | null>(null);

  // ── Leer state de navegación (llegada desde Login vía Google) ──────────────
  useEffect(() => {
    const state = location.state as { googleProfile?: any; googleCredential?: string } | null;
    if (state?.googleCredential && state?.googleProfile) {
      setGoogleCredential(state.googleCredential);
      setForm((prev) => ({
        ...prev,
        email:     String(state.googleProfile?.email     ?? prev.email),
        firstName: String(state.googleProfile?.firstName ?? prev.firstName),
        lastName:  String(state.googleProfile?.lastName  ?? prev.lastName),
      }));
      toast.success("Datos de Google cargados. Completá los datos de tu joyería para continuar.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Validaciones ──────────────────────────────────────────────────────────
  const isGoogle        = Boolean(googleCredential);
  const emailOk         = useMemo(() => isValidEmail(form.email), [form.email]);
  const confirmMismatch = form.confirmPassword.length > 0 && form.confirmPassword !== form.password;

  // Campos comunes requeridos en ambos flujos
  const baseValid = Boolean(
    form.jewelryName.trim() &&
    form.phoneNumber.trim() &&
    form.city.trim() &&
    form.province.trim() &&
    form.country.trim()
  );

  // Campos adicionales requeridos solo en flujo manual
  const manualValid = isGoogle || Boolean(
    emailOk &&
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.password.length >= 6 &&
    form.confirmPassword &&
    !confirmMismatch
  );

  const isFormValid = baseValid && manualValid;

  function req(field: string) {
    return submitted && !field.trim() ? "Campo requerido." : null;
  }

  const emailError = useMemo(() => {
    if (!isGoogle && submitted && !form.email.trim()) return "Campo requerido.";
    if (!isGoogle && form.email.trim() && !emailOk) return "Email inválido.";
    return null;
  }, [isGoogle, submitted, form.email, emailOk]);

  const passwordError = useMemo(() => {
    if (!isGoogle && submitted && !form.password) return "Campo requerido.";
    if (!isGoogle && form.password && form.password.length < 6) return "Mínimo 6 caracteres.";
    return null;
  }, [isGoogle, submitted, form.password]);

  const confirmPasswordError = useMemo(() => {
    if (!isGoogle && submitted && !form.confirmPassword) return "Campo requerido.";
    if (!isGoogle && confirmMismatch) return "Las contraseñas no coinciden.";
    return null;
  }, [isGoogle, submitted, form.confirmPassword, confirmMismatch]);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    const credential = credentialResponse.credential;
    if (!credential) { toast.error("No se pudo obtener el token de Google."); return; }

    setGoogleLoading(true);
    try {
      const resp = await apiFetch<{
        action: string;
        profile?: { email?: string; firstName?: string; lastName?: string };
      }>("/auth/google/token", { method: "POST", body: { credential } });

      if (resp.action === "LOGIN") {
        const maybeToken = String((resp as any)?.accessToken || (resp as any)?.token || "").trim();
        if (maybeToken) setTokenOnly(maybeToken);
        await refreshMe({ force: true, silent: true } as any);
        navigate("/dashboard", { replace: true });
        return;
      }

      if (resp.action === "REGISTER_REQUIRED" && resp.profile) {
        setGoogleCredential(credential);
        setForm((prev) => ({
          ...prev,
          email:     resp.profile?.email     ?? prev.email,
          firstName: resp.profile?.firstName ?? prev.firstName,
          lastName:  resp.profile?.lastName  ?? prev.lastName,
        }));
        toast.success("Datos de Google cargados. Completá los datos de tu joyería para continuar.");
        return;
      }

      toast.error("Respuesta inesperada del servidor.");
    } catch (err: any) {
      toast.error(String(err?.message || "Error al continuar con Google."));
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setSubmitted(true);
    if (!isFormValid) return;

    setLoading(true);
    try {
      const body: Record<string, string> = {
        email:        form.email.trim().toLowerCase(),
        jewelryName:  form.jewelryName.trim(),
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        phoneCountry: form.phoneCountry.trim() || "+54",
        phoneNumber:  form.phoneNumber.trim(),
        city:         form.city.trim(),
        province:     form.province.trim(),
        country:      form.country.trim(),
      };

      if (isGoogle) {
        body.googleCredential = googleCredential!;
      } else {
        body.password    = form.password;
        body.street      = form.street.trim();
        body.number      = form.number.trim();
        body.floor       = form.floor.trim();
        body.apartment   = form.apartment.trim();
        body.postalCode  = form.postalCode.trim();
      }

      const data = await apiFetch<RegisterResponse & { pendingVerification?: boolean }>(
        "/auth/register",
        { method: "POST", body }
      );

      // Google → login inmediato
      if (!data?.pendingVerification) {
        const t = data?.accessToken || data?.token || null;
        if (t) setTokenOnly(t);
        await refreshMe({ force: true, silent: true } as any);
        navigate("/dashboard", { replace: true });
        return;
      }

      // Manual → email de verificación enviado
      try { sessionStorage.setItem("tptech_pending_email", form.email.trim().toLowerCase()); } catch { /* ignore */ }
      setRegistrationDone(true);
    } catch (err: any) {
      setApiError(String(err?.message || "No se pudo registrar."));
    } finally {
      setLoading(false);
    }
  }

  // ── Resend handler ────────────────────────────────────────────────────────
  async function handleResend() {
    setResendError(null);
    setResendLoading(true);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: { email: form.email.trim().toLowerCase() },
        on401: "throw",
      } as any);
      setResendDone(true);
    } catch {
      setResendError("No se pudo reenviar el email. Intentá de nuevo.");
    } finally {
      setResendLoading(false);
    }
  }

  // ── Pantalla post-registro (email enviado) ────────────────────────────────
  if (registrationDone) {
    return (
      <TPFeedbackCard
        tone="primary"
        icon={<MailCheck className="w-8 h-8" />}
        title="Revisá tu correo"
        description={
          <>
            Te enviamos un email a{" "}
            <strong className="text-text">{form.email}</strong> para verificar tu cuenta.
            Hacé click en el link del email para activarla.
          </>
        }
        actions={
          <>
            <TPButton variant="primary" className="w-full" onClick={() => navigate("/login")}>
              Ir a iniciar sesión
            </TPButton>
            {!resendDone ? (
              <TPButton
                variant="secondary"
                className="w-full"
                onClick={handleResend}
                disabled={resendLoading}
                loading={resendLoading}
              >
                Reenviar email
              </TPButton>
            ) : (
              <p className="text-center text-xs text-green-600 font-medium">
                Email reenviado. Revisá tu bandeja de entrada.
              </p>
            )}
            {resendError && (
              <p className="text-center text-xs text-red-500">{resendError}</p>
            )}
          </>
        }
        footer={
          <p className="text-xs text-muted opacity-70">
            Si no llegó en unos minutos, revisá la carpeta de spam.
          </p>
        }
      />
    );
  }

  // ── Formulario de registro ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-soft">
        <div className="p-8">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>
              <h1 className="mt-2 text-2xl font-semibold text-text">Crear cuenta</h1>
              <p className="mt-1 text-sm text-muted">
                {isGoogle
                  ? "Completá los datos de tu joyería para continuar."
                  : "Registrá tu joyería con todos tus datos."}
              </p>
            </div>
            <Link to="/login" className="shrink-0 text-sm text-primary hover:underline mt-1">
              Iniciar sesión
            </Link>
          </div>

          {apiError && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-6">

            {/* ── Google button / Banner verificado ──────────────────── */}
            {!isGoogle ? (
              <div className="space-y-3">
                <div className={`flex justify-center transition-opacity ${googleLoading ? "opacity-50 pointer-events-none" : ""}`}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error("Error al continuar con Google.")}
                    text="continue_with"
                    shape="rectangular"
                    size="large"
                    width="460"
                  />
                </div>
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted select-none">o completá manualmente</span>
                  <div className="flex-1 border-t border-border" />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-green-800">Email verificado con Google</p>
                  <p className="text-xs text-green-700 truncate">
                    {[form.firstName, form.lastName].filter(Boolean).join(" ")}
                    {form.firstName || form.lastName ? " · " : ""}
                    {form.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleCredential(null);
                    setForm((prev) => ({ ...prev, email: "", firstName: "", lastName: "" }));
                  }}
                  className="shrink-0 text-xs text-green-700 hover:underline"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                FLUJO MANUAL — secciones extra
            ═══════════════════════════════════════════════════════ */}

            {!isGoogle && (
              <>
                {/* ── 1. Acceso ─────────────────────────────────────── */}
                <section className="space-y-4">
                  <h2 className="text-sm font-semibold text-text">Acceso</h2>

                  <TPField label="Email" required>
                    <TPInput
                      type="email"
                      value={form.email}
                      onChange={(v) => update("email", v)}
                      placeholder="tuemail@ejemplo.com"
                      disabled={loading}
                      autoComplete="email"
                      error={emailError}
                    />
                  </TPField>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TPField label="Contraseña" required>
                      <TPInput
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={(v) => update("password", v)}
                        placeholder="Mínimo 6 caracteres"
                        disabled={loading}
                        autoComplete="new-password"
                        error={passwordError}
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowPass((s) => !s)}
                            className={iconBtnCls}
                            aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />
                    </TPField>
                    <TPField label="Confirmar contraseña" required>
                      <TPInput
                        type={showPass2 ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(v) => update("confirmPassword", v)}
                        placeholder="Repetí la contraseña"
                        disabled={loading}
                        autoComplete="new-password"
                        error={confirmPasswordError}
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowPass2((s) => !s)}
                            className={iconBtnCls}
                            aria-label={showPass2 ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            {showPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />
                    </TPField>
                  </div>
                </section>

                {/* ── 2. Datos del responsable ───────────────────────── */}
                <section className="space-y-4">
                  <h2 className="text-sm font-semibold text-text">Datos del responsable</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TPField label="Nombre" required>
                      <TPInput
                        value={form.firstName}
                        onChange={(v) => update("firstName", v)}
                        placeholder="Juan"
                        disabled={loading}
                        error={req(form.firstName)}
                      />
                    </TPField>
                    <TPField label="Apellido" required>
                      <TPInput
                        value={form.lastName}
                        onChange={(v) => update("lastName", v)}
                        placeholder="García"
                        disabled={loading}
                        error={req(form.lastName)}
                      />
                    </TPField>
                  </div>
                </section>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECCIONES COMUNES A AMBOS FLUJOS
            ═══════════════════════════════════════════════════════ */}

            {/* ── Datos de la joyería ───────────────────────────────── */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-text">Tu joyería</h2>
              <TPField label="Nombre de la joyería" required>
                <TPInput
                  value={form.jewelryName}
                  onChange={(v) => update("jewelryName", v)}
                  placeholder="Ej: Joyería Tuport"
                  disabled={loading}
                  error={req(form.jewelryName)}
                />
              </TPField>
            </section>

            {/* ── Contacto ─────────────────────────────────────────── */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-text">Contacto</h2>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <TPField label="Prefijo">
                    <TPInput
                      value={form.phoneCountry}
                      onChange={(v) => update("phoneCountry", v)}
                      placeholder="+54"
                      disabled={loading}
                    />
                  </TPField>
                </div>
                <div className="col-span-3">
                  <TPField label="Teléfono" required>
                    <TPInput
                      value={form.phoneNumber}
                      onChange={(v) => update("phoneNumber", v)}
                      placeholder="9 11 1234 5678"
                      disabled={loading}
                      autoComplete="tel"
                      error={req(form.phoneNumber)}
                    />
                  </TPField>
                </div>
              </div>
            </section>

            {/* ── Dirección completa (manual) / Ubicación (Google) ─── */}
            {!isGoogle ? (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-text">Dirección</h2>

                {/* Calle + Número */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <TPField label="Calle">
                      <TPInput
                        value={form.street}
                        onChange={(v) => update("street", v)}
                        placeholder="Av. Corrientes"
                        disabled={loading}
                      />
                    </TPField>
                  </div>
                  <div className="col-span-1">
                    <TPField label="Número">
                      <TPInput
                        value={form.number}
                        onChange={(v) => update("number", v)}
                        placeholder="1234"
                        disabled={loading}
                      />
                    </TPField>
                  </div>
                </div>

                {/* Piso + Dpto + CP */}
                <div className="grid grid-cols-3 gap-3">
                  <TPField label="Piso">
                    <TPInput
                      value={form.floor}
                      onChange={(v) => update("floor", v)}
                      placeholder="3"
                      disabled={loading}
                    />
                  </TPField>
                  <TPField label="Dpto.">
                    <TPInput
                      value={form.apartment}
                      onChange={(v) => update("apartment", v)}
                      placeholder="A"
                      disabled={loading}
                    />
                  </TPField>
                  <TPField label="Código postal">
                    <TPInput
                      value={form.postalCode}
                      onChange={(v) => update("postalCode", v)}
                      placeholder="1000"
                      disabled={loading}
                    />
                  </TPField>
                </div>

                {/* Ciudad + Provincia + País */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TPField label="Ciudad" required>
                    <TPInput
                      value={form.city}
                      onChange={(v) => update("city", v)}
                      placeholder="Ciudad"
                      disabled={loading}
                      error={req(form.city)}
                    />
                  </TPField>
                  <TPField label="Provincia" required>
                    <TPInput
                      value={form.province}
                      onChange={(v) => update("province", v)}
                      placeholder="Buenos Aires"
                      disabled={loading}
                      error={req(form.province)}
                    />
                  </TPField>
                  <TPField label="País" required>
                    <TPInput
                      value={form.country}
                      onChange={(v) => update("country", v)}
                      placeholder="Argentina"
                      disabled={loading}
                      error={req(form.country)}
                    />
                  </TPField>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-text">Ubicación</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TPField label="Ciudad" required>
                    <TPInput
                      value={form.city}
                      onChange={(v) => update("city", v)}
                      placeholder="Ciudad"
                      disabled={loading}
                      error={req(form.city)}
                    />
                  </TPField>
                  <TPField label="Provincia" required>
                    <TPInput
                      value={form.province}
                      onChange={(v) => update("province", v)}
                      placeholder="Buenos Aires"
                      disabled={loading}
                      error={req(form.province)}
                    />
                  </TPField>
                  <TPField label="País" required>
                    <TPInput
                      value={form.country}
                      onChange={(v) => update("country", v)}
                      placeholder="Argentina"
                      disabled={loading}
                      error={req(form.country)}
                    />
                  </TPField>
                </div>
              </section>
            )}

            {/* ── Botón submit ──────────────────────────────────────── */}
            <TPButton
              variant="primary"
              type="submit"
              disabled={loading}
              loading={loading}
              className="w-full"
            >
              {isGoogle ? "Crear cuenta" : "Crear cuenta y verificar email"}
            </TPButton>

            <p className="text-center text-sm text-muted">
              ¿Ya tenés cuenta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
