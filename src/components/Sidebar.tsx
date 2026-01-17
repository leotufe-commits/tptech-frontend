// tptech-frontend/src/components/Sidebar.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Landmark,
  Settings,
  ChevronDown,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";

/* ---------------- utils ---------------- */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Convierte URLs relativas ("/uploads/...") en absolutas hacia el backend.
 * Si ya es "http/https", la deja igual.
 */
function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base =
    (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

/* ---------------- types ---------------- */
type IconType = ComponentType<{ size?: number; className?: string }>;
type GroupItem = { label: string; to: string };

type NavItem =
  | { kind: "link"; label: string; to: string; icon?: IconType }
  | { kind: "group"; label: string; icon?: IconType; children: GroupItem[] }
  | { kind: "divider" };

/* ---------------- custom icons ---------------- */
/** Icono “Lingotes” (sin depender de lucide) */
const GoldBarsIcon: IconType = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4.8 12.2 9.2 10.4c.5-.2 1.1-.2 1.6 0l4.4 1.8c.8.3 1.3 1.1 1.1 2l-1.1 5c-.2.9-1 1.6-2 1.6H7.8c-1 0-1.8-.7-2-1.6l-1.1-5c-.2-.9.3-1.7 1.1-2Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M7.4 5.9 11 4.6c.6-.2 1.3-.2 1.9 0l3.6 1.3c.8.3 1.4 1.2 1.2 2.1l-.3 1.4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      opacity="0.9"
    />
    <path
      d="M9 14.2h6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      opacity="0.9"
    />
  </svg>
);

/* ---------------- components ---------------- */
function Divider({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("my-3", collapsed ? "px-1" : "px-4")}>
      <div className="h-px bg-border" />
    </div>
  );
}

