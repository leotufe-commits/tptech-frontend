// tptech-frontend/src/components/Sidebar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import { useAuth } from "../context/AuthContext";

/* ---------------- utils ---------------- */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ---------------- types ---------------- */
type GroupItem = { label: string; to: string };
type NavItem =
  | { kind: "link"; label: string; to: string }
  | { kind: "group"; label: string; children: GroupItem[] }
  | { kind: "divider" };

/* ---------------- components ---------------- */
function Divider({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("my-3", collapsed ? "px-1" : "px-4")}>
      <div className="h-px bg-border" />
    </div>
  );
}

/* ---------- LEAF ---------- */
function Leaf({ to, label, collapsed }: { to: string; label: string; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group relative w-full select-none transition",
          "min-h-[56px] rounded-lg px-5 flex items-center",
          "text-[16px] font-semibold",
          collapsed && "justify-center px-0",
          "border",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
          isActive
            ? "bg-surface2 text-text border-border shadow-[0_2px_0_0_rgba(0,0,0,0.08)]"
            : "bg-card text-muted border-border shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-surface2 hover:text-text"
        )
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          {/* rail */}
          <span
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition",
              isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/40"
            )}
          />

          {collapsed ? (
            <span className={cn("text-sm font-bold", isActive ? "text-primary" : "text-muted")}>
              •
            </span>
          ) : (
            <span className="relative truncate pl-3">
              {label}
              {isActive && (
                <span className="absolute left-3 -bottom-1 h-[2px] w-[calc(100%-12px)] rounded-full bg-primary" />
              )}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ---------- GROUP ---------- */
function Group({
  label,
  children,
  collapsed,
}: {
  label: string;
  children: GroupItem[];
  collapsed: boolean;
}) {
  const { pathname } = useLocation();
  const active = children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (collapsed) {
    return (
      <button
        type="button"
        className={cn(
          "group relative w-full rounded-lg transition",
          "min-h-[56px] flex items-center justify-center",
          "border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
          active && "bg-surface2 shadow-[0_2px_0_0_rgba(0,0,0,0.08)]"
        )}
        title={label}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full",
            active ? "bg-primary" : "bg-transparent"
          )}
        />
        <span className={cn("text-sm font-bold", active ? "text-primary" : "text-muted")}>•</span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* header grupo */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group relative w-full rounded-lg transition select-none",
          "min-h-[56px] px-5 flex items-center justify-between",
          "text-[16px] font-bold",
          "border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
          "hover:bg-surface2 hover:text-text",
          open && "bg-surface2",
          active && "shadow-[0_2px_0_0_rgba(0,0,0,0.08)]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        )}
        aria-expanded={open}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition",
            active ? "bg-primary" : "bg-transparent group-hover:bg-primary/40"
          )}
        />
        <span className={cn("truncate pl-3", active ? "text-text" : "text-muted")}>{label}</span>
        <span className={cn("text-sm transition text-muted", open && "rotate-180")}>▾</span>
      </button>

      {/* SUBMENÚ con árbol */}
      {open && (
        <div className="relative ml-10 space-y-3">
          {children.map((c, idx) => {
            const isLast = idx === children.length - 1;
            return (
              <div key={c.to} className="relative">
                {/* tramo vertical por item (corta en el último) */}
                <div
                  className={cn(
                    "absolute left-5 top-0 w-px bg-border",
                    isLast ? "h-1/2" : "h-full"
                  )}
                />
                {/* conector horizontal */}
                <div className="absolute left-5 top-1/2 h-px w-5 bg-border" />

                <div className="pl-10">
                  <Leaf to={c.to} label={c.label} collapsed={false} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- main ---------------- */
export default function Sidebar() {
  const navigate = useNavigate();
  const { me, loading } = useMe();
  const { logout } = useAuth();

  const storedWidth = Number(localStorage.getItem("tptech_sidebar_width")) || 300;
  const storedMini = localStorage.getItem("tptech_sidebar_mini") === "1";

  const [width, setWidth] = useState(storedWidth);
  const [mini, setMini] = useState(storedMini);

  useEffect(() => localStorage.setItem("tptech_sidebar_width", String(width)), [width]);
  useEffect(() => localStorage.setItem("tptech_sidebar_mini", mini ? "1" : "0"), [mini]);

  const resizing = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizing.current) return;
      setWidth(Math.min(420, Math.max(92, e.clientX)));
    }
    function onMouseUp() {
      resizing.current = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const jewelryName = me?.jewelry?.name ?? (loading ? "Cargando..." : "Sin joyería");
  const user = me?.user;
  const avatarUrl = user?.avatarUrl ?? null;
  const userName = user?.name || "Usuario";
  const userEmail = user?.email || "";
  const logoUrl = (me as any)?.jewelry?.logoUrl as string | undefined;

  // ✅ permisos del /auth/me (string[])
  const perms: string[] = (me as any)?.permissions ?? [];
  const canSeeUsers = perms.includes("USERS_ROLES:VIEW") || perms.includes("USERS_ROLES:ADMIN");

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const nav: NavItem[] = useMemo(() => {
    const configChildren: GroupItem[] = [
      { label: "Datos de la empresa", to: "/configuracion/joyeria" },
      { label: "Cuenta", to: "/configuracion/cuenta" },
    ];

    if (canSeeUsers) {
      configChildren.push({ label: "Usuarios", to: "/configuracion/usuarios" });
    }

    return [
      { kind: "link", label: "Dashboard", to: "/dashboard" },
      { kind: "link", label: "Divisas", to: "/divisas" },

      { kind: "divider" },

      {
        kind: "group",
        label: "Inventario",
        children: [
          { label: "Artículos", to: "/inventario/articulos" },
          { label: "Almacenes", to: "/inventario/almacenes" },
          { label: "Movimientos", to: "/inventario/movimientos" },
        ],
      },
      {
        kind: "group",
        label: "Ventas",
        children: [
          { label: "Clientes", to: "/ventas/clientes" },
          { label: "Órdenes", to: "/ventas/ordenes" },
        ],
      },
      {
        kind: "group",
        label: "Compras",
        children: [
          { label: "Proveedores", to: "/compras/proveedores" },
          { label: "Órdenes", to: "/compras/ordenes" },
        ],
      },

      { kind: "divider" },

      { kind: "link", label: "Finanzas", to: "/finanzas" },
      {
        kind: "group",
        label: "Configuración",
        children: configChildren,
      },
    ];
  }, [canSeeUsers]);

  const actualWidth = mini ? 180 : width;
  const collapsed = !mini && actualWidth <= 92;
  const headerTextHidden = mini || collapsed;

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-bg"
      style={{ width: actualWidth }}
    >
      {/* HEADER */}
      <div className={cn("border-b border-border px-4 py-4", collapsed && "px-3")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-surface2 grid place-items-center overflow-hidden border border-border">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="font-bold text-primary">TP</span>
              )}
            </div>

            {!headerTextHidden && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-muted">TPTech</div>
                <div className="truncate font-semibold text-text text-base">{jewelryName}</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setMini((m) => !m)}
              className="h-10 w-10 grid place-items-center rounded-md border border-border bg-card text-lg font-bold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              title={mini ? "Expandir" : "Contraer"}
            >
              {mini ? ">" : "<"}
            </button>
          )}
        </div>
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {nav.map((item, idx) => {
          if (item.kind === "divider") return <Divider key={idx} collapsed={collapsed} />;
          if (item.kind === "group")
            return (
              <Group
                key={item.label}
                label={item.label}
                children={item.children}
                collapsed={collapsed}
              />
            );
          return <Leaf key={item.to} to={item.to} label={item.label} collapsed={collapsed} />;
        })}
      </nav>

      {/* FOOTER */}
      <div className="mt-auto border-t border-border bg-bg p-4">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-border bg-card">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">{userName}</div>
              {!mini && <div className="text-xs text-muted truncate">{userEmail}</div>}
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full min-h-[56px] rounded-lg border border-border bg-card text-sm font-semibold text-text hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
        >
          Cerrar sesión
        </button>
      </div>

      {!mini && (
        <div
          onMouseDown={() => (resizing.current = true)}
          className="absolute right-0 top-0 h-full w-1 cursor-ew-resize"
        />
      )}
    </aside>
  );
}
