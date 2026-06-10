// src/components/sales/TPBalanceModeSelector.tsx
// =============================================================================
// Selector de Balance Mode Override.
// Etapa UX 2.1 (2026-06) — SEPARACIÓN de conceptos:
//   · El SWITCH representa ÚNICAMENTE el modo (los dos estados funcionales).
//       [ Unificado | Desglosado ]
//   · El ORIGEN de la resolución vive en una línea de texto APARTE, siempre
//       visible (no en tooltip):
//       Origen: Cliente | Lista de precios | Preferencia usuario | Sistema | Manual
//   · Cuando hay override manual, junto al origen aparece un link discreto
//       "Volver a automático" (Opción B aprobada) — sin chips ni indicadores
//       extra dentro del switch.
//
// Compromisos (sin cambios respecto a iteraciones previas):
//   · READ-ONLY sobre el resolver: el frontend NUNCA decide qué modo aplica.
//     Lee `effectiveMode` + `source` del preview y emite la INTENCIÓN via
//     `onOverrideChange(...)`. Click en segmento → override manual del modo;
//     link "Volver a automático" → `onOverrideChange(null)`.
//   · NO recalcula. NO formatea montos. NO toca breakdown.
// =============================================================================

import type { ReactElement } from "react";
import { useCallback } from "react";

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

// Vocabulario de ORIGEN alineado con la jerarquía R11.4 (CLAUDE.md):
//   override doc → cliente → preferencia usuario → lista → tenant → fallback.
const SOURCE_LABEL: Record<string, string> = {
  DOCUMENT_OVERRIDE:  "Manual",
  ENTITY_DEFAULT:     "Cliente",
  USER_PREFERENCE:    "Preferencia usuario",
  PRICELIST_DEFAULT:  "Lista de precios",
  TENANT_DEFAULT:     "Sistema",
  FALLBACK_UNIFIED:   "Sistema (por defecto)",
};

function sourceLabel(source?: string): string {
  if (!source) return "—";
  return SOURCE_LABEL[source] ?? source;
}

const SEGMENTS: ReadonlyArray<{ mode: Mode; testId: string }> = [
  { mode: "UNIFIED",   testId: "balance-mode-segment-unified" },
  { mode: "BREAKDOWN", testId: "balance-mode-segment-breakdown" },
];

export function TPBalanceModeSelector({
  effectiveMode,
  source,
  override,
  onOverrideChange,
  disabled,
  className,
}: TPBalanceModeSelectorProps): ReactElement | null {
  const handleSelect = useCallback(
    (next: Mode | null) => {
      if (disabled) return;
      onOverrideChange(next);
    },
    [onOverrideChange, disabled],
  );

  // Sin modo efectivo todavía (primer preview no llegó) — no renderizamos.
  if (!effectiveMode) return null;

  const isManualOverride = override === "UNIFIED" || override === "BREAKDOWN";
  // Regla 2.1: un override explícito SIEMPRE se comunica como "Manual",
  // independientemente del `source` que devuelva el backend en ese ciclo.
  const originText = isManualOverride ? "Manual" : sourceLabel(source);

  return (
    <div
      className={`inline-flex flex-col items-end gap-0.5 ${className ?? ""}`}
      data-testid="balance-mode-selector"
    >
      {/* SWITCH — solo el modo (los dos estados funcionales). */}
      <div
        role="group"
        aria-label="Modo de saldo"
        className={`inline-flex rounded-full bg-muted/15 p-0.5 ${disabled ? "opacity-60" : ""}`}
        data-testid="balance-mode-selector-badge"
      >
        {SEGMENTS.map(({ mode, testId }) => {
          const active = effectiveMode === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => handleSelect(mode)}
              data-testid={testId}
              data-active={active ? "true" : "false"}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              } ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-text hover:bg-muted/20"
              }`}
            >
              {MODE_LABEL[mode]}
            </button>
          );
        })}
      </div>

      {/* ORIGEN — línea de contexto separada, siempre visible. */}
      <div
        className="inline-flex items-center gap-1.5 text-[10px] leading-tight"
        data-testid="balance-mode-origin"
      >
        <span className="text-muted/70">
          Origen: <span className="font-medium text-muted">{originText}</span>
        </span>
        {/* Opción B — link discreto, SOLO cuando hay override manual. */}
        {isManualOverride && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(null)}
            data-testid="balance-mode-reset"
            className={`underline-offset-2 transition-colors ${
              disabled
                ? "text-muted/40 cursor-not-allowed"
                : "text-primary/80 hover:text-primary hover:underline cursor-pointer"
            }`}
            title="Volver a la resolución automática del modo de saldo"
          >
            Volver a automático
          </button>
        )}
      </div>
    </div>
  );
}

export default TPBalanceModeSelector;
