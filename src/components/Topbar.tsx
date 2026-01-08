// tptech-frontend/src/components/Topbar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";
import ThemeSwitcher from "./ThemeSwitcher";
import { useAuth } from "../context/AuthContext";
import { updateUserAvatar, removeMyAvatar } from "../services/users";

type RouteMeta = {
  title: string;
  crumbs: { label: string; to?: string }[];
};

function getMeta(pathname: string): RouteMeta {
  const p = pathname.toLowerCase();

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return { title: "Dashboard", crumbs: [{ label: "Dashboard" }] };
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

export default function Topbar() {
  const { pathname } = useLocation();
  const meta = useMemo(() => getMeta(pathname), [pathname]);
  const navigate = useNavigate();

  const { me, loading, refresh } = useMe();
  const { logout } = useAuth();

  const user = me?.user ?? null;
  const jewelryName = me?.jewelry?.name ?? (loading ? "Cargando..." : "Sin joyería");

  const userLabel = user?.name?.trim() || user?.email || "Usuario";
  const avatarUrl = user?.avatarUrl ?? null;

  // ✅ cache busting del avatar
  const avatarSrc = useMemo(() => {
    if (!avatarUrl) return null;
    const v = user?.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
    return `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${v}`;
  }, [avatarUrl, user?.updatedAt]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return;
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
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
    setAvatarBusy(true);
    try {
      await updateUserAvatar(file);
      await refresh(); // ✅ refresca /auth/me
      setMenuOpen(false);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    setAvatarBusy(true);
    try {
      await removeMyAvatar();
      await refresh(); // ✅ refresca /auth/me
      setMenuOpen(false);
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Izquierda */}
        <div>
          <div className="flex gap-2 text-xs text-muted">
            {meta.crumbs.map((c, i) => (
              <span key={i}>
                {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
                {i < meta.crumbs.length - 1 && " / "}
              </span>
            ))}
          </div>
          <h1 className="text-lg font-semibold">{meta.title}</h1>
        </div>

        {/* Derecha */}
        <div className="flex items-center gap-3">
          <ThemeSwitcher />

          <button className="rounded-xl border px-3 py-2 text-sm" title={jewelryName}>
            Joyería: {jewelryName}
          </button>

          {/* Usuario */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border px-3 py-2"
            >
              <div className="h-8 w-8 overflow-hidden rounded-full border bg-surface">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-bold text-primary">
                    {initialsFrom(userLabel)}
                  </div>
                )}
              </div>
              <span className="text-sm">{userLabel}</span>
              <span className="text-xs text-muted">▾</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl border bg-bg shadow">
                <div className="p-2 space-y-1">
                  <label
                    className={cn(
                      "block cursor-pointer rounded-lg border px-3 py-2 text-sm",
                      avatarBusy && "opacity-60 pointer-events-none"
                    )}
                  >
                    {avatarBusy ? "Guardando…" : "Cambiar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) onPickAvatar(f);
                      }}
                    />
                  </label>

                  <button
                    disabled={!avatarUrl || avatarBusy}
                    onClick={onRemoveAvatar}
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                    type="button"
                  >
                    Quitar foto
                  </button>

                  <div className="h-px bg-border my-2" />

                  <button onClick={onLogout} className="w-full rounded-lg border px-3 py-2 text-sm" type="button">
                    Salir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
