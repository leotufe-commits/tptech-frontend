// src/components/sales/TotalDelComprobanteCard/parts/TraceTooltipBody.tsx
// =============================================================================
// Renderer GENÉRICO de un `ComponentTrace` para el tooltip de auditoría del
// footer. Reconstruye visualmente la cuenta completa:
//
//   ORIGEN     → sourceName (+ tipo)
//   CUENTA     → Base × regla = impacto   |   pre → post
//   IMPACTO    → monto con signo
//   (ítems)    → sub-cuentas (impuestos / promociones)
//   (PARCIAL)  → aviso honesto + campo faltante
//
// Display-only. Cero matemática (los valores ya vienen calculados en el trace).
// Formato SIEMPRE vía `formatByType` (config-aware del tenant).
// =============================================================================

import type { ReactElement, ReactNode } from "react";
import { formatByType } from "../../../../lib/pricing/format";
import type { ComponentTrace, TraceRule, TraceSourceType } from "../traceability";

/** Etiqueta humana del origen institucional. */
function sourceTypeLabel(t: TraceSourceType): string {
  switch (t) {
    case "CLIENT":     return "Cliente";
    case "PRICE_LIST": return "Lista de precios";
    case "COUPON":     return "Cupón";
    case "CHANNEL":    return "Canal de venta";
    case "TENANT":     return "Configuración del comercio";
    case "MANUAL":     return "Intervención humana";
  }
}

/** Fila genérica label / valor. */
function Row({
  label,
  children,
  bold,
  muted,
}: {
  label:   string;
  children: ReactNode;
  bold?:   boolean;
  muted?:  boolean;
}): ReactElement {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${bold ? "font-semibold" : ""}`}>
      <span className={muted ? "text-muted/70" : "text-muted/80"}>{label}</span>
      <span className="tabular-nums text-text">{children}</span>
    </div>
  );
}

function Divider(): ReactElement {
  return <div className="my-1 border-t border-border/30" />;
}

/** Monto con signo tipográfico (− real, no guión ASCII) + moneda. */
function money(currency: string, value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}${currency ? `${currency} ` : ""}${formatByType(Math.abs(value), "MONEY")}`;
}

/** Texto de la regla aplicada ("× 15%", "Tarifa fija ARS 12.000", "HUNDRED…"). */
function ruleText(rule: TraceRule, currency: string): string {
  switch (rule.kind) {
    case "PERCENT":
      // `PERCENT` ya incluye el sufijo " %" (no se duplica).
      return rule.value != null
        ? `× ${formatByType(rule.value, "PERCENT")}${rule.label ? ` · ${rule.label}` : ""}`
        : (rule.label ?? "× —");
    case "FIXED":
      return rule.value != null
        ? `${rule.label ? `${rule.label} · ` : ""}${currency ? `${currency} ` : ""}${formatByType(rule.value, "MONEY")}`
        : (rule.label ?? "Monto fijo");
    case "ROUNDING":
      return rule.label ?? "Redondeo";
    case "MANUAL":
      return rule.label ?? "Ajuste manual";
  }
}

/** Bloque "Cuenta" para un trace (sin ítems). Devuelve null si no hay datos. */
function AccountBlock({
  trace,
  currency,
}: {
  trace:    ComponentTrace;
  currency: string;
}): ReactElement | null {
  const hasBaseRule =
    (typeof trace.base === "number" && Number.isFinite(trace.base)) || !!trace.rule;
  const hasPrePost =
    (typeof trace.preValue === "number" && Number.isFinite(trace.preValue)) ||
    (typeof trace.postValue === "number" && Number.isFinite(trace.postValue));

  if (!hasBaseRule && !hasPrePost) return null;

  return (
    <>
      {typeof trace.base === "number" && Number.isFinite(trace.base) && (
        <Row label="Base">{money(currency, trace.base)}</Row>
      )}
      {trace.rule && (
        <Row label="Regla">{ruleText(trace.rule, currency)}</Row>
      )}
      {typeof trace.preValue === "number" && Number.isFinite(trace.preValue) && (
        <Row label="Antes">{money(currency, trace.preValue)}</Row>
      )}
      {typeof trace.postValue === "number" && Number.isFinite(trace.postValue) && (
        <Row label="Después">{money(currency, trace.postValue)}</Row>
      )}
    </>
  );
}

export interface TraceTooltipBodyProps {
  trace:    ComponentTrace;
  currency: string;
}

/** Cuerpo del `OriginTooltip` armado desde un `ComponentTrace`. */
export function TraceTooltipBody({ trace, currency }: TraceTooltipBodyProps): ReactElement {
  const hasItems = Array.isArray(trace.items) && trace.items.length > 0;

  return (
    <div className="space-y-1" data-testid={`trace-body-${trace.kind.toLowerCase()}`}>
      {/* (1) ORIGEN */}
      <div className="flex flex-col gap-0">
        <Row label="Origen">{trace.origin.sourceName}</Row>
        <span className="text-[10px] text-muted/60 leading-tight">
          {sourceTypeLabel(trace.origin.sourceType)}
        </span>
        {trace.note && (
          <span className="text-[10px] text-muted/70 leading-tight tabular-nums">
            {trace.note}
          </span>
        )}
      </div>

      {/* (2)+(3) CUENTA — base × regla / pre → post */}
      {(() => {
        const account = AccountBlock({ trace, currency });
        return account ? (
          <>
            <Divider />
            {account}
          </>
        ) : null;
      })()}

      {/* Ítems (impuestos / promociones) — cada uno con su mini-cuenta. */}
      {hasItems && (
        <>
          <Divider />
          <div className="space-y-1.5">
            {trace.items!.map((it, idx) => (
              <div key={`${it.kind}-${idx}`} className="flex flex-col gap-0">
                <Row label={it.title} bold>
                  {money(currency, it.impact)}
                </Row>
                {typeof it.base === "number" && Number.isFinite(it.base) && (
                  <span className="text-[10px] text-muted/60 leading-tight tabular-nums">
                    Base {money(currency, it.base)}
                    {it.rule && it.rule.kind === "PERCENT" && it.rule.value != null
                      ? ` × ${formatByType(it.rule.value, "PERCENT")}`
                      : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* (4) IMPACTO */}
      <Divider />
      <Row label="Impacto" bold>
        <span className={trace.impact < 0 ? "text-red-500" : "text-text"}>
          {money(currency, trace.impact)}
        </span>
      </Row>

      {/* Aviso de dato parcial — lenguaje orientado al operador (sin nombres
          técnicos del backend). El detalle exacto del campo faltante queda
          únicamente como atributo de diagnóstico (no visible). */}
      {trace.completeness === "PARTIAL" && (
        <div
          className="mt-1 rounded bg-amber-400/10 px-1.5 py-1 text-[10px] leading-tight text-amber-600"
          data-testid="trace-body-partial-note"
          data-tp-missing={trace.missingField ?? undefined}
        >
          ⚠ Detalle estimado. El sistema muestra el impacto aproximado
          disponible; el cálculo exacto se visualizará cuando toda la
          información esté disponible.
        </div>
      )}
    </div>
  );
}

export default TraceTooltipBody;
