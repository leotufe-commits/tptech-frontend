// src/components/ui/TPCard.tsx
import React from "react";
import { cn } from "./tp";

export function TPCard({
  title,
  right,
  children,
  className,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface2 p-4", className)}>
      {title || right ? (
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-text">{title}</div>
          {right ? <div className="text-xs text-muted">{right}</div> : null}
        </div>
      ) : null}
      <div className={cn(title || right ? "mt-3" : "")}>{children}</div>
    </div>
  );
}