// tptech-frontend/src/pages/Register.tsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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

type RegisterResponse = {
  accessToken?: string;
  token?: string;
  // el backend suele mandar user/jewelry/roles/permissions también,
  // pero acá solo nos interesan token(s) para compat
};

function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function Register() {
  const navigate = useNavigate();
  const { setTokenOnly, refreshMe } = useAuth();

  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

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

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const emailOk = useMemo(() => isValidEmail(form.email), [form.email]);
  const hasEmail = useMemo(() => form.email.trim().length > 0, [form.email]);

  const canSubmit = useMemo(() => {
    if (loading) return false;

    const required =
      form.jewelryName.trim() &&
      form.email.trim() &&
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
      form.confirmPassword;

    if (!required) return false;
    if (!emailOk) return false;
    if (form.password.length < 6) return false;
    if (form.password !== form.confirmPassword) return false;

    return true;
  }, [form, loading, emailOk]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const email = form.email.trim().toLowerCase();
    if (!isValidEmail(email)) return setError("Ingresá un email válido.");
    if (form.password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        email,
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
      };

      // ✅ Importante: body como objeto (apiFetch lo JSON-stringify + headers)
      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: payload,
      });

      // ✅ compat: si backend devuelve token/accessToken, lo guardamos (aunque sea cookie-based)
      const t = data?.accessToken || data?.token || null;
      if (t) setTokenOnly(t);

      // ✅ trae /auth/me y setea estado real (user/jewelry/roles/perms)
      await refreshMe({ force: true, silent: true } as any);

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(String(err?.message || "No se pudo registrar."));
    } finally {
      setLoading(false);
    }
  }

  const iconBtnClass =
    "absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center " +
    "rounded-md bg-transparent text-text/70 hover:text-text " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

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

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-text">Datos de la joyería</h2>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-2 block text-sm text-muted">Nombre de joyería</label>
                  <input
                    value={form.jewelryName}
                    onChange={(e) => update("jewelryName", e.target.value)}
                    placeholder="Ej: Joyería Tuport"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="tuemail@ejemplo.com"
                      className={`tp-input ${hasEmail ? "pr-11" : ""}`}
                      disabled={loading}
                      autoComplete="email"
                    />

                    {hasEmail && (
                      <button
                        type="button"
                        onClick={() => update("email", "")}
                        className={iconBtnClass}
                        aria-label="Limpiar email"
                        title="Limpiar"
                        disabled={loading}
                      >
                        <XIcon />
                      </button>
                    )}
                  </div>

                  <div className="mt-2 min-h-[18px] text-xs text-muted">
                    {form.email.trim()
                      ? emailOk
                        ? "—"
                        : "Ingresá un email válido."
                      : "—"}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-text">Datos del responsable</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm text-muted">Nombre</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    placeholder="Nombre"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Apellido</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    placeholder="Apellido"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-muted">Teléfono</label>

                  <div className="flex gap-3">
                    <input
                      value={form.phoneCountry}
                      onChange={(e) => update("phoneCountry", e.target.value)}
                      className="tp-input !w-24 !flex-none shrink-0"
                      placeholder="+54"
                      disabled={loading}
                    />
                    <input
                      value={form.phoneNumber}
                      onChange={(e) => update("phoneNumber", e.target.value)}
                      className="tp-input !flex-1 min-w-0"
                      placeholder="11 1234 5678"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-text">Dirección</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm text-muted">Domicilio (calle)</label>
                  <input
                    value={form.street}
                    onChange={(e) => update("street", e.target.value)}
                    placeholder="Ej: Av. Corrientes"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Número</label>
                  <input
                    value={form.number}
                    onChange={(e) => update("number", e.target.value)}
                    placeholder="1234"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Ciudad</label>
                  <input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="Ciudad"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Provincia</label>
                  <input
                    value={form.province}
                    onChange={(e) => update("province", e.target.value)}
                    placeholder="Provincia"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Código Postal</label>
                  <input
                    value={form.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                    placeholder="C1000"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="mb-2 block text-sm text-muted">País</label>
                  <input
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                    placeholder="Argentina"
                    className="tp-input"
                    disabled={loading}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-text">Seguridad</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm text-muted">Contraseña</label>

                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="Creá una contraseña"
                      className="tp-input pr-11"
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className={iconBtnClass}
                      aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                      title={showPass ? "Ocultar" : "Ver"}
                      disabled={loading}
                    >
                      <EyeIcon open={showPass} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-muted">Repetir contraseña</label>

                  <div className="relative">
                    <input
                      type={showPass2 ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      placeholder="Repetí la contraseña"
                      className="tp-input pr-11"
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass2((s) => !s)}
                      className={iconBtnClass}
                      aria-label={showPass2 ? "Ocultar contraseña" : "Ver contraseña"}
                      title={showPass2 ? "Ocultar" : "Ver"}
                      disabled={loading}
                    >
                      <EyeIcon open={showPass2} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted">
                La contraseña debe tener al menos 6 caracteres.
              </div>
            </section>

            <button type="submit" disabled={!canSubmit} className="tp-btn-primary w-full">
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
