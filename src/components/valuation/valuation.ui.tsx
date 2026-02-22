// src/components/valuation/valuation.ui.tsx
import React from "react";

import { Modal } from "../ui/Modal";
import { cn as cnBase, TP_INPUT, TP_SELECT } from "../ui/tp";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

/* =========================
   UI: Pill
========================= */
export function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "off" | "info";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "off"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : tone === "info"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border bg-surface2 text-muted";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        cls
      )}
    >
      {children}
    </span>
  );
}

/* =========================
   UI: Input (wrapper)
   ✅ usa TP_INPUT del sistema
========================= */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(TP_INPUT, className)} />;
}

/* =========================
   UI: Select (wrapper)
   ✅ usa TP_SELECT del sistema
========================= */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className={cn(TP_SELECT, className)}>
      {children}
    </select>
  );
}

/* =========================
   UI: ModalShell
========================= */
export type ModalMaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl";

export function ModalShell({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  busy,
  wide,
  maxWidth,
  hideHeaderClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  busy?: boolean;
  wide?: boolean;

  maxWidth?: ModalMaxWidth;
  hideHeaderClose?: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      busy={busy}
      wide={wide}
      maxWidth={maxWidth}
      hideHeaderClose={hideHeaderClose}
      bodyClassName="!pt-2"
      footer={
        footer ? (
          <>
            {subtitle ? (
              <div className={cnBase("mr-auto text-xs text-muted")}>{subtitle}</div>
            ) : (
              <div className="mr-auto" />
            )}
            {footer}
          </>
        ) : subtitle ? (
          <div className={cnBase("mr-auto text-xs text-muted")}>{subtitle}</div>
        ) : undefined
      }
      footerClassName="!justify-between"
    >
      {children}
    </Modal>
  );
}
