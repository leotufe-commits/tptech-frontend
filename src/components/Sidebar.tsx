// tptech-frontend/src/components/Sidebar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Avatar from "./ui/Avatar";
import { ChevronDown, PanelLeftOpen, PanelLeftClose } from "lucide-react";

import { SIDEBAR_NAV, type NavItem, type GroupItem } from "./sidebar/sidebar.nav";
import type { IconType } from "./sidebar/sidebar.icons";
import {
  cn,
  absUrl,
  getInitials,
  JEWELRY_LOGO_EVENT,
  USER_AVATAR_EVENT,
  COLLAPSED_W,
  isChildPathActive,
} from "./sidebar/sidebar.utils";

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
          <span
            className={cn(
              "text-[11px] leading-tight text-center",
              "w-full max-w-[66px] overflow-hidden line-clamp-2 break-words",
              "text-muted"
            )}
          >
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
            <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted")}>•</span>
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
  const active = children.some((c) => isChildPathActive(pathname, c.to));

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
    const top = Math.max(viewportPad, Math.min(window.innerHeight - viewportPad - maxH, desiredTop));

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
                aria-hidden="true"
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

      {/* ✅ TREE CONNECTORS (si esto NO aparece, expandedOpen NO está true) */}
      {expandedOpen && (
        <div className="relative ml-10 space-y-3">
          {/* DEBUG: si ves esta barra amarilla, el bloque se está montando */}
         
          {children.map((c, idx) => {
            const isLast = idx === children.length - 1;
            const isFirst = idx === 0;

            return (
              <div key={c.to} className="relative">
                {isFirst && (
                  <div className="pointer-events-none absolute left-5 -top-3 z-10 h-3 w-px bg-muted opacity-80" />
                )}

                <div
                  className={cn(
                    "pointer-events-none absolute left-5 top-0 z-10 w-px bg-muted opacity-80",
                    isLast ? "h-1/2" : "h-full"
                  )}
                />

                <div className="pointer-events-none absolute left-5 top-1/2 z-10 h-px w-5 bg-muted opacity-80" />

                <div className="relative z-20 pl-10">
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

  const storedExpanded = Number(localStorage.getItem("tptech_sidebar_last_expanded_width")) || 300;
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

  const [localLogoUrlRaw, setLocalLogoUrlRaw] = useState("");
  const [logoTick, setLogoTick] = useState(0);
  const [localAvatarUrlRaw, setLocalAvatarUrlRaw] = useState("");
  const [avatarTick, setAvatarTick] = useState(0);

  useEffect(() => {
    function onLogoChanged(e: any) {
      const next = String(e?.detail?.logoUrl || "");
      setLocalLogoUrlRaw(next);
      setLogoTick((t) => t + 1);
    }
    window.addEventListener(JEWELRY_LOGO_EVENT, onLogoChanged as any);
    return () => window.removeEventListener(JEWELRY_LOGO_EVENT, onLogoChanged as any);
  }, []);

  useEffect(() => {
    function onAvatarChanged(e: any) {
      const detail = e?.detail ?? {};
      const nextUserId = String(detail?.userId || "");
      const myId = String((auth.user as any)?.id || "");
      if (!nextUserId || !myId || nextUserId !== myId) return;

      const nextUrl = String(detail?.avatarUrl || "");
      setLocalAvatarUrlRaw(nextUrl);
      setAvatarTick((t) => t + 1);
    }
    window.addEventListener(USER_AVATAR_EVENT, onAvatarChanged as any);
    return () => window.removeEventListener(USER_AVATAR_EVENT, onAvatarChanged as any);
  }, [auth.user]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
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

  const jewelryName = auth.jewelry?.name ?? (auth.loading ? "Cargando..." : "Sin joyería");
  const user = auth.user ?? null;
  const userName: string = (user as any)?.name || (user as any)?.email || "Usuario";
  const userEmail: string = (user as any)?.email || "";

  const userRoleLabel: string = useMemo(() => {
    const roleArr = Array.isArray((auth as any)?.roles) ? ((auth as any).roles as any[]) : [];
    const names = roleArr
      .map((r) => {
        const dn = typeof r?.displayName === "string" ? r.displayName.trim() : "";
        const n = typeof r?.name === "string" ? r.name.trim() : "";
        return dn || n;
      })
      .filter(Boolean);

    if (names.length) return Array.from(new Set(names)).join(" • ");

    const perms = Array.isArray((auth as any)?.permissions) ? ((auth as any).permissions as string[]) : [];

    const hasAdmin = perms.some(
      (p) => /:ADMIN$/.test(p) || p.includes("USERS_ROLES:ADMIN") || p.includes("COMPANY_SETTINGS:ADMIN")
    );
    if (hasAdmin) return "Administrador";

    const hasEdit = perms.some((p) => /:EDIT$/.test(p) || p.includes(":WRITE") || p.includes(":UPDATE"));
    if (hasEdit) return "Empleado";

    const hasView = perms.some((p) => /:VIEW$/.test(p) || p.includes(":READ") || p.includes(":LIST"));
    if (hasView) return "Solo lectura";

    return "Usuario";
  }, [auth]);

  const logoUrlRaw = (localLogoUrlRaw || (auth.jewelry as any)?.logoUrl || "").trim();
  const logoBase = absUrl(logoUrlRaw);
  const jewelryBust = String((auth.jewelry as any)?.updatedAt ?? "").trim();
  const logoBust = jewelryBust || String(logoTick || 1);
  const logoSrc = logoBase ? `${logoBase}${logoBase.includes("?") ? "&" : "?"}v=${encodeURIComponent(logoBust)}` : "";

  const initials = getInitials(auth.jewelry?.name || jewelryName || "TPTech");

  const avatarUrlFinalRaw = String(localAvatarUrlRaw || (user as any)?.avatarUrl || "").trim();
  const avatarBustFinal = String(
    (user as any)?.avatarUpdatedAt ?? (user as any)?.updatedAt ?? (user as any)?.quickPinUpdatedAt ?? avatarTick ?? 1
  ).trim();

  async function onLogout() {
    try {
      await auth.logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  useEffect(() => {
    const firstMatch = SIDEBAR_NAV.find((it) => {
      if (it.kind !== "group") return false;
      return it.children.some((c) => isChildPathActive(pathname, c.to));
    });
    if (firstMatch?.kind === "group") setOpenGroup(firstMatch.label);
    else setOpenGroup(null);
  }, [pathname]);

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
        <div className="fixed inset-0 z-40 bg-black/40" onMouseDown={() => setDrawerOpen(false)} aria-hidden="true" />
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
        <div className={cn("border-b border-border px-4 py-4", effectiveCollapsed && !isMobile && "px-3")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-border bg-surface2">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-extrabold text-primary text-[13px] tracking-tight select-none">{initials}</span>
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
                if (locked) return;
                collapsed ? expandFromMobile() : collapseToMobile();
              }}
              disabled={locked}
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
          {SIDEBAR_NAV.map((item: NavItem, idx: number) => {
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
                disabled={locked}
              />
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar src={avatarUrlFinalRaw} name={userName} email={userEmail} size={40} bust={avatarBustFinal} />

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">{userName}</div>
              <div className="truncate text-xs text-muted">{userEmail}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted">{userRoleLabel}</div>
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
              if (locked) return;
              resizing.current = true;
              setIsResizing(true);
            }}
            className={cn(
              "hidden lg:block absolute right-0 top-0 h-full w-3 cursor-ew-resize select-none group",
              locked && "pointer-events-none opacity-60"
            )}
            title="Ajustar ancho"
            aria-hidden="true"
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
