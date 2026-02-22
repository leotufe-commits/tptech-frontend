import React from "react";
import { cn } from "./tp";
import { TPCard } from "./TPCard";

function valueOrDash(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

export function TPInfoCard({
  icon,
  label,
  value,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: any;
  className?: string;
}) {
  return (
    <TPCard className={cn("p-3", className)}>
      <div className="text-xs text-muted mb-1 flex items-center gap-2">
        {icon ? <span className="text-muted">{icon}</span> : null}
        {label}
      </div>
      <div className="font-semibold text-text">{valueOrDash(value)}</div>
    </TPCard>
  );
}

export default TPInfoCard;