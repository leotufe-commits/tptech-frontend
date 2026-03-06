// tptech-frontend/src/pages/configuracion-sistema/systemUiCatalog.ui.tsx
import React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type TokenItem = { key: string; cssVar: string; value: string };

export function TokenChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div
          className="h-5 w-5 rounded-md border border-border"
          style={{ background: value || "transparent" }}
          title={value}
        />
        <div className="text-xs font-semibold text-text break-all">{value || "\u2014"}</div>
      </div>
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
      {children}
    </span>
  );
}

export function DemoButton({
  children,
  variant = "primary",
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground border-primary/30 hover:opacity-95"
      : variant === "danger"
      ? "bg-red-500/10 text-red-200 border-red-500/30 hover:bg-red-500/15"
      : "bg-card text-text border-border hover:bg-surface2";

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl border px-4 text-sm font-semibold transition",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.05)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        disabled && "opacity-60 cursor-not-allowed",
        cls
      )}
    >
      {children}
    </button>
  );
}

export function DemoInput({ placeholder }: { placeholder: string }) {
  return (
    <input
      placeholder={placeholder}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-text",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      )}
    />
  );
}

export function codeBox(lines: string[]) {
  return (
    <pre className="rounded-2xl border border-border bg-card p-3 text-xs text-muted overflow-auto">
      <code>{lines.join("\n")}</code>
    </pre>
  );
}

export function Block({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-text">{title}</div>
        <Pill>real</Pill>
      </div>
      {desc ? <div className="text-sm text-muted mt-1">{desc}</div> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
