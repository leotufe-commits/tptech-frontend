// src/components/ui/TPCollapse.tsx
import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./tp";

export function TPCollapse({
  open,
  onToggle,
  disabled,
  iconLeft,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "w-full rounded-xl border border-border bg-card px-3 py-2 text-left transition",
          "hover:bg-surface disabled:opacity-50"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {iconLeft ? <span className="text-muted">{iconLeft}</span> : null}
            <div className="text-sm font-semibold text-text">{title}</div>
          </div>

          {open ? (
            <ChevronUp size={16} className="text-muted" />
          ) : (
            <ChevronDown size={16} className="text-muted" />
          )}
        </div>

        {description ? (
          <div className="mt-1 text-xs text-muted">{description}</div>
        ) : null}
      </button>

      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export default TPCollapse;