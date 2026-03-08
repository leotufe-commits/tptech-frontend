// tptech-frontend/src/components/ui/Avatar.tsx
import { useEffect, useMemo, useState } from "react";

/* utils locales */
function browserOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "";
}

function absUrl(u: string) {
  const raw = String(u || "").trim();
  if (!raw) return "";

  // previews locales / data uris
  if (/^(blob:|data:)/i.test(raw)) return raw;

  const origin = browserOrigin();

  // absoluta backend local => la pasamos por /api/uploads para usar proxy de Vite
  if (/^https?:\/\/localhost:3001\/uploads\//i.test(raw)) {
    const rel = raw.replace(/^https?:\/\/localhost:3001\/uploads\//i, "");
    return `${origin}/api/uploads/${rel}`;
  }

  // absoluta R2 / CDN / otro host
  if (/^https?:\/\//i.test(raw)) return raw;

  // ya viene proxied
  if (raw.startsWith("/api/uploads/")) return `${origin}${raw}`;
  if (raw.startsWith("api/uploads/")) return `${origin}/${raw}`;

  // local guardado como /uploads/...
  if (raw.startsWith("/uploads/")) {
    return `${origin}/api${raw}`;
  }

  // local guardado como uploads/...
  if (raw.startsWith("uploads/")) {
    return `${origin}/api/${raw}`;
  }

  // path interno persistido en DB
  return `${origin}/api/uploads/${raw.replace(/^\/+/, "")}`;
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
  size?: number;
  className?: string;
  imgClassName?: string;
  rounded?: "full" | "xl";
  bust?: string | number;
  framed?: boolean;
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
  framed = true,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src, bust]);

  const base = useMemo(() => absUrl(src || ""), [src]);

  const finalSrc = useMemo(() => {
    if (!base || failed) return "";
    if (/^(blob:|data:)/i.test(base)) return base;

    const v = bust != null && String(bust).trim() ? String(bust) : "1";
    return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
  }, [base, bust, failed]);

  const initials = useMemo(
    () => getInitials(name || undefined, email || undefined),
    [name, email]
  );

  const radius = rounded === "full" ? "rounded-full" : "rounded-xl";

  return (
    <div
      className={[
        "grid place-items-center overflow-hidden",
        radius,
        framed ? "border border-border bg-card" : "",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
    >
      {finalSrc ? (
        <img
          key={finalSrc}
          src={finalSrc}
          alt="Avatar"
          className={`h-full w-full object-cover ${imgClassName || ""}`}
          onLoad={() => setFailed(false)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="select-none font-bold text-primary"
          style={{ fontSize: size * 0.35 }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}