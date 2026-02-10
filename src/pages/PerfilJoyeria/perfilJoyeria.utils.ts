// src/pages/PerfilJoyeria/perfilJoyeria.utils.ts
import type { CatalogItem } from "../../services/catalogs";
import type { CompanyBody, ExistingBody, UpdatePayload } from "./perfilJoyeria.types";

export function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function cardBase(extra?: string) {
  return cn("tp-card rounded-2xl border border-border bg-card", extra);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function safeFileLabel(name: string) {
  return String(name || "").trim() || "Archivo";
}

export function valueOrDash(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

export function formatDateTime(v?: string | Date | null) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const API = base.replace(/\/+$/, "");
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API}${p}`;
}

export function jewelryToDraft(j: any): { existing: ExistingBody; company: CompanyBody } {
  return {
    existing: {
      name: j?.name || "",
      phoneCountry: j?.phoneCountry || "",
      phoneNumber: j?.phoneNumber || "",
      street: j?.street || "",
      number: j?.number || "",
      city: j?.city || "",
      province: j?.province || "",
      postalCode: j?.postalCode || "",
      country: j?.country || "",
    },
    company: {
      logoUrl: j?.logoUrl || "",
      legalName: j?.legalName || "",
      cuit: j?.cuit || "",
      ivaCondition: j?.ivaCondition || "",
      email: j?.email || "",
      website: j?.website || "",
      notes: j?.notes || "",
    },
  };
}

export function buildPayload(existing: ExistingBody, company: CompanyBody): UpdatePayload {
  return {
    ...existing,
    logoUrl: company.logoUrl?.trim() || "",
    legalName: company.legalName?.trim() || "",
    cuit: company.cuit?.trim() || "",
    ivaCondition: company.ivaCondition?.trim() || "",
    email: company.email?.trim() || "",
    website: company.website?.trim() || "",
    notes: company.notes ?? "",
  };
}

export function pickFavoriteLabel(items: CatalogItem[]) {
  const fav = (items || []).find((x: any) => Boolean((x as any)?.isFavorite));
  return String((fav as any)?.label || "").trim();
}

/* =====================================================
   Helpers que el hook espera
===================================================== */

export function devLog(...args: any[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

export function getInitials(name: string) {
  const s = String(name || "").trim();
  if (!s) return "TP";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  const out = (a + b).trim();
  return out || "TP";
}

export function pickJewelryFromMe(me: any) {
  if (!me) return null;
  return me.jewelry ?? me.Jewelry ?? me.company ?? me.Company ?? me?.data?.jewelry ?? me?.data?.company ?? null;
}

export function normalizeJewelryResponse(resp: any) {
  const j = resp?.jewelry ?? resp?.data?.jewelry ?? resp;
  if (!j || typeof j !== "object") return j;

  const attachments = Array.isArray((j as any).attachments) ? (j as any).attachments : [];
  return { ...j, attachments };
}

/* =====================================================
   ✅ FAVICON (blindado + fallback iniciales)
===================================================== */

function applyFavicon(href: string, type?: string) {
  try {
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    const links = Array.from(
      document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
    ) as HTMLLinkElement[];

    const ensureOne = () => {
      const l = document.createElement("link");
      l.rel = "icon";
      head.appendChild(l);
      return [l];
    };

    const targets = links.length ? links : ensureOne();

    const bust = `v=${Date.now()}`;
    const nextHref = href.includes("?") ? `${href}&${bust}` : `${href}?${bust}`;

    targets.forEach((l) => {
      if (type) l.type = type;
      l.href = nextHref;
    });
  } catch {
    // ignore
  }
}

export function setFaviconPersisted(url: string) {
  const u = String(url || "").trim();
  if (!u) return;

  try {
    localStorage.setItem("TPTECH_FAVICON_URL", u);
  } catch {}

  applyFavicon(u, "image/png");
}

/**
 * ✅ Favicon default: INICIALES (cuando no hay logo)
 * - limpia TPTECH_FAVICON_URL para que no reaparezca el logo viejo
 */
export function setFaviconInitials(nameOrInitials: string) {
  const raw = String(nameOrInitials || "").trim();
  const initials = raw.length <= 3 ? raw.toUpperCase() : getInitials(raw);

  // SVG simple: iniciales negras en fondo blanco (se ve perfecto en tabs)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#ffffff"/>
  <text x="50%" y="56%" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="26" font-weight="900" fill="#000000">${initials}</text>
</svg>`.trim();

  const href = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

  try {
    localStorage.removeItem("TPTECH_FAVICON_URL");
  } catch {}

  applyFavicon(href, "image/svg+xml");
}
