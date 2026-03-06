// src/components/ui/TPAlert.tsx
import React from "react";
import { cn } from "./tp";

type Tone = "danger" | "warning" | "info" | "success" | "neutral";

export function TPAlert({
  tone = "neutral",
  children,
  title,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  // ✅ Ajuste: warning/success/danger en modo "suave" (background claro) => texto oscuro
  // Si en algún momento querés alerts "sólidos" (con texto blanco), hacemos una prop variant="solid".
  const toneCls =
    tone === "danger"
      ? "border-red-500/35 bg-red-500/10 text-text"
      : tone === "warning"
      ? "border-yellow-500/35 bg-yellow-500/10 text-text"
      : tone === "success"
      ? "border-emerald-500/35 bg-emerald-500/10 text-text"
      : tone === "info"
      ? "border-primary/35 bg-primary/10 text-text"
      : "border-border bg-surface2 text-text";

  const bodyTextCls =
    tone === "neutral" || tone === "info"
      ? "text-text/90"
      : // ✅ danger/warning/success ahora también usan texto oscuro
        "text-text/90";

  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm", toneCls, className)}>
      {title ? <div className="mb-1 font-semibold text-text">{title}</div> : null}

      <div className={cn(bodyTextCls)}>{children}</div>
    </div>
  );
}

export default TPAlert;