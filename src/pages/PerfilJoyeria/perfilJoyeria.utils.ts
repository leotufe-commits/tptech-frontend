// src/pages/PerfilJoyeria/perfilJoyeria.utils.ts
import type { CatalogItem } from "../../services/catalogs";
import type { CompanyBody, EmailConfigBody, ExistingBody, UpdatePayload } from "./perfilJoyeria.types";

/* =========================
   Small helpers
========================= */

const s = (v: any) => String(v ?? "").trim();

export function onlyDigits(v: string) {
  return String(v ?? "").replace(/[^\d]/g, "");
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function cardBase(extra?: string) {
  return cn("tp-card rounded-2xl border border-border bg-card", extra);
}

export function valueOrDash(v: any) {
  const out = s(v);
  return out ? out : "—";
}

export function safeFileLabel(name: string) {
  return s(name) || "Archivo";
}

export function formatBytes(bytes: number) {
  const n0 = Number(bytes);
  if (!Number.isFinite(n0) || n0 < 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = n0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(v?: string | Date | null) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================
   URLs
========================= */

function apiBase() {
  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  return base.replace(/\/+$/, "");
}

export function absUrl(u: string) {
  const raw = s(u);
  if (!raw) return "";

  // absoluta (R2/CDN o backend explícito)
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = apiBase();

  // local guardado ya con /uploads/...
  if (raw.startsWith("/uploads/")) {
    return `${base}${raw}`;
  }

  // local guardado con uploads/... (sin slash inicial)
  if (raw.startsWith("uploads/")) {
    return `${base}/${raw}`;
  }

  // path interno de storage local/R2 persistido en DB
  return `${base}/uploads/${raw.replace(/^\/+/, "")}`;
}

/* =========================
   Draft + payload
========================= */

export function jewelryToDraft(j: any): { existing: ExistingBody; company: CompanyBody; emailConfig: EmailConfigBody } {
  return {
    existing: {
      name: s(j?.name),
      phoneCountry: s(j?.phoneCountry),
      phoneNumber: s(j?.phoneNumber),
      street: s(j?.street),
      number: s(j?.number),
      floor: s(j?.floor),
      apartment: s(j?.apartment),
      city: s(j?.city),
      province: s(j?.province),
      postalCode: s(j?.postalCode),
      country: s(j?.country),
    },
    company: {
      logoUrl: s(j?.logoUrl),
      legalName: s(j?.legalName),
      cuit: s(j?.cuit),
      ivaCondition: s(j?.ivaCondition),
      email: s(j?.email),
      website: s(j?.website),
      notes: String(j?.notes ?? ""),
    },
    emailConfig: {
      emailEnabled:       Boolean(j?.emailEnabled ?? true),
      emailSenderName:    s(j?.emailSenderName),
      emailLogoUrl:       s(j?.emailLogoUrl),
      emailSignature:     String(j?.emailSignature ?? ""),
      emailReplyTo:       s(j?.emailReplyTo),
      emailContact:       s(j?.emailContact),
      emailPhone:         s(j?.emailPhone),
      emailWhatsapp:      s(j?.emailWhatsapp),
      emailAddressLine:   s(j?.emailAddressLine),
      emailBusinessHours: s(j?.emailBusinessHours),
      emailWebsite:       s(j?.emailWebsite),
      emailInstagram:     s(j?.emailInstagram),
      emailFooter:        String(j?.emailFooter ?? ""),
    },
  };
}

export function buildPayload(existing: ExistingBody, company: CompanyBody, emailConfig: EmailConfigBody): UpdatePayload {
  return {
    ...existing,
    logoUrl:      s(company.logoUrl),
    legalName:    s(company.legalName),
    cuit:         s(company.cuit),
    ivaCondition: s(company.ivaCondition),
    email:        s(company.email),
    website:      s(company.website),
    notes:        String(company.notes ?? ""),
    // Email branding
    emailEnabled:       emailConfig.emailEnabled,
    emailSenderName:    s(emailConfig.emailSenderName),
    emailLogoUrl:       s(emailConfig.emailLogoUrl),
    emailSignature:     String(emailConfig.emailSignature ?? ""),
    emailReplyTo:       s(emailConfig.emailReplyTo),
    emailContact:       s(emailConfig.emailContact),
    emailPhone:         s(emailConfig.emailPhone),
    emailWhatsapp:      s(emailConfig.emailWhatsapp),
    emailAddressLine:   s(emailConfig.emailAddressLine),
    emailBusinessHours: s(emailConfig.emailBusinessHours),
    emailWebsite:       s(emailConfig.emailWebsite),
    emailInstagram:     s(emailConfig.emailInstagram),
    emailFooter:        String(emailConfig.emailFooter ?? ""),
  };
}

export function pickFavoriteLabel(items: CatalogItem[]) {
  const fav = (items || []).find((x) => Boolean(x?.isFavorite));
  return s(fav?.label);
}

/* =========================
   Hook expects
========================= */

export function devLog(...args: any[]) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

export function getInitials(name: string) {
  const t = s(name);
  if (!t) return "TP";
  const parts = t.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).trim() || "TP";
}

export function pickJewelryFromMe(me: any) {
  if (!me || typeof me !== "object") return null;
  return (
    (me as any).jewelry ??
    (me as any).Jewelry ??
    (me as any).company ??
    (me as any).Company ??
    (me as any)?.data?.jewelry ??
    (me as any)?.data?.company ??
    null
  );
}

export function normalizeJewelryResponse(resp: any) {
  const j = resp?.jewelry ?? resp?.company ?? resp?.data?.jewelry ?? resp?.data?.company ?? resp;
  if (!j || typeof j !== "object") return j;

  const attachments = Array.isArray((j as any).attachments) ? (j as any).attachments : [];
  return { ...(j as any), attachments };
}

/* =========================
   Favicon helpers
========================= */

function applyFavicon(href: string, type?: string) {
  try {
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    const links = Array.from(
      document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
    ) as HTMLLinkElement[];

    const targets =
      links.length > 0
        ? links
        : (() => {
            const l = document.createElement("link");
            l.rel = "icon";
            head.appendChild(l);
            return [l];
          })();

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
  const u = s(url);
  if (!u) return;

  try {
    localStorage.setItem("TPTECH_FAVICON_URL", u);
  } catch {}

  applyFavicon(absUrl(u), "image/png");
}

/**
 * ✅ Favicon default: INICIALES (cuando no hay logo)
 * - limpia TPTECH_FAVICON_URL para que no reaparezca el logo viejo
 */
export function setFaviconInitials(nameOrInitials: string) {
  const raw = s(nameOrInitials);
  const initials = raw.length <= 3 ? raw.toUpperCase() : getInitials(raw);

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