/* ---------- LEAF ---------- */
function Leaf({
  to,
  label,
  collapsed,
  icon: Icon,
  onNavigate,
  disabled,
}: {
  to: string;
  label: string;
  collapsed: boolean;
  icon?: IconType;
  onNavigate?: () => void;
  disabled?: boolean;
}) {
  if (disabled) {
    // ✅ bloqueado: render como "item" sin navegación
    return (
      <div
        className={cn(
          "group relative w-full select-none transition overflow-hidden cursor-not-allowed opacity-60",
          collapsed
            ? "min-h-[70px] rounded-xl px-2 py-2 flex flex-col items-center justify-center gap-2"
            : "min-h-[56px] rounded-lg px-5 flex items-center",
          "text-[15px] font-semibold",
          "border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
        )}
        title={collapsed ? label : undefined}
        aria-disabled="true"
      >
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-transparent" />

        {Icon ? (
          <Icon size={20} className={cn("shrink-0", collapsed ? "" : "ml-2", "text-muted")} />
        ) : (
          <span className={cn("shrink-0", "text-muted")}>•</span>
        )}

        {collapsed ? (
          <span className={cn("text-[11px] leading-tight text-center", "w-full max-w-[66px] overflow-hidden line-clamp-2 break-words", "text-muted")}>
            {label}
          </span>
        ) : (
          <span className="relative truncate pl-3 text-muted">{label}</span>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative w-full select-none transition overflow-hidden",
          collapsed
            ? "min-h-[70px] rounded-xl px-2 py-2 flex flex-col items-center justify-center gap-2"
            : "min-h-[56px] rounded-lg px-5 flex items-center",
          "text-[15px] font-semibold",
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
          <span
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition",
              isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/40"
            )}
          />

          {Icon ? (
            <Icon
              size={20}
              className={cn(
                "shrink-0",
                collapsed ? "" : "ml-2",
                isActive ? "text-primary" : "text-muted group-hover:text-text"
              )}
            />
          ) : (
            <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted")}>
              •
            </span>
          )}

          {collapsed ? (
            <span
              className={cn(
                "text-[11px] leading-tight text-center",
                "w-full max-w-[66px] overflow-hidden line-clamp-2 break-words",
                isActive ? "text-text" : "text-muted"
              )}
            >
              {label}
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

/* ---------- GROUP (CONTROLADO DESDE Sidebar) ---------- */
function Group({
  label,
  icon: Icon,
  children,
  collapsed,
  open,
  onToggle,
  popoverOpen,
  setPopoverOpen,
  onNavigate,
}: {
  label: string;
  icon?: IconType;
  children: GroupItem[];
  collapsed: boolean;

  open: boolean;
  onToggle: () => void;

  popoverOpen: boolean;
  setPopoverOpen: (v: boolean) => void;

  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const active = children.some(
    (c) => pathname === c.to || pathname.startsWith(c.to + "/")
  );

  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!collapsed || !popoverOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, popoverOpen, setPopoverOpen]);

  const [, forcePosTick] = useState(0);
  useEffect(() => {
    if (!collapsed || !popoverOpen) return;

    const onRecalc = () => forcePosTick((t) => t + 1);
    window.addEventListener("resize", onRecalc);
    window.addEventListener("scroll", onRecalc, true);
    return () => {
      window.removeEventListener("resize", onRecalc);
      window.removeEventListener("scroll", onRecalc, true);
    };
  }, [collapsed, popoverOpen]);

  function getPopoverStyle() {
    const r = btnRef.current?.getBoundingClientRect();
    const gap = 12;
    const W = 320;

    const viewportPad = 12;
    const maxH = Math.min(560, Math.max(320, window.innerHeight - viewportPad * 2));

    const btnRight = r?.right ?? 0;
    const btnLeft = r?.left ?? 0;
    const btnTop = r?.top ?? 0;

    const canRight = btnRight + gap + W <= window.innerWidth - viewportPad;
    const left = canRight ? btnRight + gap : Math.max(viewportPad, btnLeft - gap - W);

    const desiredTop = btnTop;
    const top = Math.max(
      viewportPad,
      Math.min(window.innerHeight - viewportPad - maxH, desiredTop)
    );

    return {
      position: "fixed" as const,
      left,
      top,
      width: W,
      maxHeight: maxH,
      zIndex: 9999,
      ["--popover-max" as any]: `${maxH}px`,
    };
  }

  const expandedOpen = open || active;

  if (collapsed) {
    return (
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setPopoverOpen(!popoverOpen)}
          className={cn(
            "group relative w-full rounded-xl transition select-none overflow-hidden",
            "min-h-[70px] px-2 py-2 flex flex-col items-center justify-center gap-2",
            "border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
            active && "bg-surface2 shadow-[0_2px_0_0_rgba(0,0,0,0.08)]",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          )}
          title={label}
        >
          <span
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full",
              active ? "bg-primary" : "bg-transparent"
            )}
          />
          {Icon ? <Icon size={20} className={cn(active ? "text-primary" : "text-muted")} /> : null}

          <span
            className={cn(
              "text-[11px] leading-tight text-center",
              "w-full max-w-[66px] overflow-hidden line-clamp-2 break-words",
              active ? "text-text" : "text-muted"
            )}
          >
            {label}
          </span>
        </button>

        {popoverOpen &&
          createPortal(
            <>
              <div
                onMouseDown={() => setPopoverOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 9998 }}
              />

              <div
                style={getPopoverStyle()}
                className="rounded-2xl border border-border bg-bg shadow-[0_18px_40px_rgba(0,0,0,0.18)] overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 bg-bg">
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      {Icon ? <Icon size={18} className="text-primary" /> : null}
                      <div className="font-semibold text-text">{label}</div>
                    </div>
                    <div className="text-xs text-muted mt-0.5">Opciones</div>
                  </div>
                </div>

                <div className="p-2 tp-scroll" style={{ maxHeight: "calc(var(--popover-max, 560px) - 1px)" }}>
                  <div className="max-h-[60vh] overflow-auto tp-scroll">
                    {children.map((c) => (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        className={({ isActive }) =>
                          cn(
                            "block w-full rounded-xl px-3 py-2 text-sm transition border",
                            isActive
                              ? "bg-surface2 text-text border-border"
                              : "bg-card text-muted border-transparent hover:border-border hover:bg-surface2 hover:text-text"
                          )
                        }
                        onClick={() => {
                          setPopoverOpen(false);
                          onNavigate?.();
                        }}
                      >
                        {c.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group relative w-full rounded-lg transition select-none",
          "min-h-[56px] px-5 flex items-center justify-between",
          "text-[15px] font-bold",
          "border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
          "hover:bg-surface2 hover:text-text",
          expandedOpen && "bg-surface2",
          active && "shadow-[0_2px_0_0_rgba(0,0,0,0.08)]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        )}
        aria-expanded={expandedOpen}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition",
            active ? "bg-primary" : "bg-transparent group-hover:bg-primary/40"
          )}
        />

        <div className="flex items-center gap-3 min-w-0">
          {Icon ? <Icon size={20} className={cn(active ? "text-primary" : "text-muted")} /> : null}
          <span className={cn("truncate", active ? "text-text" : "text-muted")}>{label}</span>
        </div>

        <ChevronDown className={cn("h-4 w-4 text-muted transition", expandedOpen && "rotate-180")} />
      </button>

      {expandedOpen && (
        <div className="relative ml-10 space-y-3">
          {children.map((c, idx) => {
            const isLast = idx === children.length - 1;
            return (
              <div key={c.to} className="relative">
                <div className={cn("absolute left-5 top-0 w-px bg-border", isLast ? "h-1/2" : "h-full")} />
                <div className="absolute left-5 top-1/2 h-px w-5 bg-border" />
                <div className="pl-10">
                  <Leaf to={c.to} label={c.label} collapsed={false} onNavigate={onNavigate} />
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
export default function Sidebar({
  drawerOpen,
  setDrawerOpen,
}: {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const auth = useAuth();
  const locked = auth.locked;
  const { pathname } = useLocation();

  const COLLAPSED_W = 84;

  const storedExpanded =
    Number(localStorage.getItem("tptech_sidebar_last_expanded_width")) || 300;
  const storedMini = localStorage.getItem("tptech_sidebar_mini") === "1";
  const hasStored = Boolean(localStorage.getItem("tptech_sidebar_last_expanded_width"));

  const [width, setWidth] = useState(hasStored ? storedExpanded : COLLAPSED_W);
  const [mini, setMini] = useState(hasStored ? storedMini : false);

  const [isResizing, setIsResizing] = useState(false);

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [popoverGroup, setPopoverGroup] = useState<string | null>(null);

  const resizing = useRef(false);

  const desktopActualWidth = mini ? 180 : width;
  const actualWidth = desktopActualWidth;

  const collapsed = !mini && actualWidth <= COLLAPSED_W;
  const headerTextHidden = mini || collapsed;

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, isMobile]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, isMobile, setDrawerOpen]);

  useEffect(() => {
    if (!locked) return;

    setPopoverGroup(null);
    setOpenGroup(null);

    if (isMobile) setDrawerOpen(false);
  }, [locked, isMobile, setDrawerOpen]);

  useEffect(() => {
    setPopoverGroup(null);
    if (isMobile) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!mini && width > COLLAPSED_W) {
      localStorage.setItem("tptech_sidebar_last_expanded_width", String(width));
    }
  }, [width, mini]);

  useEffect(() => localStorage.setItem("tptech_sidebar_mini", mini ? "1" : "0"), [mini]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizing.current) return;
      const next = Math.min(420, Math.max(COLLAPSED_W, e.clientX));
      setWidth(next);
    }
    function onMouseUp() {
      resizing.current = false;
      setIsResizing(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${actualWidth}px`);
  }, [actualWidth]);

  const jewelryName =
    auth.jewelry?.name ?? (auth.loading ? "Cargando..." : "Sin joyería");

  const user = auth.user ?? null;

  const avatarUrl: string | null = (user as any)?.avatarUrl ?? null;
  const userName: string = (user as any)?.name || (user as any)?.email || "Usuario";
  const userEmail: string = (user as any)?.email || "";

  const logoUrlRaw = (auth.jewelry as any)?.logoUrl ?? "";
  const logoUrl = absUrl(logoUrlRaw);

  const perms: string[] = auth.permissions ?? [];

  const canSeeUsers =
    perms.includes("USERS_ROLES:VIEW") || perms.includes("USERS_ROLES:ADMIN");
  const canSeeRoles = canSeeUsers;

  async function onLogout() {
    try {
      await auth.logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const nav: NavItem[] = useMemo(() => {
    const configChildren: GroupItem[] = [];
    if (canSeeUsers) configChildren.push({ label: "Usuarios", to: "/configuracion/usuarios" });
    if (canSeeRoles) configChildren.push({ label: "Roles", to: "/configuracion/roles" });
    configChildren.push({ label: "Datos de la Empresa", to: "/configuracion/joyeria" });

    return [
      { kind: "link", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { kind: "link", label: "Divisas", to: "/divisas", icon: GoldBarsIcon },

      { kind: "divider" },

      {
        kind: "group",
        label: "Artículos",
        icon: Boxes,
        children: [
          { label: "Artículos", to: "/articulos/articulos" },
          { label: "Artículos compuestos", to: "/articulos/compuestos" },
          { label: "Grupos de artículos", to: "/articulos/grupos" },
        ],
      },

      {
        kind: "group",
        label: "Inventario",
        icon: Package,
        children: [
          { label: "Almacenes", to: "/inventario/almacenes" },
          { label: "Movimientos", to: "/inventario/movimientos" },
        ],
      },

      {
        kind: "group",
        label: "Ventas",
        icon: ShoppingCart,
        children: [
          { label: "Cliente", to: "/ventas/clientes" },
          { label: "Orden de Venta", to: "/ventas/ordenes-venta" },
          { label: "Factura de Clientes", to: "/ventas/facturas-clientes" },
          { label: "Paquetes", to: "/ventas/paquetes" },
          { label: "Remitos", to: "/ventas/remitos" },
          { label: "Pagos Recibidos", to: "/ventas/pagos-recibidos" },
          { label: "Devoluciones de Venta", to: "/ventas/devoluciones" },
          { label: "Nota de Credito", to: "/ventas/notas-credito" },
        ],
      },

      {
        kind: "group",
        label: "Compras",
        icon: ShoppingBag,
        children: [
          { label: "Proveedores", to: "/compras/proveedores" },
          { label: "Orden de Compra", to: "/compras/ordenes-compra" },
          { label: "Factura de Proveedor", to: "/compras/facturas-proveedor" },
          { label: "Recepcion de Compras", to: "/compras/recepciones" },
          { label: "Pagos Realizados", to: "/compras/pagos-realizados" },
          { label: "Devolucion", to: "/compras/devoluciones" },
          { label: "Creditos del Proveedor", to: "/compras/creditos-proveedor" },
        ],
      },

      { kind: "divider" },

      { kind: "link", label: "Finanzas", to: "/finanzas", icon: Landmark },

      {
        kind: "group",
        label: "Configuracion",
        icon: Settings,
        children: configChildren,
      },
    ];
  }, [canSeeUsers, canSeeRoles]);

  useEffect(() => {
    const firstMatch = nav.find((it) => {
      if (it.kind !== "group") return false;
      return it.children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
    });
    if (firstMatch?.kind === "group") setOpenGroup(firstMatch.label);
    else setOpenGroup(null); // ✅
  }, [pathname, nav]);

  function collapseToMobile() {
    setMini(false);
    setWidth(COLLAPSED_W);
    setOpenGroup(null);
    setPopoverGroup(null);
  }

  function expandFromMobile() {
    const expanded = Number(localStorage.getItem("tptech_sidebar_last_expanded_width")) || 300;
    setMini(false);
    setWidth(expanded);
  }

  const drawerWidth = Math.min(340, Math.max(280, storedExpanded || 300));
  const asideWidth = isMobile ? drawerWidth : actualWidth;

  const onNavigate = () => {
    if (isMobile) setDrawerOpen(false);
  };

  const effectiveCollapsed = collapsed && !isMobile;

  return (
    <>
      {isMobile && drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onMouseDown={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-bg",
          isMobile
            ? cn(
                "transition-transform duration-200 will-change-transform",
                drawerOpen ? "translate-x-0" : "-translate-x-full"
              )
            : ""
        )}
        style={{ width: asideWidth }}
      >
        <div
          className={cn(
            "border-b border-border px-4 py-4",
            effectiveCollapsed && !isMobile && "px-3"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-border bg-surface2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-bold text-primary">TP</span>
                )}
              </div>

              {(!headerTextHidden || isMobile) && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-muted">TPTech</div>
                  <div className="truncate text-base font-semibold text-text">{jewelryName}</div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (locked) return; // ✅
                collapsed ? expandFromMobile() : collapseToMobile();
              }}
              disabled={locked} // ✅
              className={cn(
                "hidden lg:grid h-10 w-10 place-items-center rounded-md border border-border bg-card text-text hover:bg-surface2",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                locked && "opacity-60 cursor-not-allowed"
              )}
              title={collapsed ? "Expandir" : "Colapsar"}
              type="button"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4 tp-scroll">
          {nav.map((item, idx) => {
            if (item.kind === "divider") return <Divider key={idx} collapsed={effectiveCollapsed} />;

            if (item.kind === "group") {
              const isOpen = openGroup === item.label;

              return (
                <Group
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  children={item.children}
                  collapsed={effectiveCollapsed}
                  open={isOpen}
                  onToggle={() => {
                    if (locked) return;
                    setPopoverGroup(null);
                    setOpenGroup((prev) => (prev === item.label ? null : item.label));
                  }}
                  popoverOpen={!locked && popoverGroup === item.label}
                  setPopoverOpen={(v) => {
                    if (locked) return;
                    setOpenGroup(null);
                    setPopoverGroup(v ? item.label : null);
                  }}
                  onNavigate={onNavigate}
                />
              );
            }

            return (
              <Leaf
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                collapsed={effectiveCollapsed}
                onNavigate={onNavigate}
                disabled={locked} // ✅
              />
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border bg-bg p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-border bg-card">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">{userName}</div>
              <div className="truncate text-xs text-muted">{userEmail}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="min-h-[56px] w-full rounded-lg border border-border bg-card text-sm font-semibold text-text shadow-[0_1px_0_0_rgba(0,0,0,0.05)] hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            type="button"
          >
            Cerrar sesión
          </button>
        </div>

        {!mini && !collapsed && (
          <div
            onMouseDown={() => {
              if (locked) return; // ✅
              resizing.current = true;
              setIsResizing(true);
            }}
            className={cn(
              "hidden lg:block absolute right-0 top-0 h-full w-3 cursor-ew-resize select-none group",
              locked && "pointer-events-none opacity-60" // ✅
            )}
            title="Ajustar ancho"
          >
            <div
              className={cn(
                "absolute right-1 top-0 h-full w-[2px] rounded-full transition",
                isResizing ? "bg-primary/70" : "bg-transparent group-hover:bg-primary/40"
              )}
            />
            <div className="absolute right-0 top-0 h-full w-3" />
          </div>
        )}
      </aside>
    </>
  );
}
