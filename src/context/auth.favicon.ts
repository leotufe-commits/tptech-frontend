// tptech-frontend/src/context/auth.favicon.ts
// Funciones para manejar el favicon/icono del navegador según el estado de sesión.

function toDataUri(svg: string) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function ensureIconLink(): HTMLLinkElement {
  const head = document.head || document.getElementsByTagName("head")[0];
  let link =
    (head.querySelector("link[rel='icon']") as HTMLLinkElement | null) ||
    (head.querySelector("link[rel='shortcut icon']") as HTMLLinkElement | null);

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    head.appendChild(link);
  }
  return link;
}

function buildSvgTextBadge(opts: {
  text: string;
  bg: string;
  fg?: string;
  rx?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
}) {
  const text = (opts.text || "").trim();
  const bg = opts.bg || "#0b0b0d";
  const fg = opts.fg || "#ffffff";
  const rx = typeof opts.rx === "number" ? opts.rx : 18;
  const fontSize = typeof opts.fontSize === "number" ? opts.fontSize : 26;
  const fontWeight = typeof opts.fontWeight === "number" ? opts.fontWeight : 800;
  const letterSpacing = typeof opts.letterSpacing === "number" ? opts.letterSpacing : -1.2;

  return (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
    "<rect width='64' height='64' rx='" +
    rx +
    "' fill='" +
    bg +
    "'/>" +
    "<text x='32' y='40' text-anchor='middle' " +
    "font-family='system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' " +
    "font-size='" +
    fontSize +
    "' font-weight='" +
    fontWeight +
    "' letter-spacing='" +
    letterSpacing +
    "' fill='" +
    fg +
    "'>" +
    text +
    "</text>" +
    "</svg>"
  );
}

function buildPublicTptFaviconSvg() {
  return buildSvgTextBadge({
    text: "TPT",
    bg: "#0b0b0d",
    fg: "#ffffff",
    rx: 18,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -1.2,
  });
}

function setFaviconHref(href: string, type?: string) {
  try {
    const link = ensureIconLink();
    // Agrega cache-buster solo a URLs reales (no a data-uris)
    const finalHref = href.startsWith("data:") ? href : `${href}${href.includes("?") ? "&" : "?"}v=${Date.now()}`;
    link.setAttribute("href", finalHref);
    if (type) link.setAttribute("type", type);
    else link.removeAttribute("type");
  } catch {
    // ignore
  }
}

function normalizeLogoUrl(u: any): string {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const clean = String(base).replace(/\/+$/, "");
  const origin = clean.replace(/\/api$/i, "");

  if (raw.startsWith("/")) return origin + raw;
  return origin + "/" + raw;
}

function initialsFromName(name: string): string {
  const s = String(name || "").trim();
  if (!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[1]?.[0] || "" : parts[0]?.[1] || "";
  const out = (a + b).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return out.slice(0, 2) || "";
}

/**
 * Aplica el favicon según el estado de sesión.
 * - Sin usuario: favicon TPT negro (login page)
 * - Con usuario: logo de joyería o iniciales
 * - Durante loading: no tocar (evita parpadeo)
 */
export function applyAppFavicon(args: { user?: any; jewelry?: any; loading?: boolean }) {
  try {
    if (args.loading) return;

    const j = args.jewelry || null;
    const u = args.user || null;

    if (!u) {
      setFaviconHref(toDataUri(buildPublicTptFaviconSvg()), "image/svg+xml");
      return;
    }

    const logoUrl = normalizeLogoUrl(j?.logoUrl);
    if (logoUrl) {
      setFaviconHref(logoUrl);
      return;
    }

    const nameSource =
      String(j?.name || "").trim() ||
      String(u?.name || "").trim() ||
      String(u?.email || "").trim();

    const initials = initialsFromName(nameSource) || "TP";
    const svg = buildSvgTextBadge({
      text: initials,
      bg: "#0b0b0d",
      fg: "#ffffff",
      rx: 18,
      fontSize: 28,
      fontWeight: 900,
      letterSpacing: -1.1,
    });
    setFaviconHref(toDataUri(svg), "image/svg+xml");
  } catch {
    // ignore
  }
}

/** Aplica el favicon cuando cambia el logo de la joyería (evento en tiempo real). */
export function applyAuthFaviconOverrideLogo(args: { user: any; jewelry: any; logoUrl: string }) {
  const u = args.user;
  const j = args.jewelry;
  const raw = String(args.logoUrl || "").trim();
  const normalized = normalizeLogoUrl(raw);

  if (normalized) {
    try {
      localStorage.setItem("TPTECH_FAVICON_URL", normalized);
    } catch {}
    setFaviconHref(normalized);
    return;
  }

  try {
    localStorage.removeItem("TPTECH_FAVICON_URL");
  } catch {}

  const nameSource =
    String(j?.name || "").trim() ||
    String(u?.name || "").trim() ||
    String(u?.email || "").trim();

  const initials = initialsFromName(nameSource) || "TP";
  const svg = buildSvgTextBadge({
    text: initials,
    bg: "#0b0b0d",
    fg: "#ffffff",
    rx: 18,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: -1.1,
  });
  setFaviconHref(toDataUri(svg), "image/svg+xml");
}
