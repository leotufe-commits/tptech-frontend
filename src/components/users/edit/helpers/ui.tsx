// tptech-frontend/src/components/users/edit/helpers/ui.tsx
import React from "react";
import { AlertTriangle } from "lucide-react";

import EyeIcon from "../../../EyeIcon";
import { cn } from "../../users.ui";

/* =========================
   CARD SIMPLE
========================= */
export function TPCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("tp-card", className)}>{children}</div>;
}

/* =========================
   NOTICE (info / danger)
========================= */
export function TPNotice({
  tone,
  title,
  children,
  className,
}: {
  tone?: "info" | "danger";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isDanger = tone === "danger";

  return (
    <div
      className={cn("tp-card p-3 text-sm flex gap-3 items-start", className)}
      style={{
        border: isDanger
          ? "1px solid color-mix(in oklab, #ef4444 20%, var(--border))"
          : "1px solid color-mix(in oklab, var(--primary) 22%, var(--border))",
        background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
      }}
    >
      <AlertTriangle className={cn("h-4 w-4 mt-0.5", isDanger ? "text-red-400" : "text-primary")} />
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className="text-xs text-muted">{children}</div>
      </div>
    </div>
  );
}

/* =========================
   INPUT CON OJO (password)
========================= */
export function InputWithEye({
  value,
  onChange,
  placeholder,
  disabled,
  inputMode,
  maxLength,
  onlyDigits,
  show,
  setShow,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onlyDigits?: boolean;
  show: boolean;
  setShow: (v: boolean) => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        className="tp-input pr-10"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => {
          let next = e.target.value;
          if (onlyDigits) next = next.replace(/\D/g, "");
          if (typeof maxLength === "number") next = next.slice(0, maxLength);
          onChange(next);
        }}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete ?? "off"}
        spellCheck={false}
      />

      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
        aria-label={show ? "Ocultar" : "Mostrar"}
        title={show ? "Ocultar" : "Mostrar"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

/* =========================
   PIN MSG FILTER
========================= */
export function shouldHidePinMsg(msg?: string | null) {
  const m = String(msg || "").toLowerCase();
  if (!m) return true;
  return m.includes("sesión expirada") || m.includes("sesion expirada");
}
