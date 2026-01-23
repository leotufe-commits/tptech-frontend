// tptech-frontend/src/components/LoginCard.tsx
export default function LoginCard() {
  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[0_24px_80px_rgba(0,0,0,0.10)]">
      <div className="mb-8">
        {/* ✅ Logo login: TPT fondo negro */}
        <div className="flex items-center justify-center">
          <div
            className="inline-flex h-12 min-w-[72px] items-center justify-center rounded-2xl px-4"
            style={{ backgroundColor: "#0b0b0d" }}
            aria-label="TPTech"
            title="TPTech"
          >
            <span
              className="text-[18px] font-extrabold tracking-[-0.06em]"
              style={{ color: "#ffffff" }}
            >
              TPT
            </span>
          </div>
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#1F1F1F]">
          Iniciar sesión
        </h1>

        <p className="mt-2 text-sm text-gray-500">Ingresá tus credenciales para continuar.</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input
          type="email"
          placeholder="tuemail@ejemplo.com"
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[#1F1F1F] placeholder:text-gray-400 outline-none transition focus:border-[#0b0b0d] focus:ring-4 focus:ring-[rgba(11,11,13,0.12)]"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
        <input
          type="password"
          placeholder="Ingresá tu contraseña"
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[#1F1F1F] placeholder:text-gray-400 outline-none transition focus:border-[#0b0b0d] focus:ring-4 focus:ring-[rgba(11,11,13,0.12)]"
        />
      </div>

      <button className="w-full rounded-2xl border-0 bg-[#0b0b0d] py-3.5 font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.20)] transition hover:opacity-95 active:scale-[0.99]">
        Iniciar sesión
      </button>

      <div className="mt-5 text-center">
        <a className="text-sm font-medium text-[#0b0b0d] hover:underline" href="#">
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </div>
  );
}
