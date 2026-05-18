// src/components/pricing/PricingStepsBreakdown/types.ts
// ============================================================================
// Tipos del bloque "Flujo de construcción del precio".
//
// REGLA CRÍTICA (POLICY R6): los componentes son lectores puros del response
// del motor. NO hay matemática comercial nueva acá — solo formato y display.
// ============================================================================

import type {
  NormalizedPricingLine,
} from "../../../lib/pricing/contract";
import type { PricingStepResult, PricingPreviewResult } from "../../../services/articles";

/**
 * Modo de visualización del bloque.
 *
 * - `full` — incluye card wrapper + header colapsable + body completo. Diseño
 *   del Simulador y Comparador (vista de 2 columnas).
 * - `compact` — solo el body, sin wrapper ni header. Diseño compacto para
 *   integración por línea en Factura (modal estrecho).
 */
export type PricingStepsBreakdownVariant = "full" | "compact";

/**
 * Modo de detalle. En `compact` se ignora — solo aplica en `full`.
 *
 * - `UNIFICADO` — flujo simplificado, sin cards laterales.
 * - `DESGLOSADO` — flujo completo con desglose visual por componente
 *   metal/hechura.
 */
export type PricingStepsDetailMode = "UNIFICADO" | "DESGLOSADO";

/**
 * Configuración de moneda para visualización. NO afecta cálculos — solo
 * formatea valores ya resueltos por el motor.
 */
export type PricingStepsDisplay = {
  /** Tasa de conversión de la moneda base del motor a la moneda mostrada.
   *  Default 1 (sin conversión). */
  rate: number;
  /** Símbolo de moneda a mostrar (ej: "$", "USD", "ARS"). */
  symbol: string;
};

/**
 * Información del canal seleccionado — para etiquetar el ajuste de canal.
 * Solo se usa visualmente. El monto del ajuste viene de result.channelResult.
 */
export type PricingStepsChannelInfo = {
  channelId:   string | null;
  channelName: string | null;
};

/**
 * Información del medio de pago — para etiquetar el ajuste de pago.
 * El monto del ajuste viene de result.checkoutResult del motor.
 */
export type PricingStepsPaymentInfo = {
  paymentMethodName: string | null;
  /** Cantidad de cuotas (display). Si null, se muestra "1 pago". */
  installmentsQty:   number | null;
};

/**
 * Props públicas de `<PricingStepsBreakdown />`.
 *
 * Diseño: agrupar inputs del motor + config visual + contexto.
 *
 * Reglas:
 *   - Todo lo numérico viene del response del motor (props `result` y `line`).
 *   - El componente puede derivar internamente lo que necesite (subStep
 *     filters, lineSaleByCostLineId, etc.) usando helpers puros.
 *   - NO calcula precios, descuentos, impuestos ni totales nuevos.
 */
export type PricingStepsBreakdownProps = {
  /** Pasos normalizados del motor. Contiene PRICE_LIST, MARGIN, ENTITY_MERMA_*,
   *  QUANTITY_DISCOUNT, PROMOTION, ENTITY_COMMERCIAL_RULE, ROUNDING, etc. */
  steps: PricingStepResult[];

  /** Línea normalizada del ViewModel. Provee unitPrice, costo, breakdown
   *  metal/hechura, composition, productos, servicios, taxBreakdown. */
  line: NormalizedPricingLine | null;

  /** Resultado bruto del motor. Necesario para appliedRounding,
   *  channelResult, couponResult, checkoutResult, shippingResult,
   *  taxBreakdown a nivel documento. */
  result: Pick<PricingPreviewResult,
    | "appliedRounding"
    | "appliedRoundingSuppressedByDocPolicy"
    | "listRoundingMeta"
    | "channelResult"
    | "couponResult"
    | "checkoutResult"
    | "shippingResult"
    | "taxBreakdown"
    | "taxExemptByEntity"
    | "appliedPriceListMode"
  > | null;

  /** Cantidad seleccionada — usada para mostrar totales por unidades. */
  quantity?: number;

  /** Información del canal (display). Si null, se omite la fila de canal. */
  channel?: PricingStepsChannelInfo | null;

  /** Información del medio de pago (display). */
  payment?: PricingStepsPaymentInfo | null;

  /** Si true, el modo what-if está activo y se ocultan ajustes que dependen
   *  del contexto comercial real (canal, cupón, pago) para no confundir. */
  whatIfActive?: boolean;

  /** Configuración de moneda. Default `{ rate: 1, symbol: "$" }`. */
  display?: PricingStepsDisplay;

  /** Variante visual. Default `"full"`. */
  variant?: PricingStepsBreakdownVariant;

  /** Solo aplica cuando `variant === "full"`. Default `"DESGLOSADO"`. */
  detailMode?: PricingStepsDetailMode;

  /** Si false, oculta el card informativo "Redondeo por artículo / lista"
   *  dentro de `RoundingTaxSection`. La fila simple "Redondeo" del flujo
   *  sigue visible. Default `true` (preserva el comportamiento de Factura y
   *  Comparador); el Simulador lo pasa `false`. */
  showListRoundingCard?: boolean;

  /** Estado controlado de expansión. Si se omite, el componente maneja
   *  estado local. Permite que el padre persista preferencias. */
  expanded?: Record<string, boolean>;
  onToggle?: (key: string) => void;
};

// ─── Tipos internos (no exportados al barrel) ──────────────────────────────

/**
 * Mapa canónico costLineId → lineSale derivado de
 * `composition.{metals,hechuras,products,services}[]`. Es la fuente de verdad
 * del pricing-engine para el sale-side por línea (cierre POLICY R4.1).
 *
 * Cuando un step tiene `meta.costLineId`, buscamos su lineSale acá antes de
 * caer al cálculo legacy `qCost × factor` (que solo aplica a snapshots viejos
 * pre v7).
 */
export type LineSaleByCostLineId = Map<string, number>;

// Re-exports para conveniencia en tests + parts.
export type { NormalizedPricingLine };
export type { PricingStepResult, PricingPreviewResult };
