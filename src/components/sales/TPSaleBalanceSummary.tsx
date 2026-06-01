// src/components/sales/TPSaleBalanceSummary.tsx
// =============================================================================
// T57 (Fase 3B.7) — Resumen visual de Balance Mode para la Factura de Ventas.
//
// READ-ONLY. NO calcula nada. Solo formatea y renderiza lo que el preview
// del backend ya devolvió en `balanceBreakdown`.
//
// Modos (POLICY.md §11):
//   · UNIFIED   → "TOTAL" + (opcional) composición + texto impacto CC.
//   · BREAKDOWN → bloque "METALES" + "MONEDA" (con composición) + texto impacto.
//
// Reglas:
//   · Los gramos NUNCA cambian con la moneda — `METAL_GRAMS` preset.
//   · El monto monetario usa la moneda del documento (`monetaryBalance.currencyCode`).
//   · `components[]` se renderiza agrupado por `group`, preservando el orden
//     en que llega del backend (sin sort propio).
//   · Si el preview NO trae `balanceBreakdown`, el componente NO renderiza
//     nada (fallback silencioso para back-compat con flujos pre-3B.5).
//   · Si `components[]` está vacío o ausente, se muestra solo el total
//     consolidado como fallback.
// =============================================================================

import type { ReactElement } from "react";
import type {
  BalanceBreakdownDTO,
  BalanceBreakdownMonetaryComponentDTO,
  BalanceMonetaryComponentGroupDTO,
} from "../../services/sales";
import { formatByType } from "../../lib/pricing/format";
import { vt } from "../../lib/pricing/visualTokens";

