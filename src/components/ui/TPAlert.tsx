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
  const toneCls =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : tone === "warning"
      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
      : tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : tone === "info"
      ? "border-primary/30 bg-primary/10 text-text"
      : "border-border bg-surface2 text-text";

  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm", toneCls, className)}>
      {title ? <div className="mb-1 font-semibold">{title}</div> : null}
      <div className="text-text/90">{children}</div>
    </div>
  );
}

export default TPAlert;