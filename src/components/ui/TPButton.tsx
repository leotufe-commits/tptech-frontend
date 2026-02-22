// src/components/ui/TPButton.tsx
import React from "react";
import { Loader2 } from "lucide-react";
import {
  cn,
  TP_BTN_PRIMARY,
  TP_BTN_SECONDARY,
  TP_BTN_GHOST,
  TP_BTN_DANGER,
  TP_BTN_LINK_PRIMARY,
} from "./tp";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "linkPrimary";

function variantCls(v: Variant) {
  if (v === "secondary") return TP_BTN_SECONDARY;
  if (v === "ghost") return TP_BTN_GHOST;
  if (v === "danger") return TP_BTN_DANGER;
  if (v === "linkPrimary") return TP_BTN_LINK_PRIMARY;
  return TP_BTN_PRIMARY;
}

export function TPButton({
  children,
  variant = "primary",
  loading,
  iconLeft,
  iconRight,
  className,
  disabled,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(variantCls(variant), "inline-flex items-center justify-center gap-2", className)}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : iconLeft}
      <span className="leading-none">{children}</span>
      {iconRight}
    </button>
  );
}