export interface TPSaleBalanceSummaryProps {
  /** Breakdown canónico devuelto por `salesApi.preview`. */
  balanceBreakdown?: BalanceBreakdownDTO | null;
  /** Modo de balance resuelto. Si no se provee, se infiere del breakdown. */
  balanceMode?: "UNIFIED" | "BREAKDOWN";
  /** Code de la moneda del documento (display). Si no se pasa, se usa
   *  `monetaryBalance.currencyCode` del breakdown. */
  currencyCode?: string;
  /** Clase CSS adicional para el contenedor. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de display puros — sin matemática comercial.
// ─────────────────────────────────────────────────────────────────────────────

/** Fallback legacy: si un component no trae `group`, lo derivamos del `type`.
 *  Snapshots históricos pre-Fase 1 pueden no traerlo. */
function typeToGroup(type: string): BalanceMonetaryComponentGroupDTO {
  switch (type) {
    case "HECHURA":           return "HECHURA";
    case "PRODUCT":           return "PRODUCT";
    case "SERVICE":           return "PRODUCT";
    case "TAX":               return "TAX";
    case "BONUS":             return "BONUS";
    case "SURCHARGE":         return "SURCHARGE";
    case "DISCOUNT_QTY":
    case "DISCOUNT_PROMO":
    case "DISCOUNT_CLIENT":
    case "DISCOUNT_MANUAL":   return "DISCOUNT";
    case "COUPON":            return "COUPON";
    case "CHANNEL":           return "CHANNEL";
    case "PAYMENT":           return "PAYMENT";
    case "SHIPPING":          return "SHIPPING";
    case "ROUNDING_MONETARY": return "ROUNDING";
    case "MANUAL_ADJUSTMENT": return "ADJUSTMENT";
    default:                  return "ADJUSTMENT";
  }
}

/** Label humano del bloque por grupo.
 *  TODO(refactor): este `groupLabel` está DUPLICADO con
 *  `tptech-frontend/src/components/sales/TotalDelComprobanteCard/helpers.ts`
 *  (mismo enum, mismo mapeo). Extraer a un único helper compartido para
 *  evitar drift — en la próxima refactor del bucket monetario.
 *  Etapa 1 (rename semántico): `"HECHURA" → "Base monetaria"` aplicado en
 *  ambos sitios manualmente. Ver helpers.ts para la nota completa. */
function groupLabel(group: BalanceMonetaryComponentGroupDTO): string {
  switch (group) {
    case "HECHURA":    return "Base monetaria";
    case "PRODUCT":    return "Productos / Servicios";
    case "TAX":        return "Impuestos";
    case "DISCOUNT":   return "Descuentos";
    case "BONUS":      return "Bonificaciones";
    case "SURCHARGE":  return "Recargos";
    case "ADJUSTMENT": return "Ajustes";
    case "ROUNDING":   return "Redondeos";
    case "SHIPPING":   return "Envío";
    case "COUPON":     return "Cupones";
    case "CHANNEL":    return "Canal de venta";
    case "PAYMENT":    return "Forma de pago";
    case "MARGIN":     return "Diferencia metal";
  }
}

interface GroupedComponents {
  group:      BalanceMonetaryComponentGroupDTO;
  components: BalanceBreakdownMonetaryComponentDTO[];
}

/** Agrupa por `group` preservando el orden de PRIMERA APARICIÓN de cada grupo
 *  y el orden interno de los components. Función pura — cero matemática. */
function groupComponentsByGroup(
  components: BalanceBreakdownMonetaryComponentDTO[] | undefined,
): GroupedComponents[] {
  if (!components || components.length === 0) return [];
  const order: BalanceMonetaryComponentGroupDTO[] = [];
  const buckets = new Map<BalanceMonetaryComponentGroupDTO, BalanceBreakdownMonetaryComponentDTO[]>();
  for (const c of components) {
    const g = c.group ?? typeToGroup(c.type);
    let bucket = buckets.get(g);
    if (!bucket) {
      bucket = [];
      buckets.set(g, bucket);
      order.push(g);
    }
    bucket.push(c);
  }
  return order.map((g) => ({ group: g, components: buckets.get(g)! }));
}

/** Devuelve la clase CSS de color para un amount según su signo. */
function amountColorClass(amount: number): string {
  if (amount < 0) return vt.colors.discount;
  if (amount > 0) return vt.colors.text;
  return vt.colors.label;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes presentacionales
// ─────────────────────────────────────────────────────────────────────────────

function ComponentsBreakdown({
  groups,
  displayCurrency,
}: {
  groups:          GroupedComponents[];
  displayCurrency: string;
}): ReactElement | null {
  if (groups.length === 0) return null;
  return (
    <div
      className="mt-2 space-y-2"
      data-testid="balance-summary-components"
    >
      {groups.map((g) => (
        <div key={g.group} data-testid={`balance-group-${g.group}`}>
          <div className={`${vt.text.subLabel} ${vt.colors.labelSoft}`}>
            {groupLabel(g.group)}
          </div>
          <ul className="mt-0.5 space-y-0.5">
            {g.components.map((c, idx) => (
              <li
                key={`${c.type}-${idx}`}
                className={vt.row.flexBetween}
                data-testid={`balance-component-${c.type}`}
              >
                <span className={vt.text.label}>{c.label}</span>
                <span
                  className={`${vt.text.rowAmount} ${amountColorClass(c.amount)}`}
                >
                  {displayCurrency ? `${displayCurrency} ` : ""}
                  {formatByType(c.amount, "MONEY")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ImpactNote({
  mode,
}: {
  mode: "UNIFIED" | "BREAKDOWN";
}): ReactElement {
  const text =
    mode === "UNIFIED"
      ? "Este comprobante impactará en cuenta corriente como saldo unificado."
      : "Este comprobante impactará en cuenta corriente desglosado: metales + moneda.";
  return (
    <p
      className={`mt-3 ${vt.text.subLabel} ${vt.colors.labelSoft}`}
      data-testid={`balance-impact-${mode.toLowerCase()}`}
    >
      {text}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function TPSaleBalanceSummary({
  balanceBreakdown,
  balanceMode,
  currencyCode,
  className,
}: TPSaleBalanceSummaryProps): ReactElement | null {
  // Sin breakdown del backend → no renderizamos nada (back-compat).
  if (!balanceBreakdown || !balanceBreakdown.monetaryBalance) return null;

  const mode: "UNIFIED" | "BREAKDOWN" =
    balanceMode ?? (balanceBreakdown.metals.length > 0 ? "BREAKDOWN" : "UNIFIED");

  const monetary        = balanceBreakdown.monetaryBalance;
  const displayCurrency = currencyCode ?? monetary.currencyCode ?? "";
  const grouped         = groupComponentsByGroup(monetary.components);

  // UNIFIED — total + (opcional) composición + impacto.
  if (mode === "UNIFIED") {
    return (
      <div
        className={`${vt.card.outer} ${className ?? ""}`}
        data-testid="balance-summary-unified"
      >
        <div className={vt.card.inner}>
          <div className={vt.row.flexBetween}>
            <span className={vt.text.subtotalRow}>TOTAL</span>
            <span className={vt.text.totalCard}>
              {displayCurrency ? `${displayCurrency} ` : ""}
              {formatByType(monetary.amount, "MONEY")}
            </span>
          </div>
          <ComponentsBreakdown
            groups={grouped}
            displayCurrency={displayCurrency}
          />
          <ImpactNote mode="UNIFIED" />
        </div>
      </div>
    );
  }

  // BREAKDOWN — metales (siempre visible) + moneda (con composición) + impacto.
  const hasMetals = balanceBreakdown.metals.length > 0;
  return (
    <div
      className={`${vt.card.outer} ${className ?? ""}`}
      data-testid="balance-summary-breakdown"
    >
      <div className={vt.card.inner}>
        {/* Bloque METALES OBLIGATORIO en BREAKDOWN: se muestra siempre,
            incluso si el documento no tiene metales (mensaje informativo).
            La regla la decide el modo del backend — el frontend nunca oculta
            el bloque cuando el cliente / lista / tenant pidió desglosar. */}
        <div data-testid="balance-summary-metals">
          <div className={vt.text.subtotalRow}>METALES</div>
          {hasMetals ? (
            <ul className="mt-1 space-y-1">
              {balanceBreakdown.metals.map((m) => (
                <li
                  key={m.metalParentId}
                  className={vt.row.flexBetween}
                  data-testid={`metal-row-${m.metalParentId}`}
                >
                  <span className={vt.text.formula}>{m.metalParentName}</span>
                  <span className={vt.text.totalCard}>
                    {formatByType(m.gramsPure, "METAL_GRAMS")}{" gr"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className={`mt-1 ${vt.text.subLabel} ${vt.colors.labelSoft} italic`}
              data-testid="balance-summary-metals-empty"
            >
              Sin metales en este documento.
            </p>
          )}
        </div>
        <div className={vt.row.separator} />
        <div data-testid="balance-summary-monetary">
          <div className={vt.row.flexBetween}>
            <span className={vt.text.subtotalRow}>MONEDA</span>
            <span className={vt.text.totalCard}>
              {displayCurrency ? `${displayCurrency} ` : ""}
              {formatByType(monetary.amount, "MONEY")}
            </span>
          </div>
          <ComponentsBreakdown
            groups={grouped}
            displayCurrency={displayCurrency}
          />
        </div>
        <ImpactNote mode="BREAKDOWN" />
      </div>
    </div>
  );
}

export default TPSaleBalanceSummary;
