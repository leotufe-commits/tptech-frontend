// src/components/sales/TPBalanceModeSelector.tsx
// =============================================================================
// T60 (Fase 4.2) — Selector visual de Balance Mode Override.
//
// Compromisos:
//   · READ-ONLY sobre el resolver: el frontend NUNCA decide qué modo aplica.
//     Solo lee `balanceMode` + `balanceModeSource` del preview del backend y
//     emite la INTENCIÓN del operador via `onOverrideChange(...)`.
//   · El cambio del override modifica `draft.balanceModeOverride` →
//     `previewSignature` cambia → se dispara un nuevo `salesApi.preview` →
//     el backend resuelve y devuelve el modo efectivo.
//   · Si `override === null`, vuelve a resolución automática (jerarquía
//     R11.4 del backend: cliente → lista → tenant → fallback UNIFIED).
//   · NO recalcula. NO formatea montos. NO toca breakdown.
//
// Visual:
//   ┌─────────────────────────────────┐
//   │ Saldo: DESGLOSADO  [▼]         │   ← badge clickeable
//   └─────────────────────────────────┘
//   on click → popover:
//     ○ Automático  (origen: Cliente)
//     ○ Unificado
//     ● Desglosado
// =============================================================================

import type { ReactElement } from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { vt } from "../../lib/pricing/visualTokens";

type Mode = "UNIFIED" | "BREAKDOWN";

export interface TPBalanceModeSelectorProps {
  /** Modo efectivo resuelto por el backend en el preview (display). */
  effectiveMode?: Mode;
  /** Origen resuelto por el backend (DOCUMENT_OVERRIDE / ENTITY_DEFAULT / ...). */
  source?: string;
  /** Override que el operador ya seteó en el draft (si existe). null/undefined
   *  significa "Automático" — el backend resuelve por jerarquía. */
  override?: Mode | null;
  /** Callback cuando el operador cambia el override. `null` vuelve a
   *  resolución automática (limpia el override en el draft). */
  onOverrideChange: (next: Mode | null) => void;
  /** Si está deshabilitado (ej. venta confirmada). Default false. */
  disabled?: boolean;
  /** Clase CSS adicional para el contenedor. */
  className?: string;
}

const MODE_LABEL: Record<Mode, string> = {
  UNIFIED:   "Unificado",
  BREAKDOWN: "Desglosado",
};

const SOURCE_LABEL: Record<string, string> = {
  DOCUMENT_OVERRIDE:  "Manual del documento",
  ENTITY_DEFAULT:     "Cliente",
  PRICELIST_DEFAULT:  "Lista de precios",
  TENANT_DEFAULT:     "Configuración del tenant",
  FALLBACK_UNIFIED:   "Por defecto",
};

function sourceLabel(source?: string): string {
  if (!source) return "";
  return SOURCE_LABEL[source] ?? source;
}

export function TPBalanceModeSelector({
  effectiveMode,
  source,
  override,
  onOverrideChange,
  disabled,
  className,
}: TPBalanceModeSelectorProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar el popover al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (next: Mode | null) => {
      onOverrideChange(next);
      setOpen(false);
    },
    [onOverrideChange],
  );

  // Sin modo efectivo todavía (primer preview no llegó) — no renderizamos.
  if (!effectiveMode) return null;

  const isManualOverride = override === "UNIFIED" || override === "BREAKDOWN";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className ?? ""}`}
      data-testid="balance-mode-selector"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          disabled
            ? "opacity-60 cursor-not-allowed text-muted"
            : "text-muted hover:text-foreground hover:bg-muted/15 cursor-pointer"
        }`}
        data-testid="balance-mode-selector-badge"
        title={
          source
            ? `Origen: ${sourceLabel(source)}${isManualOverride ? " (override manual)" : ""}`
            : undefined
        }
      >
        <span className="text-[10px] uppercase tracking-wider text-muted/80">
          Modo de saldo
        </span>
        <span className="text-text font-semibold">
          {MODE_LABEL[effectiveMode]}
        </span>
        {isManualOverride && (
          <span
            className="ml-0.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-primary"
            data-testid="balance-mode-override-tag"
          >
            Manual
          </span>
        )}
        <span aria-hidden className="ml-0.5 text-[10px] text-muted/70">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-border bg-background p-1 shadow-md"
          data-testid="balance-mode-selector-menu"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!isManualOverride}
            onClick={() => handleSelect(null)}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-muted/40"
            data-testid="balance-mode-option-auto"
          >
            <span>
              <span className={!isManualOverride ? "font-semibold" : ""}>
                Automático
              </span>
              {source && (
                <span className="ml-1 text-muted-foreground">
                  · {sourceLabel(source)}
                </span>
              )}
            </span>
            {!isManualOverride && <span aria-hidden>●</span>}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={override === "UNIFIED"}
            onClick={() => handleSelect("UNIFIED")}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-muted/40"
            data-testid="balance-mode-option-unified"
          >
            <span className={override === "UNIFIED" ? "font-semibold" : ""}>
              Unificado
            </span>
            {override === "UNIFIED" && <span aria-hidden>●</span>}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={override === "BREAKDOWN"}
            onClick={() => handleSelect("BREAKDOWN")}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-muted/40"
            data-testid="balance-mode-option-breakdown"
          >
            <span className={override === "BREAKDOWN" ? "font-semibold" : ""}>
              Desglosado
            </span>
            {override === "BREAKDOWN" && <span aria-hidden>●</span>}
          </button>
        </div>
      )}
    </div>
  );
}

export default TPBalanceModeSelector;
