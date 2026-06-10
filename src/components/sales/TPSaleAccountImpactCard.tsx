// src/components/sales/TPSaleAccountImpactCard.tsx
// =============================================================================
// Etapa A.5 — Card "Impacto en cuenta corriente" (versión limpia).
//
// READ-ONLY. NO calcula nada. NO usa mocks. Solo formatea valores que vienen
// del backend (`balanceMode`, `balanceBreakdown`) o que ya están agregados a
// partir de inputs del operador (`totalDocument`, `paidAmount`).
//
// Diferencias con la versión vieja (eliminada en Etapa A.3):
//   · NO usa `balanceBefore = 0` mock.
//   · NO calcula "saldo después" derivado.
//   · NO duplica el Total maestro como valor protagonista — lo muestra como
//     contexto secundario para que el operador entienda el impacto.
//   · Muestra metales padre + saldo monetario cuando el modo es BREAKDOWN.
//   · Texto explícito de transitorio: "El impacto definitivo se calculará al
//     confirmar/cobrar el comprobante." mientras el backend no exponga el
//     saldo previo real de cuenta corriente.
//
// Reglas:
//   · Cero matemática comercial — `balancePending` se RECIBE ya calculado
//     desde el caller (mismo número que PaymentCard.balance, sin recomputo).
//   · Las cantidades físicas (gramos) nunca se convierten con moneda.
//   · Los montos monetarios usan la moneda del documento.
// =============================================================================

import type { ReactElement } from "react";
import type { BalanceBreakdownDTO } from "../../services/sales";
import { formatByType } from "../../lib/pricing/format";
import { vt } from "../../lib/pricing/visualTokens";

export interface TPSaleAccountImpactCardProps {
  /** Total final del comprobante (en moneda del documento). Pasthrough del
   *  preview del backend. */
  totalDocument:  number;
  /** Total cobrado hasta el momento (suma de pagos del draft). */
  paidAmount:     number;
  /** Saldo pendiente = totalDocument − paidAmount. Se RECIBE ya calculado
   *  desde el caller (mismo valor que `PaymentCard.balance`); NO se recomputa
   *  acá para preservar la regla "una sola fuente del cálculo". */
  balancePending: number;
  /** Code de la moneda del documento (display). */
  currencyCode?:  string;
  /** Modo de balance resuelto por el backend. */
  balanceMode?:   "UNIFIED" | "BREAKDOWN";
  /** Breakdown canónico — alimenta el bloque de desglose en BREAKDOWN. */
  balanceBreakdown?: BalanceBreakdownDTO | null;
  /** Label del origen del impacto. Default: "Factura de venta". */
  originLabel?:   string;
  /** Clase CSS adicional. */
  className?:     string;
}

const MODE_LABEL: Record<"UNIFIED" | "BREAKDOWN", string> = {
  UNIFIED:   "Unificado",
  BREAKDOWN: "Desglosado",
};

