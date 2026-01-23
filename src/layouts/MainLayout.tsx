// tptech-frontend/src/layouts/MainLayout.tsx
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import { InventoryProvider } from "../context/InventoryContext";
import Toaster from "../components/ui/Toaster";
import { useAuth } from "../context/AuthContext";

/** Convierte URLs relativas ("/uploads/...") en absolutas hacia el backend. */
function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

function getInitials(name: string) {
  const s = String(name || "").trim();
  if (!s) return "TP";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "T";
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? "P") || "P";
  return (a + b).toUpperCase();
}

/** Genera un favicon SVG con iniciales (data URL) */
function initialsFaviconDataUrl(initials: string) {
  const text = String(initials || "TP").slice(0, 2).toUpperCase();

  // colores neutros (no dependen del theme)
  const bg = "#111827"; // slate-900
  const fg = "#ffffff";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" ry="14" fill="${bg}"/>` +
    `<text x="32" y="38" text-anchor="middle" font-family="Inter,system-ui,Segoe UI,Roboto,Arial" font-size="26" font-weight="800" fill="${fg}">${text}</text>` +
    `</svg>`;

  // encode seguro para data URI
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");

  return `data:image/svg+xml,${encoded}`;
}

/** Setea favicon global (y persiste base href en localStorage) */
function setFavicon(baseHref: string) {
  try {
    const href = String(baseHref || "").trim() || "/favicon.ico";
    const head = document.head || document.getElementsByTagName("head")[0];

    // buscamos/creamos un link con id fijo
    let link = head.querySelector("#tptech-favicon") as HTMLLinkElement | null;
    if (!link) {
      // si hay otros favicons, tomamos el primero
      link = (head.querySelector('link[rel~="icon"]') as HTMLLinkElement | null) || null;
    }
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      head.appendChild(link);
    }
    link.id = "tptech-favicon";

    // guardamos base href para que index.html lo use en el próximo reload
    try {
      localStorage.setItem("tptech_favicon_href", href);
    } catch {}

    // cache-bust SOLO para URLs http/https (no para data:)
    const needsBust = /^https?:\/\//i.test(href) || href.startsWith("/");
    const finalHref = needsBust
      ? `${href}${href.includes("?") ? "&" : "?"}t=${Date.now()}`
      : href;

    link.href = finalHref;
  } catch {
    // no-op
  }
}

export default function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = useAuth();
  const { locked } = auth;

  // ✅ Favicon global: logo de la joyería o iniciales si no hay logo.
  // Además persiste en localStorage para que NO aparezca el "mundito" al recargar.
  useEffect(() => {
    const jewelryName = (auth.jewelry as any)?.name || "TPTech";
    const rawLogo = (auth.jewelry as any)?.logoUrl || "";
    const logo = absUrl(rawLogo);

    if (logo) {
      setFavicon(logo);
      return;
    }

    // sin logo -> iniciales
    const initials = getInitials(jewelryName);
    const dataUrl = initialsFaviconDataUrl(initials);
    setFavicon(dataUrl);
  }, [(auth.jewelry as any)?.logoUrl, (auth.jewelry as any)?.name]);

  return (
    <InventoryProvider>
      <div className="h-[100dvh] bg-bg text-text [--layout-gap:1.5rem] overflow-hidden">
        <Sidebar drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />

        <main
          className={[
            "bg-surface pr-[var(--layout-gap)] pl-[var(--layout-gap)]",
            "lg:pl-[calc(var(--sidebar-w,280px)+var(--layout-gap))]",
            "h-full overflow-y-auto overflow-x-hidden",
            "[webkit-overflow-scrolling:touch]",
            "overscroll-contain",
          ].join(" ")}
        >
          <Topbar onToggleSidebar={() => setDrawerOpen((v) => !v)} />

          <div
            className="w-full py-[var(--layout-gap)]"
            onTouchStart={() => {
              if (locked) return;
              if (drawerOpen) setDrawerOpen(false);
            }}
            onMouseDown={() => {
              if (locked) return;
              if (drawerOpen) setDrawerOpen(false);
            }}
          >
            <div
              className="w-full rounded-2xl bg-card p-6"
              style={{
                boxShadow: "var(--shadow)",
                border: "1px solid var(--border)",
              }}
            >
              <Outlet />
            </div>
          </div>

          <div className="h-[var(--layout-gap)]" />
        </main>

        {/* ✅ LockScreen se renderiza SOLO desde ProtectedRoute */}
        <Toaster />
      </div>
    </InventoryProvider>
  );
}
