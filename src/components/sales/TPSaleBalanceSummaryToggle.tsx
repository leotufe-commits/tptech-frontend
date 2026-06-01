// src/components/sales/TPSaleBalanceSummaryToggle.tsx
// =============================================================================
// Fase 4.3 — Wrapper de visibilidad del Resumen de Balance Mode.
//
// Encapsula la regla UI de visibilidad pedida por la spec:
//
//   · UNIFIED  → card OCULTO por defecto. Mostrable/ocultable con un
//                icon-toggle pequeño cerca del label del total.
//                La preferencia es LOCAL del modal (estado de React puro,
//                no persiste en draft / payload / backend).
//   · BREAKDOWN → card SIEMPRE visible. El toggle no se muestra — la regla
//                 dice que NO debe depender de que el usuario lo active.
//
// READ-ONLY. NO calcula nada. Solo decide visibilidad y delega el render
// a `TPSaleBalanceSummary`.
// =============================================================================

import { useState, type ReactElement } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  TPSaleBalanceSummary,
  type TPSaleBalanceSummaryProps,
} from "./TPSaleBalanceSummary";
import { vt } from "../../lib/pricing/visualTokens";

export interface TPSaleBalanceSummaryToggleProps
  extends TPSaleBalanceSummaryProps {
  /** Estado inicial del toggle en UNIFIED. Default `false` (oculto). */
  defaultShownInUnified?: boolean;
}

export function TPSaleBalanceSummaryToggle({
  balanceBreakdown,
  balanceMode,
  currencyCode,
  className,
  defaultShownInUnified = false,
}: TPSaleBalanceSummaryToggleProps): ReactElement | null {
  // Sin breakdown del backend → nada que mostrar (mismo back-compat que el
  // componente interno).
  if (!balanceBreakdown || !balanceBreakdown.monetaryBalance) return null;

  // Modo efectivo: prop o inferencia desde metals[].
  const mode: "UNIFIED" | "BREAKDOWN" =
    balanceMode ?? (balanceBreakdown.metals.length > 0 ? "BREAKDOWN" : "UNIFIED");

  // Estado LOCAL del modal — no viaja en payload. Solo aplica a UNIFIED.
  const [userShown, setUserShown] = useState<boolean>(defaultShownInUnified);

  // BREAKDOWN: card obligatorio, sin toggle.
  if (mode === "BREAKDOWN") {
    return (
      <TPSaleBalanceSummary
        balanceBreakdown={balanceBreakdown}
        balanceMode="BREAKDOWN"
        currencyCode={currencyCode}
        className={className}
      />
    );
  }

  // UNIFIED: header con icon-toggle + (opcional) card.
  return (
    <div className={className} data-testid="balance-toggle-unified">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setUserShown((v) => !v)}
          className={`inline-flex items-center gap-1 ${vt.text.subLabel} ${vt.colors.labelSoft} hover:text-foreground transition-colors`}
          aria-expanded={userShown}
          aria-controls="balance-summary-card"
          data-testid="balance-toggle-button"
          title={userShown
            ? "Ocultar composición del total"
            : "Ver composición del total"}
        >
          {userShown
            ? <EyeOff size={14} aria-hidden="true" />
            : <Eye    size={14} aria-hidden="true" />}
          <span>
            {userShown ? "Ocultar composición" : "Ver composición"}
          </span>
        </button>
      </div>
      {userShown && (
        <div id="balance-summary-card" className="mt-2">
          <TPSaleBalanceSummary
            balanceBreakdown={balanceBreakdown}
            balanceMode="UNIFIED"
            currencyCode={currencyCode}
          />
        </div>
      )}
    </div>
  );
}

export default TPSaleBalanceSummaryToggle;
