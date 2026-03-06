// tptech-frontend/src/pages/Register.tsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, X } from "lucide-react";

import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import TPInput from "../components/ui/TPInput";
import { TPField } from "../components/ui/TPField";

type FormState = {
  jewelryName: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneCountry: string;
  phoneNumber: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  password: string;
  confirmPassword: string;
};

type RegisterResponse = {
  accessToken?: string;
  token?: string;
};

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

const iconBtnClass =
  "inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:text-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export default function Register() {
  const navigate = useNavigate();
  const { setTokenOnly, refreshMe } = useAuth();

  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<FormState>({
    jewelryName: "",
    email: "",
    firstName: "",
    lastName: "",
    phoneCountry: "+54",
    phoneNumber: "",
    street: "",
    number: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Argentina",
    password: "",
    confirmPassword: "",
  });

  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Validaciones inline ──────────────────────────────────────────
  const emailOk = useMemo(() => isValidEmail(form.email), [form.email]);

  const confirmMismatch =
    form.confirmPassword.length > 0 && form.confirmPassword !== form.password;

  const isFormValid =
    form.jewelryName.trim() &&
    form.email.trim() &&
    emailOk &&
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.phoneCountry.trim() &&
    form.phoneNumber.trim() &&
    form.street.trim() &&
    form.number.trim() &&
    form.city.trim() &&
    form.province.trim() &&
    form.postalCode.trim() &&
    form.country.trim() &&
    form.password &&
    form.password.length >= 6 &&
    form.confirmPassword &&
    !confirmMismatch;

  function req(field: string) {
    return submitted && !field.trim() ? "Campo requerido." : null;
  }

  const emailError = useMemo(() => {
    if (submitted && !form.email.trim()) return "Campo requerido.";
    if (form.email.trim() && !emailOk) return "Ingresá un email válido.";
    return null;
  }, [submitted, form.email, emailOk]);

  const passwordError = useMemo(() => {
    if (submitted && !form.password) return "Campo requerido.";
    if (form.password && form.password.length < 6) return "Mínimo 6 caracteres.";
    return null;
  }, [submitted, form.password]);

  const confirmPasswordError = useMemo(() => {
    if (submitted && !form.confirmPassword) return "Campo requerido.";
    if (confirmMismatch) return "Las contraseñas no coinciden.";
    return null;
  }, [submitted, form.confirmPassword, confirmMismatch]);

  // ── Submit ───────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setSubmitted(true);

    if (!isFormValid) return;

    setLoading(true);
    try {
      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          jewelryName: form.jewelryName.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phoneCountry: form.phoneCountry.trim(),
          phoneNumber: form.phoneNumber.trim(),
          street: form.street.trim(),
          number: form.number.trim(),
          city: form.city.trim(),
          province: form.province.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
        },
      });

      const t = data?.accessToken || data?.token || null;
      if (t) setTokenOnly(t);

      await refreshMe({ force: true, silent: true } as any);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setApiError(String(err?.message || "No se pudo registrar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-soft">
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-8 tp-scroll">

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary">TPTech</p>
              <h1 className="mt-2 text-3xl font-semibold text-text">Crear cuenta</h1>
              <p className="mt-1 text-sm text-muted">Completá tus datos para registrar tu joyería.</p>
            </div>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>

          {apiError && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-8">

            {/* ── Datos de la joyería ─────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-text">Datos de la joyería</h2>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <TPField label="Nombre de joyería" required>
                  <TPInput
                    value={form.jewelryName}
                    onChange={(v) => update("jewelryName", v)}
                    placeholder="Ej: Joyería Tuport"
                    disabled={loading}
                    error={req(form.jewelryName)}
                  />
                </TPField>

                <TPField label="Email" required>
                  <TPInput
                    type="email"
                    value={form.email}
                    onChange={(v) => update("email", v)}
                    placeholder="tuemail@ejemplo.com"
                    disabled={loading}
                    autoComplete="email"
                    error={emailError}
                    rightIcon={
                      form.email ? (
                        <button
                          type="button"
                          onClick={() => update("email", "")}
                          className={iconBtnClass}
                          aria-label="Limpiar email"
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : undefined
                    }
                  />
                </TPField>
              </div>
            </section>

            {/* ── Datos del responsable ───────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-text">Datos del responsable</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <TPField label="Nombre" required>
                  <TPInput
                    value={form.firstName}
                    onChange={(v) => update("firstName", v)}
                    placeholder="Nombre"
                    disabled={loading}
                    error={req(form.firstName)}
                  />
                </TPField>

                <TPField label="Apellido" required>
                  <TPInput
                    value={form.lastName}
                    onChange={(v) => update("lastName", v)}
                    placeholder="Apellido"
                    disabled={loading}
                    error={req(form.lastName)}
                  />
                </TPField>

                <div className="md:col-span-2">
                  <TPField label="Teléfono" required>
                    <div className="flex gap-3">
                      <TPInput
                        value={form.phoneCountry}
                        onChange={(v) => update("phoneCountry", v)}
                        placeholder="+54"
                        disabled={loading}
                        className="!w-24 !flex-none shrink-0"
                        error={req(form.phoneCountry)}
                      />
                      <TPInput
                        value={form.phoneNumber}
                        onChange={(v) => update("phoneNumber", v)}
                        placeholder="9 11 1234 5678"
                        disabled={loading}
                        className="flex-1 min-w-0"
                        error={req(form.phoneNumber)}
                      />
                    </div>
                  </TPField>
                </div>
              </div>
            </section>

            {/* ── Dirección ──────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-text">Dirección</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <TPField label="Calle" required>
                    <TPInput
                      value={form.street}
                      onChange={(v) => update("street", v)}
                      placeholder="Ej: Av. Corrientes"
                      disabled={loading}
                      error={req(form.street)}
                    />
                  </TPField>
                </div>

                <TPField label="Número" required>
                  <TPInput
                    value={form.number}
                    onChange={(v) => update("number", v)}
                    placeholder="1234"
                    disabled={loading}
                    error={req(form.number)}
                  />
                </TPField>

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
                    placeholder="Provincia"
                    disabled={loading}
                    error={req(form.province)}
                  />
                </TPField>

                <TPField label="Código Postal" required>
                  <TPInput
                    value={form.postalCode}
                    onChange={(v) => update("postalCode", v)}
                    placeholder="C1000"
                    disabled={loading}
                    error={req(form.postalCode)}
                  />
                </TPField>

                <div className="md:col-span-3">
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
              </div>
            </section>

            {/* ── Seguridad ──────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-text">Seguridad</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <TPField label="Contraseña" required>
                  <TPInput
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(v) => update("password", v)}
                    placeholder="Creá una contraseña"
                    disabled={loading}
                    autoComplete="new-password"
                    error={passwordError}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className={iconBtnClass}
                        aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                        disabled={loading}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </TPField>

                <TPField label="Repetir contraseña" required>
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
                        className={iconBtnClass}
                        aria-label={showPass2 ? "Ocultar contraseña" : "Ver contraseña"}
                        disabled={loading}
                      >
                        {showPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </TPField>
              </div>
            </section>

            <button type="submit" disabled={loading} className="tp-btn-primary w-full">
              {loading ? "Registrando..." : "Registrarme"}
            </button>

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
