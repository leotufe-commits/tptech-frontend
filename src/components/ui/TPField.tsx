// src/components/ui/TPField.tsx
import React from "react";
import { cn } from "./tp";

export function TPField({
  label,
  hint,
  error,
  required,
  children,
  className,
  labelRight,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  labelRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {(label || labelRight) ? (
        <div className="flex items-end justify-between gap-3">
          {label ? (
            <div className="text-xs font-semibold text-muted">
              {label}
              {required ? <span className="text-red-400"> *</span> : null}
            </div>
          ) : (
            <div />
          )}

          {labelRight ? <div className="text-xs text-muted">{labelRight}</div> : null}
        </div>
      ) : null}

      {children}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-text">
          {error}
        </div>
      ) : hint ? (
        <div className="text-xs text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

export default TPField;