// src/components/sales/TotalDelComprobanteCard/parts/CardHeader.tsx
// =============================================================================
// Etapa B — Header del card maestro.
//
// Estructura:
//
//   ┌────────────────────────────────────────────────┐
//   │ TOTAL DEL COMPROBANTE                          │  ← title (uppercase, sutil)
//   │ ARS 1.210,00                                   │  ← total grande
//   │ Modo: Desglosado · Tienda Online · Lista A     │  ← subheader contextual
//   └────────────────────────────────────────────────┘
//
// READ-ONLY. Cero matemática. El total grande sigue siendo PASSTHROUGH del
// `totalDocument` que el orchestrator recibe.
// =============================================================================

import type { ReactElement, ReactNode } from "react";
import { formatByType } from "../../../../lib/pricing/format";
import { vt } from "../../../../lib/pricing/visualTokens";
import type { BalanceMode } from "../types";

export interface CardHeaderProps {
  totalDocument:  number;
  currencyCode?:  string;
  /** Modo efectivo — usado solo cuando NO se renderiza un `modeSelector` (el
   *  selector ya nombra el modo). Se conserva en props para back-compat y
   *  para usos futuros (impresión, snapshots) donde el selector no aplica. */
  mode:           BalanceMode;
  channelName?:   string | null;
  priceListName?: string | null;
  /** Selector inline integrado en el header. Cuando está presente, omitimos
   *  la palabra "Modo" del subheader para evitar duplicación visual con el
   *  selector. */
  modeSelector?:  ReactNode;
}

export function CardHeader({
  totalDocument,
  currencyCode,
  channelName,
  priceListName,
  modeSelector,
}: CardHeaderProps): ReactElement {
  const moneyPrefix = currencyCode ? `${currencyCode} ` : "";
  const hasContext = !!channelName || !!priceListName;

  return (
    <header className="space-y-1.5" data-testid="total-card-header">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
          Total del comprobante
        </span>
        {modeSelector && (
          <div data-testid="total-card-mode-selector">{modeSelector}</div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 pt-0.5">
        {/* Total maestro — color primary para acento, alineado con el patrón
            canónico del Simulador (`PricingStepsBreakdown/parts/
            FinalAdjustmentsSection.tsx:235`: `totalGrand + colors.primary`).
            En dark mode `text-primary` se resuelve por la paleta del tema —
            cero colores hardcodeados.
            Override de tamaño LOCAL al card (`!text-2xl sm:!text-3xl`): este
            total es el "card principal" del stack del aside, por eso
            sobreescribe el tamaño default de `totalGrand` (text-base). El
            override `!important` es necesario porque `totalGrand` declara su
            propio `text-base` y ambas clases coexisten en `className`. */}
        <span
          className={`${vt.text.totalGrand} ${vt.colors.primary} !text-3xl sm:!text-4xl leading-tight`}
          data-testid="total-card-amount"
        >
          {moneyPrefix}
          {formatByType(totalDocument, "MONEY")}
        </span>
      </div>

      {hasContext && (
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${vt.text.subLabel} ${vt.colors.labelSoft}`}
          data-testid="total-card-subheader"
        >
          {channelName && (
            <span data-testid="total-card-channel">{channelName}</span>
          )}
          {channelName && priceListName && (
            <span aria-hidden className="text-muted/40">·</span>
          )}
          {priceListName && (
            <span data-testid="total-card-pricelist">{priceListName}</span>
          )}
        </div>
      )}
    </header>
  );
}

export default CardHeader;
