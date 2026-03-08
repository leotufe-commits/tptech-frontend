import React, { useEffect, useRef } from "react";
import { cn } from "./tp";

type TPCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "checked" | "onChange" | "type" | "children" | "dangerouslySetInnerHTML"
> & {
  checked: boolean;
  onChange: (v: boolean) => void;
  indeterminate?: boolean;
  label?: React.ReactNode;
  className?: string;

  // blindaje extra (por si alguien intenta pasarlos)
  children?: never;
  dangerouslySetInnerHTML?: never;
};

export function TPCheckbox({
  checked,
  onChange,
  indeterminate,
  disabled,
  label,
  className,

  // ✅ tragamos estos props para que JAMÁS lleguen al <input />
  children,
  dangerouslySetInnerHTML,

  ...rest
}: TPCheckboxProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const isOn = checked || Boolean(indeterminate);

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {/* Input nativo oculto — mantiene accesibilidad y submit de formularios */}
      <input
        ref={ref}
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />

      {/* Visual custom — usa colores del theme, sin depender del browser nativo */}
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          isOn ? "border-primary bg-primary" : "border-border bg-card"
        )}
        aria-hidden="true"
      >
        {indeterminate ? (
          // guión para estado indeterminado
          <span
            className="block h-px w-2.5"
            style={{ backgroundColor: "var(--primary-foreground)" }}
          />
        ) : checked ? (
          // tilde con color del theme (primary-foreground)
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path
              d="M1 4l2.5 2.5L9 1"
              stroke="var(--primary-foreground)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>

      {label}
    </label>
  );
}

export default TPCheckbox;
