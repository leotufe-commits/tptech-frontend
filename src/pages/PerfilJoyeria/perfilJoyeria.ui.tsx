// src/pages/PerfilJoyeria/perfilJoyeria.ui.tsx
import React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function valueOrDash(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function cardBase(extra?: string) {
  return cn("tp-card rounded-2xl border border-border bg-card", extra);
}

export function SectionShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cardBase("p-4")}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-[color:var(--muted)]">{label}</label>
      {children}
    </div>
  );
}

export function InfoCard({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: any;
}) {
  return (
    <div className={cn("tp-card rounded-2xl border border-border bg-card p-3")}>
      <div className="text-xs text-muted mb-1 flex items-center gap-2">
        {icon}
        {label}
      </div>
      <div className="font-semibold">{valueOrDash(value)}</div>
    </div>
  );
}
