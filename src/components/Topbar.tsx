// tptech-frontend/src/components/Topbar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import ThemeSwitcher from "./ThemeSwitcher";
import { useAuth } from "../context/AuthContext";
import { updateUserAvatar } from "../services/users";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsFrom(label: string) {
  const clean = (label || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function Topbar() {
  const { pathname } = useLocation();
  const meta = useMemo(() => getMeta(pathname), [pathname]);
  const navigate = useNavigate();

  const { me, loading } = useMe();
  const { logout } = useAuth();

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const jewelryName = me?.jewelry?.name ?? (loading ? "Cargando..." : "Sin joyería");

  const userId = me?.user?.id ?? null;
  const userName = me?.user?.name?.trim() || "";
  const userEmail = me?.user?.email || "";
  const userLabel = userName || userEmail || "Usuario";
  const avatarUrl = me?.user?.avatarUrl ?? null;

  // Dropdown usuario
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return;
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  async function onPickAvatar(file: File) {
    if (!userId) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await updateUserAvatar(userId, dataUrl);
      // No forzamos refetch acá (tu useMe seguramente refresca por navegación o mount).
      // Si querés refresh instantáneo, lo hacemos en el siguiente paso con un "auth/me refresh".
      setMenuOpen(false);
      window.location.reload(); // ✅ MVP simple: reflejar avatar al instante
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    if (!userId) return;
    setAvatarBusy(true);
    try {
      await updateUserAvatar(userId, null);
      setMenuOpen(false);
      window.location.reload(); // ✅ MVP simple
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Izquierda */}
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
          <div className="mt-1 text-xs text-muted">Resumen {today}</div>
        </div>

        {/* Derecha */}
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

          {/* Usuario + dropdown */}
          <div ref={menuRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 hover:opacity-90",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              )}
            >
              <div className="h-8 w-8 overflow-hidden rounded-full border border-border bg-surface">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-bold text-primary">
                    {initialsFrom(userLabel)}
                  </div>
                )}
              </div>

              <div className="max-w-[200px] text-left leading-tight">
                <div className="truncate text-sm font-semibold text-text">{userLabel}</div>
                <div className="truncate text-xs text-muted">{userEmail || "—"}</div>
              </div>

              <span className="ml-1 text-xs text-muted">▾</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-[260px] overflow-hidden rounded-xl border border-border bg-bg shadow-xl">
                <div className="border-b border-border px-3 py-2">
                  <div className="text-xs text-muted">Cuenta</div>
                  <div className="truncate text-sm font-semibold text-text">{userEmail || "—"}</div>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/configuracion/cuenta");
                    }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-text hover:bg-surface2"
                  >
                    Perfil
                  </button>

                  <label
                    className={cn(
                      "block w-full cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-text hover:bg-surface2",
                      avatarBusy && "pointer-events-none opacity-60"
                    )}
                  >
                    {avatarBusy ? "Guardando…" : "Cambiar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) onPickAvatar(f);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={avatarBusy || !avatarUrl}
                    onClick={onRemoveAvatar}
                    className={cn(
                      "w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-text hover:bg-surface2",
                      (avatarBusy || !avatarUrl) && "opacity-60"
                    )}
                  >
                    Quitar foto
                  </button>

                  <div className="my-2 h-px bg-border" />

                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-text hover:bg-surface2"
                  >
                    Salir
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile: botón salir simple */}
          <button
            type="button"
            onClick={onLogout}
            className="md:hidden rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-text hover:opacity-90"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
