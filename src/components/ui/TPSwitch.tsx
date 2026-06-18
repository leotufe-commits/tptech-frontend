import React from "react";
import { cn } from "./tp";

type TPSwitchProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Etiqueta accesible — el switch no muestra texto propio. */
  ariaLabel?: string;
  className?: string;
};

/**
 * Toggle tipo "switch" (riel + perilla deslizante). Más expresivo que un
 * checkbox para estados activar/desactivar prominentes.
 *
 * Bajo el capó usa un `<input type="checkbox">` nativo (no se sobreescribe el
 * `role`), por lo que mantiene accesibilidad, soporte de teclado y submit de
 * formularios — y sigue siendo encontrable como `role="checkbox"` en los tests.
 * Mismo patrón de input oculto superpuesto que `TPCheckbox`.
 */
export function TPSwitch({ checked, onChange, disabled, ariaLabel, className }: TPSwitchProps) {
  return (
    <label
      className={cn(
        "relative inline-flex cursor-pointer items-center",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        className="absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors",
          checked ? "border-primary bg-primary" : "border-border bg-surface2",
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
          style={{
            backgroundColor: checked ? "var(--primary-foreground)" : "var(--card)",
          }}
        />
      </span>
    </label>
  );
}

export default TPSwitch;
