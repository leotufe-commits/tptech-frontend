import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";

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
      <div className="h-px bg-zinc-300" />
    </div>
  );
}

/* ---------- LEAF ---------- */
function Leaf({
  to,
  label,
  collapsed,
}: {
  to: string;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group relative w-full rounded-lg select-none transition",
          "min-h-[56px] px-5 flex items-center",
          "text-[16px] font-semibold",
          collapsed && "justify-center px-0",
          "border",
          isActive
            ? "bg-zinc-100 text-zinc-900 border-zinc-300 shadow-[0_2px_0_0_rgba(0,0,0,0.08)]"
            : "bg-white text-zinc-700 border-zinc-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-zinc-50 hover:text-zinc-900"
        )
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          {/* rail naranja */}
          <span
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition",
              isActive ? "bg-orange-500" : "bg-transparent group-hover:bg-orange-300"
            )}
          />

          {collapsed ? (
            <span className={cn("text-sm font-bold", isActive ? "text-orange-600" : "text-zinc-500")}>
              •
            </span>
          ) : (
            <span className="relative truncate pl-3">
              {label}
              {/* subrayado naranja */}
              {isActive && (
                <span className="absolute left-3 -bottom-1 h-[2px] w-[calc(100%-12px)] rounded-full bg-orange-500" />
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
          "border border-zinc-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
          active && "bg-zinc-100 shadow-[0_2px_0_0_rgba(0,0,0,0.08)]"
        )}
        title={label}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full",
            active ? "bg-orange-500" : "bg-transparent"
          )}
        />
        <span className={cn("text-sm font-bold", active ? "text-orange-600" : "text-zinc-500")}>
          •
        </span>
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
          "border border-zinc-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
          "hover:bg-zinc-50",
          open && "bg-zinc-50",
          active && "shadow-[0_2px_0_0_rgba(0,0,0,0.08)]"
        )}
        aria-expanded={open}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition",
            active ? "bg-orange-500" : "bg-transparent group-hover:bg-orange-300"
          )}
        />
        <span className="truncate pl-3">{label}</span>
        <span className={cn("text-sm transition", open && "rotate-180")}>▾</span>
      </button>

      {/* SUBMENÚ con árbol: línea vertical corta en el último botón */}
      {open && (
        <div className="relative ml-10 space-y-3">
          {children.map((c, idx) => {
            const isLast = idx === children.length - 1;
            return (
              <div key={c.to} className="relative">
                {/* tramo vertical por item (corta en el último) */}
                <div
                  className={cn(
                    "absolute left-5 top-0 w-px bg-zinc-800/60",
                    isLast ? "h-1/2" : "h-full"
                  )}
                />
                {/* conector horizontal hasta el borde del botón */}
                <div className="absolute left-5 top-1/2 h-px w-5 bg-zinc-800/60" />

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

  const storedWidth = Number(localStorage.getItem("tptech_sidebar_width")) || 300;
  const storedMini = localStorage.getItem("tptech_sidebar_mini") === "1";

  const [width, setWidth] = useState(storedWidth);
  const [mini, setMini] = useState(storedMini);

  useEffect(() => localStorage.setItem("tptech_sidebar_width", String(width)), [width]);
  useEffect(() => localStorage.setItem("tptech_sidebar_mini", mini ? "1" : "0"), [mini]);

  const resizing = useRef(false);
  function onMouseDown() {
    resizing.current = true;
  }
  function onMouseMove(e: MouseEvent) {
    if (!resizing.current) return;
    setWidth(Math.min(420, Math.max(92, e.clientX)));
  }
  function onMouseUp() {
    resizing.current = false;
  }

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const jewelryName = me?.jewelry?.name ?? (loading ? "Cargando..." : "Sin joyería");
  const userName = me?.user?.name || "Usuario";
  const userEmail = me?.user?.email || "";
  const logoUrl = (me as any)?.jewelry?.logoUrl as string | undefined;

  function logout() {
    localStorage.removeItem("tptech_token");
    localStorage.removeItem("tptech_user");
    navigate("/login");
  }

  const nav: NavItem[] = useMemo(
    () => [
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
        children: [
          { label: "Datos de la empresa", to: "/configuracion/joyeria" },
          { label: "Cuenta", to: "/configuracion/cuenta" },
        ],
      },
    ],
    []
  );

  const actualWidth = mini ? 180 : width;
  const collapsed = !mini && actualWidth <= 92;
  const headerTextHidden = mini || collapsed;

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-200 bg-white"
      style={{ width: actualWidth }}
    >
      {/* HEADER */}
      <div className={cn("border-b border-zinc-200 px-4 py-4", collapsed && "px-3")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-zinc-100 grid place-items-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="font-bold text-orange-600">TP</span>
              )}
            </div>

            {!headerTextHidden && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-500">TPTech</div>
                <div className="truncate font-semibold text-zinc-900 text-base">{jewelryName}</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setMini((m) => !m)}
              className="h-10 w-10 grid place-items-center rounded-md border border-zinc-200 bg-white text-lg font-bold text-zinc-700 hover:bg-zinc-50"
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
      <div className="mt-auto border-t border-zinc-200 bg-white p-4">
        {!collapsed && (
          <div className="mb-3">
            <div className="text-sm font-semibold text-zinc-900 truncate">{userName}</div>
            {!mini && <div className="text-xs text-zinc-500 truncate">{userEmail}</div>}
          </div>
        )}

        <button
          onClick={logout}
          className="w-full min-h-[56px] rounded-lg border border-zinc-200 bg-white text-sm font-semibold hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
        >
          Cerrar sesión
        </button>
      </div>

      {!mini && (
        <div
          onMouseDown={onMouseDown}
          className="absolute right-0 top-0 h-full w-1 cursor-ew-resize"
        />
      )}
    </aside>
  );
}
