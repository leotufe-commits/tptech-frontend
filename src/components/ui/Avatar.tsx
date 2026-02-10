import { useEffect, useMemo, useState } from "react";

/* utils locales (no dependemos de Sidebar) */
function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const clean = String(base).replace(/\/+$/, "");

  // ✅ si VITE_API_URL termina en /api, lo sacamos para construir assets (/uploads)
  const origin = clean.replace(/\/api$/i, "");

  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return `${origin}${p}`;
}

function getInitials(name?: string, email?: string) {
  const base = String(name || email || "").trim();
  if (!base) return "TP";

  const parts = base.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "T";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "P";
  return (a + b).toUpperCase();
}

type Props = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;          // px
  className?: string;     // wrapper
  imgClassName?: string;  // <img>
  rounded?: "full" | "xl";
  bust?: string | number; // cache bust opcional
};

export default function Avatar({
  src,
  name,
  email,
  size = 40,
  className,
  imgClassName,
  rounded = "full",
  bust,
}: Props) {
  const [failed, setFailed] = useState(false);

  // ✅ si cambia el src, reintentamos cargar (evita "failed pegado")
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const base = useMemo(() => absUrl(src || ""), [src]);

  const finalSrc = useMemo(() => {
    if (!base || failed) return "";
    const v = bust != null && String(bust).trim() ? String(bust) : "1";
    return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
  }, [base, bust, failed]);

  const initials = useMemo(() => getInitials(name || undefined, email || undefined), [name, email]);

  const radius = rounded === "full" ? "rounded-full" : "rounded-xl";

  return (
    <div
      className={`grid place-items-center overflow-hidden border border-border bg-card ${radius} ${className || ""}`}
      style={{ width: size, height: size }}
    >
      {finalSrc ? (
        <img
          src={finalSrc}
          alt="Avatar"
          className={`h-full w-full object-cover ${imgClassName || ""}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="select-none font-bold text-primary" style={{ fontSize: size * 0.35 }}>
          {initials}
        </span>
      )}
    </div>
  );
}
