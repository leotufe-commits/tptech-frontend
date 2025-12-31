import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

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
  user: { id: string; email: string; name: string | null; createdAt: string };
  jewelry: any | null;
  token: string;
};

export default function Register() {
  const navigate = useNavigate();

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

  const canSubmit = useMemo(() => {
    const required =
      form.jewelryName &&
      form.email &&
      form.firstName &&
      form.lastName &&
      form.phoneNumber &&
      form.street &&
      form.number &&
      form.city &&
      form.province &&
      form.postalCode &&
      form.country &&
      form.password &&
      form.confirmPassword;

    const samePass = form.password === form.confirmPassword;
    return Boolean(required) && samePass && !loading;
  }, [form, loading]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,

        jewelryName: form.jewelryName,
        firstName: form.firstName,
        lastName: form.lastName,

        phoneCountry: form.phoneCountry,
        phoneNumber: form.phoneNumber,

        street: form.street,
        number: form.number,
        city: form.city,
        province: form.province,
        postalCode: form.postalCode,
        country: form.country,
      };

      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Guardar token (igual que login)
      localStorage.setItem("tptech_token", data.token);

      // opcional: guardar user/jewelry si querés
      localStorage.setItem("tptech_user", JSON.stringify(data.user));
      if (data.jewelry) localStorage.setItem("tptech_jewelry", JSON.stringify(data.jewelry));

      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-8 tp-scroll">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#F36A21]">TPTech</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#1F1F1F]">Crear cuenta</h1>
              <p className="mt-1 text-sm text-gray-500">
                Completá tus datos para registrar tu joyería.
              </p>
            </div>

            <Link to="/login" className="text-sm text-[#F36A21] hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-gray-800">Datos de la joyería</h2>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Nombre de joyería</label>
                  <input
                    value={form.jewelryName}
                    onChange={(e) => update("jewelryName", e.target.value)}
                    placeholder="Ej: Joyería Tupor"
                    className="tp-input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="tuemail@ejemplo.com"
                      className="tp-input pr-11"
                    />

                    {form.email.length > 0 && (
                      <button
                        type="button"
                        onClick={() => update("email", "")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                        aria-label="Limpiar email"
                      >
                        <XIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-800">Datos del responsable</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Nombre</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    placeholder="Nombre"
                    className="tp-input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Apellido</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    placeholder="Apellido"
                    className="tp-input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Teléfono</label>

                  <div className="flex gap-3">
                    <input
                      value={form.phoneCountry}
                      onChange={(e) => update("phoneCountry", e.target.value)}
                      className="tp-input !w-24 !flex-none shrink-0"
                      placeholder="+54"
                    />
                    <input
                      value={form.phoneNumber}
                      onChange={(e) => update("phoneNumber", e.target.value)}
                      className="tp-input !flex-1 min-w-0"
                      placeholder="11 1234 5678"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-800">Dirección</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-2">Domicilio (calle)</label>
                  <input
                    value={form.street}
                    onChange={(e) => update("street", e.target.value)}
                    placeholder="Ej: Av. Corrientes"
                    className="tp-input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Número</label>
                  <input
                    value={form.number}
                    onChange={(e) => update("number", e.target.value)}
                    placeholder="1234"
                    className="tp-input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Ciudad</label>
                  <input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="Ciudad"
                    className="tp-input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Provincia</label>
                  <input
                    value={form.province}
                    onChange={(e) => update("province", e.target.value)}
                    placeholder="Provincia"
                    className="tp-input"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Código Postal</label>
                  <input
                    value={form.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                    placeholder="C1000"
                    className="tp-input"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm text-gray-600 mb-2">País</label>
                  <input
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                    placeholder="Argentina"
                    className="tp-input"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-800">Seguridad</h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Contraseña</label>

                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="Creá una contraseña"
                      className="tp-input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#F36A21] transition"
                      aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                      <EyeIcon open={showPass} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Repetir contraseña</label>

                  <div className="relative">
                    <input
                      type={showPass2 ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => update("confirmPassword", e.target.value)}
                      placeholder="Repetí la contraseña"
                      className="tp-input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass2((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#F36A21] transition"
                      aria-label={showPass2 ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                      <EyeIcon open={showPass2} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-[#F36A21] py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Registrando..." : "Registrarme"}
            </button>

            <p className="text-center text-sm text-gray-600">
              ¿Ya tenés cuenta?{" "}
              <Link to="/login" className="text-[#F36A21] hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
