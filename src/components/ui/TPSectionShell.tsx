// tptech-frontend/src/components/ui/TPSectionShell.tsx
import React from "react";
import { cn } from "./tp";

export type TPSectionShellProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function TPSectionShell({
  title,
  description,
  icon,
  children,
  className,
}: TPSectionShellProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {icon ? <div className="text-muted">{icon}</div> : null}
            <h1 className="text-2xl font-semibold text-text">{title}</h1>
          </div>

          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
      </div>

      {children}
    </div>
  );
}

export default TPSectionShell;