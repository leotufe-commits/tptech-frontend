export default function LoginCard() {
  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[0_24px_80px_rgba(0,0,0,0.10)]">
      <div className="mb-8">
        <div className="text-xs font-semibold tracking-wide text-[#F36A21]">
          TPTech
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1F1F]">
          Iniciar sesión
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Ingresá tus credenciales para continuar.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          type="email"
          placeholder="tuemail@ejemplo.com"
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[#1F1F1F] placeholder:text-gray-400 outline-none transition focus:border-[#F36A21] focus:ring-4 focus:ring-[rgba(243,106,33,0.15)]"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contraseña
        </label>
        <input
          type="password"
          placeholder="Ingresá tu contraseña"
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[#1F1F1F] placeholder:text-gray-400 outline-none transition focus:border-[#F36A21] focus:ring-4 focus:ring-[rgba(243,106,33,0.15)]"
        />
      </div>

      <button className="w-full rounded-2xl border-0 bg-[#F36A21] py-3.5 font-semibold text-white shadow-[0_12px_30px_rgba(243,106,33,0.25)] transition hover:opacity-95 active:scale-[0.99]">
        Iniciar sesión
      </button>

      <div className="mt-5 text-center">
        <a className="text-sm font-medium text-[#F36A21] hover:underline" href="#">
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </div>
  );
}