export function TPSaleAccountImpactCard({
  totalDocument,
  paidAmount,
  balancePending,
  currencyCode,
  balanceMode,
  balanceBreakdown,
  originLabel = "Factura de venta",
  className,
}: TPSaleAccountImpactCardProps): ReactElement {
  // Modo de saldo (SSOT) — lector puro del `balanceMode` del backend. NO se
  // infiere desde la presencia de metales: mostrar metales NO cambia el modo.
  // Coherente con `TotalDelComprobanteCard` (mismo `balanceMode` del preview).
  const mode: "UNIFIED" | "BREAKDOWN" = balanceMode ?? "UNIFIED";

  // Moneda de display: prop > breakdown > "".
  const displayCurrency =
    currencyCode
      ?? balanceBreakdown?.monetaryBalance?.currencyCode
      ?? "";
  const fmtMoney = (n: number): string =>
    (displayCurrency ? `${displayCurrency} ` : "") + formatByType(n, "MONEY");

  // Color del saldo pendiente: si queda saldo, ámbar; si está cubierto, esmeralda.
  const balanceColor =
    balancePending > 0.005
      ? "text-amber-500"
      : "text-emerald-500";

  const isBreakdown = mode === "BREAKDOWN";

  return (
    <div
      className={className}
      data-testid="account-impact-card"
    >
      {/* Header chiquito con modo + origen — NO duplica el Total maestro. */}
      <div className={`flex items-center justify-between gap-2 ${vt.text.subLabel}`}>
        <span className={vt.colors.labelSoft}>
          <span className="text-muted">Modo:</span>{" "}
          <span
            className="font-semibold text-text"
            data-testid="account-impact-mode"
          >
            {MODE_LABEL[mode]}
          </span>
        </span>
        <span className={vt.colors.labelSoft}>
          <span className="text-muted">Origen:</span>{" "}
          <span
            className="font-semibold text-text"
            data-testid="account-impact-origin"
          >
            {originLabel}
          </span>
        </span>
      </div>

      {/* Bloque de números — labels chicos. NO usamos totalGrand/totalCard
          para evitar competir con el Total maestro del Hero. */}
      <div className="mt-2 space-y-1 text-[11px]">
        <div className={vt.row.flexBetween}>
          <span className="text-muted">Total del comprobante</span>
          <span
            className="tabular-nums font-semibold text-text"
            data-testid="account-impact-total"
          >
            {fmtMoney(totalDocument)}
          </span>
        </div>
        <div className={vt.row.flexBetween}>
          <span className="text-muted">Cobrado</span>
          <span
            className="tabular-nums font-semibold text-emerald-500"
            data-testid="account-impact-paid"
          >
            {paidAmount > 0 ? fmtMoney(paidAmount) : "—"}
          </span>
        </div>
        <div className={`${vt.row.flexBetween} border-t border-border/40 pt-1.5`}>
          <span className="font-semibold text-text">Saldo pendiente</span>
          <span
            className={`tabular-nums font-bold ${balanceColor}`}
            data-testid="account-impact-pending"
          >
            {fmtMoney(balancePending)}
          </span>
        </div>
      </div>

      {/* Desglose visible solo en BREAKDOWN — passthrough del breakdown
          canónico del backend. No recomputamos nada acá. */}
      {isBreakdown && (
        <div
          className="mt-2 space-y-1 rounded-md border border-border/30 bg-surface2/20 px-2 py-1.5"
          data-testid="account-impact-breakdown"
        >
          <div className={`${vt.text.subLabel} ${vt.colors.labelSoft}`}>
            Desglose en cuenta corriente
          </div>
          {balanceBreakdown && balanceBreakdown.metals.length > 0 ? (
            <ul className="space-y-0.5 text-[11px]">
              {balanceBreakdown.metals.map((m) => (
                <li
                  key={m.metalParentId}
                  className={vt.row.flexBetween}
                  data-testid={`account-impact-metal-${m.metalParentId}`}
                >
                  <span className={vt.colors.formula}>{m.metalParentName}</span>
                  <span className="tabular-nums font-semibold text-text">
                    {formatByType(m.gramsPure, "METAL_GRAMS")} gr
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${vt.text.subLabel} ${vt.colors.labelSoft} italic`}>
              Sin metales en este comprobante.
            </p>
          )}
          {balanceBreakdown?.monetaryBalance && (
            <div
              className={`${vt.row.flexBetween} border-t border-border/30 pt-1 text-[11px]`}
              data-testid="account-impact-monetary"
            >
              <span className={vt.colors.formula}>Saldo monetario</span>
              <span className="tabular-nums font-semibold text-text">
                {fmtMoney(balanceBreakdown.monetaryBalance.amount)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Nota: mientras el backend NO exponga saldo previo real de cuenta
          corriente, declaramos el estado transitorio explícitamente. Cuando
          se conecte, este párrafo se reemplaza por la fila "Saldo anterior". */}
      <p
        className={`mt-2 ${vt.text.subLabel} ${vt.colors.labelSoft} italic`}
        data-testid="account-impact-note"
      >
        El impacto definitivo se calculará al confirmar/cobrar el comprobante.
      </p>
    </div>
  );
}

export default TPSaleAccountImpactCard;
