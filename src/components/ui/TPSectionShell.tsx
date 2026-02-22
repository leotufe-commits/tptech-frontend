import React from "react";
import { cn } from "./tp";
import { TPCard } from "./TPCard";

export function TPSectionShell({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TPCard className={cn("p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <div className="text-sm font-semibold text-text">{title}</div>
      </div>
      {children}
    </TPCard>
  );
}

export default TPSectionShell;