import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import ThemeSwitcher from "./ThemeSwitcher";

type RouteMeta = {
  title: string;
  crumbs: { label: string; to?: string }[];
};

function getMeta(pathname: string): RouteMeta {
  const p = pathname.toLowerCase();

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return { title: "Dashboard", crumbs: [{ label: "Dashboard" }] };
  }

  if (p.startsWith("/divisas")) {
    return {
      title: "Divisas",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Divisas" }],
    };
  }

  if (p.startsWith("/inventario")) {
    if (p.includes("/articulos")) {
      return {
        title: "Artículos",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Inventario" },
          { label: "Artículos" },
        ],
      };
    }
    if (p.includes("/almacenes")) {
      return {
        title: "Almacenes",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Inventario" },
          { label: "Almacenes" },
        ],
      };
    }
    if (p.includes("/movimientos")) {
      return {
        title: "Movimientos",
        crumbs: [
          { label: "Dashboard", to: "/dashboard" },
          { label: "Inventario" },
          { label: "Movimientos" },
        ],
      };
    }
    return {
      title: "Inventario",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Inventario" }],
    };
  }

  if (p.startsWith("/ventas")) {
    return {
      title: "Ventas",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Ventas" }],
    };
  }

  if (p.startsWith("/compras")) {
    return {
      title: "Compras",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Compras" }],
    };
  }

  if (p.startsWith("/finanzas")) {
    return {
      title: "Finanzas",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Finanzas" }],
    };
  }

  if (p.startsWith("/configuracion")) {
    return {
      title: "Configuración",
      crumbs: [{ label: "Dashboard", to: "/dashboard" }, { label: "Configuración" }],
    };
  }

  return { title: "TPTech", crumbs: [{ label: "Dashboard", to: "/dashboard" }] };
}

export default function Topbar() {
  const { pathname } = useLocation();
  const meta = getMeta(pathname);
  const navigate = useNavigate();

  const { me, loading } = useMe();

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const jewelryName = me?.jewelry?.name ?? (loading ? "Cargando..." : "Sin joyería");
  const userLabel = me?.user?.name?.trim() || me?.user?.email || "Usuario";

  function logout() {
    localStorage.removeItem("tptech_token");
    localStorage.removeItem("tptech_user");
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Izquierda: Breadcrumb + título */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {meta.crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-2">
                {c.to ? (
                  <Link className="hover:text-primary" to={c.to}>
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-muted">{c.label}</span>
                )}
                {i < meta.crumbs.length - 1 && <span className="opacity-40">/</span>}
              </span>
            ))}
          </div>

          <h1 className="truncate text-lg font-semibold text-text">{meta.title}</h1>

          {/* ✅ ACÁ estaba el problema: antes era text-black/60 */}
          <div className="mt-1 text-xs text-muted">Resumen {today}</div>
        </div>

        {/* Derecha: Theme + Joyería + Acciones + Usuario */}
        <div className="flex items-center gap-3">
          <ThemeSwitcher />

          <button
            type="button"
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-text hover:opacity-90"
            onClick={() => alert("Selector de empresa (próximo paso)")}
            title={jewelryName}
          >
            Joyería: {jewelryName}
          </button>

          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            onClick={() => alert("Acciones rápidas (próximo paso)")}
          >
            Acciones rápidas
          </button>

          <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 md:flex">
            <div className="h-8 w-8 rounded-full bg-surface" />
            <div className="leading-tight">
              <div className="max-w-[180px] truncate text-sm font-semibold text-text">
                {userLabel}
              </div>
              <div className="max-w-[180px] truncate text-xs text-muted">
                {me?.user?.email || "—"}
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="ml-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text hover:opacity-90"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
