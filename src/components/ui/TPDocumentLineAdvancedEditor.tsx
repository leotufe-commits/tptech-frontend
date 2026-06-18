// src/components/ui/TPDocumentLineAdvancedEditor.tsx
// ============================================================================
// TPDocumentLineAdvancedEditor — editor avanzado de líneas de comprobante.
//
// Alternativa rica a `TPDocumentLinesEditor` (que sigue vivo para los
// comprobantes que no necesitan este nivel de detalle). Pensado para el
// rediseño profundo de facturas / presupuestos / órdenes:
//
//   · Selector real de artículo+variante (mock) con `TPArticleVariantSearchSelect`.
//   · Cantidad + precio unitario editables (mismos campos que el editor simple).
//   · Chip de "origen del precio" (Lista / Manual / Promo) derivado del
//     artículo seleccionado vs. el precio actual del line.
//   · Info de stock por almacén debajo de la fila (mock basado en el
//     artículo seleccionado; en Fase 7 vendrá del backend filtrado por
//     `warehouseId`).
//   · Expand/collapse por línea mostrando un mock del simulador:
//     METAL · HECHURA · IMPUESTOS · AJUSTES · TOTAL con fórmulas inline.
//   · Acciones por fila: expandir · duplicar · eliminar.
//
// El componente NO calcula precios — solo muestra los valores que VentasFacturas
// le pasa por props. Esos valores vienen ya resueltos del backend
// (`salesApi.preview` → `applySalePreviewToDraft`). Cualquier número que
// aparezca acá ya pasó por `pricing-engine` (`resolveFinalSalePrice`,
// `computeLineTaxes`, `computeSaleDocumentTotals`).
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Plus, Copy, Trash2, ChevronRight, Warehouse, GripVertical, Package, Settings2, RotateCcw, ChevronDown, Check, Loader2, ChevronsUpDown, ChevronsDownUp, X, AlertTriangle } from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "./tp";
import { LineTaxQuickPicker, type AvailableLineTax } from "./LineTaxQuickPicker";
import { TPIconButton } from "./TPIconButton";
import TPNumberInput from "./TPNumberInput";
import TPQuantityField from "./TPQuantityField";
import { isTaxClearedOverride, resolveLineListBadge } from "./TPDocumentLineAdvancedEditor.helpers";
import {
  TPArticleVariantSearchSelect,
  MOCK_ARTICLES,
  type TPArticleLite,
  type TPArticleStockByWarehouse,
} from "./TPArticleVariantSearchSelect";
import { LineAdvancedOverridesPanel } from "./LineAdvancedOverridesPanel";
// Fase 2 — grilla editable específica de Factura. Reemplaza al panel
// legacy SOLO cuando `compositionView === "sale"`. Compras/Presupuestos/
// Órdenes (`view="cost"`) siguen usando el panel original.
import {
  SaleCompositionEditableGrid,
  type SaleGlobalAdjustments,
} from "../sales/SaleCompositionEditableGrid";
import { TPImageLightbox } from "./TPImageLightbox";
import { TPActionsMenu } from "./TPActionsMenu";
import { TPPopover } from "./TPPopover";

import { type DocumentLine } from "../../lib/document-types";
import { formatMoneyDoc as fmtMoney, formatQty as fmtQty, formatByType } from "../../lib/pricing/format";
import { vt } from "../../lib/pricing/visualTokens";
import { SaleLineDiscountSummary } from "../sales/SaleLineDiscountSummary";
import { lineEffectiveAdjustmentSigned } from "../../lib/pricing/display/saleLineDiscountSourcesDisplay";
import { HelpCircle } from "lucide-react";
import {
  resolveQuantityConstraints,
  type QuantityConstraints,
} from "../../lib/commercial-line-engine";
import {
  buildMetalParentSaleLines,
  buildLineHechuraSaleUnified,
  computeMetalSaleFactor,
  pickLineCommercialRoundingMetals,
  resolveCommercialHechuraImpact,
  isLineDesglosadaView,
  resolveLineBalanceMode,
  resolveLineMonetaryDisplay,
  resolveLineMonetaryRoundingDecomposition,
  isAmountSignificantInBase,
} from "../../lib/pricing/display/saleCompositionDisplay";

export type TPDocumentLineAdvancedEditorProps = {
  lines: DocumentLine[];
  updateLine: (id: string, patch: Partial<DocumentLine>) => void;
  removeLine: (id: string) => void;
  /** Opcional — si se omite no se muestra el botón "duplicar". */
  duplicateLine?: (id: string) => void;
  currency: string;
  /**
   * Factor visual de conversión a la moneda del documento (default 1 = base).
   * Mismo patrón que `PricingSimulator` — los amounts se multiplican antes
   * de formatear; no se altera la fuente del backend.
   */
  displayRate?: number;
  /** Almacén del documento — se usa para filtrar el stock mostrado por línea. */
  warehouseId?: string;
  /** Lista de precios del documento — afecta el chip "Lista" vs "Manual". */
  priceListId?: string;
  /** Nombre de la lista de precios del documento — se muestra en la línea
   *  como referencia ("Lista aplicada"). Solo lectura: la lista se cambia
   *  desde el header del documento. Cuando el motor reporta una lista
   *  efectiva por línea distinta (`pricingMeta.appliedPriceListName`),
   *  esa tiene prioridad. */
  priceListName?: string;
  /** Nombre del canal de venta del documento — se muestra en la barra de
   *  stock por línea como referencia compacta. Solo lectura: el canal se
   *  cambia desde el header del documento. */
  channelName?: string;
  /** Id del canal del documento — para marcar el seleccionado en el picker. */
  channelId?: string;
  /** Listas de precios del tenant — habilita picker inline. El cambio
   *  aplica a TODO el documento (el motor no soporta override por línea). */
  priceListOptions?: ReadonlyArray<{ id: string; name: string }>;
  /** Canales de venta del tenant — habilita picker inline. */
  channelOptions?: ReadonlyArray<{ id: string; name: string }>;
  /** Cambia la lista del documento. */
  onChangePriceList?: (priceListId: string) => void;
  /**
   * Cambia el override de lista de UNA línea. `null` significa "limpiar
   * override" → la línea vuelve a usar la lista global del documento.
   *
   * Cuando este callback está provisto, el chip "Lista" de cada línea pasa
   * a ser un picker per-línea (el cambio global del documento se hace
   * desde el header). El cambio global NO debe pisar líneas con override
   * — esa decisión vive en el parent. */
  onChangeLinePriceList?: (lineId: string, priceListId: string | null) => void;
  /** Cambia el canal del documento. */
  onChangeChannel?: (channelId: string) => void;
  /** Si es false, oculta la columna IVA de la fila principal. Default: true. */
  showTax?: boolean;
  /**
   * Si se pasa, habilita drag & drop para reordenar líneas. La función recibe
   * los `id` de la línea origen y destino. Si se omite, no se muestra handle.
   */
  reorderLines?: (fromId: string, toId: string) => void;
  /**
   * Predicado opcional para excluir ciertas líneas del DnD (ej. placeholder
   * vacío al final). Las líneas no reorderables se renderean al final, sin
   * handle, fuera del SortableContext. Default: todas reorderables.
   */
  isReorderable?: (line: DocumentLine, idx: number) => boolean;
  /**
   * @deprecated — el simulador integrado ya no existe. Estas props quedan
   * en la firma para no romper otros consumidores que las pasen, pero no
   * tienen efecto. Se eliminarán en una limpieza posterior.
   */
  expandedIds?: Set<string>;
  onToggleExpand?: (lineId: string) => void;
  /**
   * Si se pasa, agrega un botón "Editar artículo base" en cada línea con
   * artículo cargado. Recibe el `articleId` de la línea. El parent decide
   * qué abrir (modal de advertencia, navegar al editor de artículos, etc.).
   */
  onEditArticle?: (articleId: string) => void;
  /**
   * Si se pasa, agrega un botón "Restablecer línea" en cada línea con
   * artículo cargado. Recibe el `lineId`. El parent restaura los valores
   * originales (unitPrice / descuento / impuesto) preservando artículo y cantidad.
   */
  onResetLine?: (lineId: string) => void;
  /**
   * Modo de vista del documento — propaga al simulador para que la sección
   * "Ajustes" muestre un único campo (Unificado) o uno por componente
   * Metal / Hechura (Desglosado).
   */
  viewMode?: "unified" | "detailed";
  /**
   * Subtotales por cabecera (line.id → subtotal). El parent calcula sumando
   * los `lineTotal` de las líneas que vienen después de cada HEADER hasta la
   * próxima HEADER. La cabecera lo muestra como referencia comercial.
   */
  headerSubtotals?: Map<string, number>;
  /**
   * Si se pasa, el editor delega la selección/limpieza de artículo al parent
   * en vez de aplicar el `updateLine` por defecto. Útil para que el parent
   * implemente dedupe (sumar cantidad si ya existe), agregar línea vacía
   * trailing y mover el foco a la nueva línea.
   */
  onArticlePicked?: (lineId: string, item: TPArticleLite | null) => void;
  /**
   * Si el usuario tipea texto en el combo y presiona Enter / sale por blur
   * sin haber elegido ningún artículo, se invoca este callback para que el
   * parent convierta la línea en "manual" (texto libre, sin pricing-engine).
   */
  onCreateManualLine?: (lineId: string, text: string) => void;
  /**
   * Id de la línea cuyo combo de artículo debe enfocarse. Cambia cuando el
   * parent quiere cambiar de objetivo de foco (típicamente tras una selección
   * que generó una nueva línea vacía).
   */
  focusedLineId?: string | null;
  /**
   * Se incrementa para forzar foco en el combo de `focusedLineId`. Cada
   * cambio dispara `inputRef.focus()` (sin abrir el dropdown) en el combo
   * objetivo.
   */
  focusSignal?: number;
  /**
   * Si se pasa, el combo de artículo de cada línea usa búsqueda remota
   * (debounced) en lugar del filtro local sobre mocks.
   */
  articleSearch?: (query: string) => Promise<TPArticleLite[]>;
  /**
   * Lookup exacto por código (sku/code/barcode). Si se provee, el combo
   * por línea activa modo escaneo: Enter SOLO confirma matches exactos,
   * y si la lista parcial no contiene uno, consulta este callback antes
   * de declarar "no encontrado". Sin este prop, el combo se comporta en
   * modo manual (Enter confirma highlight).
   */
  articleExactLookup?: (query: string) => Promise<TPArticleLite[]>;
  /** Callback cuando el escaneo no encuentra match exacto (toast típico). */
  onArticleNoExactMatch?: (query: string) => void;
  /** Callback cuando el escaneo encuentra múltiples matches exactos. */
  onArticleMultipleExactMatches?: (query: string, matches: TPArticleLite[]) => void;
  /**
   * Lista real de almacenes para el picker por línea. Si se omite, se usa
   * el `stockByWarehouse` del artículo seleccionado (mock).
   */
  warehouses?: ReadonlyArray<{ id: string; name: string }>;
  /**
   * Mapa lineId → TPArticleLite con los ítems agregados desde fuera del
   * editor (típicamente quick-add / escáner). El editor lo usa para
   * popular su estado interno `pickedById` cuando una línea entra con
   * `articleId` ya seteado por el padre — sin esto, la fila Stock /
   * Almacén / Canal no se renderiza porque el editor no conoce el
   * `TPArticleLite` (solo lo tiene si pasó por su propio combo).
   */
  pickedItemsByLineId?: ReadonlyMap<string, TPArticleLite>;
  /**
   * Si se pasa, tras pickear un artículo el editor pide el stock por
   * almacén (vía backend) y enriquece la fila de stock + el picker.
   */
  articleStockBreakdown?: (
    articleId: string,
    variantId?: string,
  ) => Promise<TPArticleStockByWarehouse[]>;
  /**
   * Set de ids de líneas que están esperando respuesta del backend de
   * pricing. Mientras el id esté presente, la línea muestra un spinner
   * sobre el precio y deshabilita el chip de origen.
   */
  calculatingLineIds?: ReadonlySet<string>;
  /**
   * Setea (o limpia con `null`) el override manual de impuestos para una
   * línea. El parent dispara un refetch al backend que recalcula impuestos
   * y devuelve el `taxBreakdown` actualizado. El frontend NO calcula nada.
   */
  onSetLineTaxOverride?: (
    lineId: string,
    override: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null,
  ) => void;
  /**
   * Impuestos existentes del tenant (`salesTaxes`, ya cargados en
   * VentasFacturas vía `taxesApi.list()`). Alimentan el selector rápido del
   * label "Impuestos" de cada línea: elegir uno autocompleta el `taxOverride`
   * (PERCENT) con su `rate`. Solo UX — el contrato sigue siendo UN override por
   * línea; sin esto, el label es plano (comportamiento previo).
   */
  availableTaxes?: AvailableLineTax[];
  /**
   * Aplica un patch de overrides a la línea. Cada key es opcional; `null`
   * limpia ese override puntual. Backend recalcula y devuelve.
   */
  onApplyLineOverrides?: (
    lineId: string,
    patch: {
      taxOverride?:    { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null;
      manualPrice?:    number | null;
      // `kind` opcional (default BONUS para back-compat): "BONUS" resta,
      // "SURCHARGE" suma. El motor backend lo aplica; el frontend no calcula.
      manualDiscount?: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope; kind?: "BONUS" | "SURCHARGE" } | null;
      /** Override de SOLO la base ("Aplica a"), independiente del valor. */
      manualDiscountAppliesTo?: AppliesToScope | null;
      manualTaxAppliesTo?:      AppliesToScope | null;
    },
  ) => void;
  /**
   * Limpia TODOS los overrides manuales de la línea (precio + descuento +
   * impuesto). Backend vuelve a aplicar lista + reglas.
   */
  onClearLineOverrides?: (lineId: string) => void;
  /**
   * @deprecated — el simulador local fue eliminado. La prop queda solo para
   * compatibilidad de tipo con consumidores existentes; no tiene efecto.
   */
  enableLineSimulator?: boolean;
  /**
   * Slot opcional que el caller puede usar para renderizar contenido extra
   * debajo de la línea. El editor lo invoca para cada fila no vacía con
   * artículo cargado; el caller decide cuándo mostrar contenido (devolviendo
   * `null` cuando no debe pintar nada). El editor NO lo gatea con su propio
   * estado de expansión — el caller maneja visibilidad/toggle.
   *
   * Pensado para mostrar la composición Metal/Hechura del backend
   * (`<SaleLineCompositionDetail>` en Factura) sin meter lógica de pricing
   * específica de Ventas en este editor genérico.
   */
  renderLineExtras?: (line: DocumentLine, lineIndex: number) => React.ReactNode;
  /**
   * Slot opcional para un botón inline en la zona de acciones de cada fila.
   * Se renderiza entre el chevron de overrides y los íconos de acción.
   * El caller construye el botón (icono, tooltip, onClick, estado activo).
   * El editor solo provee el espacio. Las filas vacías no lo invocan.
   */
  renderLineExtraToggle?: (line: DocumentLine, lineIndex: number) => React.ReactNode;
  /**
   * Si true, la celda "Total línea" muestra `lineTotalWithTax` (provisto por
   * el backend) como valor principal y debajo un detalle pequeño con
   * subtotal e impuestos. Default false para no afectar Órdenes/Presupuestos
   * que comparten este componente. Pensado para Factura, donde el operador
   * espera ver el total con impuestos alineado con el total del documento.
   */
  showLineTotalWithTax?: boolean;
  /**
   * Orientación del panel de composición avanzada que se abre debajo de
   * cada línea (`LineAdvancedOverridesPanel`). `"sale"` lo deja con foco
   * en precio de venta (Factura). Default sin definir → `"cost"` en el
   * panel, preservando el comportamiento legacy de Presupuestos / Órdenes
   * / Compras.
   */
  compositionView?: "sale" | "cost";
  /**
   * Mapa `unitCode → unitName` para resolver el código técnico de la
   * unidad de medida (ej. "UND") a su nombre legible/comercial
   * ("Unidad", "Gramos", etc.) en el label de Cantidad y en los hints
   * (Mín. venta, Máx. venta, Stock).
   *
   * Cuando NO se pasa, el editor cae al code crudo (`picked.unitOfMeasure`),
   * preservando el comportamiento de pantallas legacy
   * (Presupuestos / Órdenes / Compras).
   */
  unitNameByCode?: Map<string, string>;
  /** Mapa `currencyId → { code, symbol }` del catálogo de monedas del
   *  tenant. Se propaga a `SaleCompositionEditableGrid` para que cuando
   *  un cost line tenga moneda distinta a la del documento, la celda
   *  "Costo unit." muestre el code original y el equivalente convertido.
   *  Opcional — si no se pasa, el comportamiento es idéntico al anterior. */
  currencyById?: Map<string, { code?: string | null; symbol?: string | null }>;
  /**
   * Modo controlado del panel avanzado por línea (`LineAdvancedOverridesPanel`).
   * Cuando el padre pasa este Set, el editor LEE de ahí para decidir si el
   * panel está abierto. Si además se pasa `onToggleAdvancedOpen`, el botón
   * de chevron interno delega el toggle al padre en lugar de mutar el state
   * interno. Pensado para Factura, donde "Expandir/Colapsar todo" debe
   * sincronizar tanto la fila principal como su panel avanzado.
   *
   * Sin estas props (default), el editor usa su state interno y otras
   * pantallas (Presupuestos / Órdenes / Compras) mantienen su comportamiento.
   */
  advancedOpenIds?: Set<string>;
  onToggleAdvancedOpen?: (lineId: string) => void;
  /**
   * Fase 2 — ajustes globales del documento (canal/cupón/pago/envío/desc.
   * global) que muestra `SaleCompositionEditableGrid` debajo de la tabla
   * cuando `compositionView === "sale"`. Passthrough puro del preview
   * backend. Cuando `compositionView !== "sale"` o no se pasa, se ignora.
   */
  saleGlobalAdjustments?: SaleGlobalAdjustments;
  /**
   * Fase 4.3 — true cuando hay un preview en vuelo. Se propaga al
   * `SaleCompositionEditableGrid` para mostrar un mini-spinner inline
   * en el header de la composición. Solo aplica cuando
   * `compositionView === "sale"`.
   */
  saleCompositionLoading?: boolean;
  /**
   * Etapa E2 — FIX FX para sub-líneas equivalentes ("≈ X / unidad") en
   * facturas no-base. Se propaga sin transformar a
   * `SaleCompositionEditableGrid` (passthrough). "Unidades de moneda BASE
   * por 1 unidad de la moneda del documento". En moneda base es 1.
   * Solo aplica cuando `compositionView === "sale"`.
   */
  documentFxRate?: number;
  /**
   * Modo de saldo del DOCUMENTO (`balanceMode` resuelto por el backend:
   * override del footer → cliente → preferencia → lista → tenant → unificado).
   * Cuando se provee (solo Factura, `compositionView="sale"`), la VISTA de cada
   * línea sigue este modo: el documento manda. Una línea con LISTA PROPIA por
   * línea conserva su modo; una línea sin datos de metal nunca se fuerza a
   * desglosada. SOLO presentación — los datos/cálculos no se tocan. `null`
   * (default) ⇒ back-compat: cada línea resuelve su vista por su propia lista.
   */
  documentBalanceMode?: "UNIFIED" | "BREAKDOWN" | null;
  /**
   * Énfasis visual del bloque "Total línea c/imp." — passthrough del
   * preset de Factura (UX.19). `"STANDARD"` mantiene el tamaño actual
   * (text-lg). `"EMPHASIZED"` agranda el monto y suma aire interno —
   * aprovecha el ancho extra de los layouts STACKED_FULL_WIDTH (CLASSIC)
   * donde las líneas son full-width y el Total puede respirar más.
   * Default `"STANDARD"` (cero cambio para callers existentes).
   */
  lineTotalEmphasis?: "STANDARD" | "EMPHASIZED";
  /**
   * Si `true`, la mini-toolbar de acciones de línea (expandir, restablecer,
   * eliminar, más opciones) se renderea INLINE al lado del label
   * "Total línea c/ imp." en lugar de debajo del bloque del total.
   *
   * Pensado para la plantilla CLÁSICA donde producto pidió las acciones
   * pegadas al importe (look ERP tradicional), independientemente del
   * énfasis tipográfico del total.
   *
   * Default: `false` (toolbar al pie del bloque, comportamiento histórico).
   * Cuando se pasa explícitamente, gana sobre la heurística antigua de
   * `lineTotalEmphasis === "EMPHASIZED"`.
   */
  inlineLineActions?: boolean;
  /**
   * Controla si la mini-toolbar de acciones de línea es sticky-right
   * durante scroll horizontal (UX.13). Default `true` para preservar
   * comportamiento histórico. Cuando `false`, el bloque del Total
   * (que contiene las acciones) se renderea sin las clases `lg:sticky`
   * — las acciones se desplazan con el scroll y pueden quedar fuera
   * de vista. Conectado al preset (CLASSIC = false) y al toggle del
   * usuario en Configuración (`invoiceUiPreferences.stickyActions`).
   */
  stickyLineActions?: boolean;

  /**
   * Fase A — política comercial.
   * Mapa `lineId → nivel` derivado del preview backend (`alerts` +
   * `policy.blockingAlerts`) por el helper `deriveCommercialLevel`. La
   * UI lo usa para pintar un borde lateral de color en cada fila
   * ARTICLE cuando el nivel ≠ "OK".
   *
   * Cero matemática — passthrough. Si no se provee, las filas se ven
   * con su estilo normal (compatible con consumidores que aún no
   * pasen este prop: Presupuestos / Órdenes / Compras).
   *
   * NOTA: para el refinamiento UX (chip + motivo + margen %), usar
   * `commercialInfoByLineId`. Este prop se mantiene como atajo legacy
   * cuando el caller solo necesita pintar el borde y no expone motivo.
   */
  commercialLevelByLineId?: Record<string, "OK" | "WARNING" | "RISK" | "CRITICAL">;

  /**
   * Refinamiento Fase A — política comercial enriquecida.
   * Mapa `lineId → { level, marginPercent, primaryMessage, primaryCode }`.
   * Si se provee, la fila renderea:
   *   1) borde lateral de color por nivel,
   *   2) chip compacto bajo el contenido con motivo + margen %,
   *   3) tooltip explicativo con todos los códigos del motor.
   *
   * Pricing-engine sigue siendo la única fuente de verdad: el caller
   * computa este shape con `deriveCommercialInfo` desde el preview, sin
   * matemática propia.
   */
  commercialInfoByLineId?: Record<string, {
    level:                    "OK" | "WARNING" | "RISK" | "CRITICAL";
    marginPercent:            number | null;
    /** Costo unitario calculado por el motor — para tooltip detallado. */
    unitCost?:                number | null;
    /** Precio unitario final — para tooltip detallado. */
    unitPrice?:               number | null;
    /** Margen recomendado del tenant — opcional. Si está, el chip lo
     *  muestra como referencia ("8% — recomendado 30%"). */
    recommendedMarginPercent?: number | null;
    primaryCode:              string | null;
    primaryMessage:           string | null;
    alertCodes:               string[];
  }>;
};

// ── Sub-componente: link compacto para elegir almacén con popover ─────────
// Internamente trabaja con `id` (canónico) y muestra `name` (lo que ve el
// usuario). Nunca expone el id en pantalla.
function WarehouseLinkPicker({
  warehouses,
  selectedId,
  onSelect,
  disabled,
  hasOverride,
  onClearOverride,
}: {
  warehouses: ReadonlyArray<{ id: string; name: string; qty: number }>;
  selectedId?: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** True si esta línea tiene `warehouseOverride=true`. Pinta badge "Línea". */
  hasOverride?: boolean;
  /** Callback opcional para "Usar almacén global" — limpia el override. */
  onClearOverride?: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const selectedName = warehouses.find((w) => w.id === selectedId)?.name;
  const label = selectedName || "Seleccionar almacén";
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-tp-enter="ignore"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={
          disabled
            ? "Seleccioná primero un artículo"
            : hasOverride
              ? "Almacén de esta línea (override)"
              : "Usa el almacén del documento"
        }
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] transition",
          disabled
            ? "cursor-not-allowed text-muted/60"
            : "text-primary hover:bg-primary/10 hover:underline",
        )}
      >
        <Warehouse size={11} className="shrink-0" />
        <span className={cn(!selectedName && "italic text-muted")}>{label}</span>
        {hasOverride && (
          <span className="ml-1 inline-flex items-center rounded border border-primary/40 bg-primary/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
            Línea
          </span>
        )}
        {!disabled && <ChevronDown size={10} className="text-muted" />}
      </button>
      <TPPopover open={open && !disabled} onClose={() => setOpen(false)} anchorRef={btnRef} width={260}>
        <div className="py-1.5">
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Elegí almacén
          </div>
          {/* Limpiar override: solo aparece si la línea tiene `warehouseOverride=true`
              y el caller proporcionó `onClearOverride`. Volver a usar el
              almacén del documento. */}
          {hasOverride && onClearOverride && (
            <button
              type="button"
              onClick={() => { onClearOverride(); setOpen(false); }}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-[11px] italic text-muted transition hover:bg-surface2/60"
            >
              Usar almacén global del documento
            </button>
          )}
          {warehouses.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted">Sin almacenes disponibles para este artículo.</div>
          )}
          {warehouses.map((w) => {
            const committed = w.qty > 1 ? Math.floor(w.qty * 0.25) : 0;
            const available = Math.max(0, w.qty - committed);
            const isSel = selectedId === w.id;
            const stockClass = w.qty > 0 ? "text-emerald-500" : "text-red-500";
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => { onSelect(w.id); setOpen(false); }}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-1.5 text-left transition hover:bg-surface2/60",
                  isSel && "bg-primary/10",
                )}
              >
                <Warehouse size={12} className={cn("mt-0.5 shrink-0", isSel ? "text-primary" : "text-muted")} />
                <div className="min-w-0 flex-1">
                  <div className={cn(
                    "text-[12px] font-semibold",
                    isSel ? "text-primary" : "text-text",
                  )}>
                    {w.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] tabular-nums">
                    <span className={cn("font-semibold", stockClass)}>Stock: {w.qty}</span>
                    {committed > 0 && (
                      <span className="text-muted">| Comprometido: {committed}</span>
                    )}
                    <span className="text-muted">| Disponible: <span className={cn("font-semibold", available > 0 ? "text-emerald-500" : "text-red-500")}>{available}</span></span>
                  </div>
                </div>
                {isSel && <Check size={12} className="mt-0.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </TPPopover>
    </>
  );
}

/**
 * T36 — Botón ⓘ contextual + popover elegante. Reemplaza los paneles
 * inline / expandidos que ocupaban espacio en el row. Ahora el detalle
 * financiero se consulta "on demand" haciendo click en el ícono junto al
 * input. Cada instancia tiene su propio state (TPPopover con anchorRef).
 *
 * Reglas:
 *   · Click toggle (abre / cierra).
 *   · Click-outside cierra (TPPopover lo maneja).
 *   · No empuja el row, no agranda la celda.
 *   · Si `hasContent === false`, no renderiza nada (la celda queda limpia
 *     cuando no hay info que mostrar).
 */
function LineInfoPopover({
  hasContent,
  ariaLabel,
  children,
  width = 320,
}: {
  hasContent: boolean;
  ariaLabel: string;
  children: React.ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  if (!hasContent) return null;
  return (
    <>
      {/* Botón ⓘ → ❓ minimal: el ícono pasó de `Info` (ⓘ) a `HelpCircle` (❓)
          para reforzar la semántica de AYUDA contextual (no de alerta).
          La regla del repo: "!" = riesgo real (warning comercial),
          "?" = explicación contextual. Hover sutil con bg + color, sin
          geometría extra (sin border que produzca "doble círculo"). */}
      <button
        ref={btnRef}
        type="button"
        data-tp-line-info-btn="true"
        data-tp-enter="ignore"
        // TAB lo saltea — es un disparador OPCIONAL de ayuda contextual,
        // no parte del flujo de captura. El operador alto-volumen pasa
        // de input editable a input editable sin tener que tabular por
        // adornments. Accesible vía mouse/click/touch normalmente.
        tabIndex={-1}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        title={ariaLabel}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          // Idle más sutil + hover más visible — comunica que es opcional
          // sin competir con warnings comerciales reales.
          "text-muted/60 transition-all duration-150",
          "hover:bg-surface2/60 hover:text-text",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          open && "bg-surface2/60 text-text",
        )}
      >
        <HelpCircle size={14} strokeWidth={2} />
      </button>
      <TPPopover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} width={width}>
        {/* T37 — Popover con botón ✕ flotando arriba-derecha. Click cierra
            (botón outside del scroll del contenido, siempre accesible). */}
        <div className="relative rounded-xl px-3 py-3">
          <button
            type="button"
            data-tp-enter="ignore"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            title="Cerrar"
            className={cn(
              "absolute right-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md",
              "text-muted/70 transition-colors duration-150",
              "hover:bg-surface2/60 hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
          >
            <X size={12} strokeWidth={2.2} />
          </button>
          {/* Padding-right para que el contenido no quede tapado por la ✕. */}
          <div className="pr-5">
            {children}
          </div>
        </div>
      </TPPopover>
    </>
  );
}

/**
 * Picker compacto inline para entidades a nivel DOCUMENTO (Lista de precios /
 * Canal). Vive en la línea por proximidad visual, pero el cambio APLICA AL
 * DOCUMENTO ENTERO — el header/tooltip lo aclara para evitar la expectativa
 * de override por línea (que el motor hoy no soporta).
 */
// Picker per-línea de lista de precios. Distinto del DocumentScopePicker
// porque su scope es UNA línea: el clearable (`Usar lista global`) limpia el
// override y la línea vuelve a usar la lista del documento. La opción
// elegida se guarda como `line.priceListIdOverride` y tiene precedencia
// sobre `document.priceListId` (resuelto por el motor del backend).
function LineScopePricelistPicker({
  selectedName,
  globalListName,
  options,
  hasOverride,
  overrideId,
  onSelect,
  disabled,
}: {
  selectedName?: string | null;
  globalListName?: string | null;
  options: ReadonlyArray<{ id: string; name: string }>;
  hasOverride: boolean;
  overrideId?: string | null;
  onSelect: (priceListId: string | null) => void;
  disabled?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // Opción ACTIVA (display-only — NO cambia la lógica de selección):
  //   · con override de línea → la opción cuyo id == overrideId.
  //   · sin override → la lista global efectivamente aplicada (match por nombre
  //     contra `selectedName`, que el call-site ya resuelve como la lista que
  //     el motor aplicó). Sirve para destacar "cuál está aplicada" en ambos casos.
  const activeOptionId: string | null = hasOverride
    ? (overrideId ?? null)
    : (selectedName ? (options.find((o) => o.name === selectedName)?.id ?? null) : null);

  // Al abrir, llevamos la opción activa a la vista (aprox. "abrir sobre la
  // seleccionada" sin reposicionar el popover — cero riesgo de layout).
  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  const display = selectedName || (globalListName ?? "Sin lista");
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted">Lista:</span>
      <button
        ref={btnRef}
        type="button"
        data-tp-enter="ignore"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={hasOverride ? "Lista de esta línea (override)" : "Usa la lista del documento"}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0 text-[11px] font-semibold transition",
          disabled
            ? "cursor-not-allowed text-muted/60"
            : selectedName
              ? "text-primary hover:bg-primary/10 hover:underline"
              : "italic text-muted/70 hover:bg-surface2/60",
        )}
      >
        <span>{display}</span>
        {hasOverride && (
          <span className="ml-1 inline-flex items-center rounded border border-primary/40 bg-primary/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-primary">
            Línea
          </span>
        )}
        {!disabled && <ChevronDown size={10} className="text-muted" />}
      </button>
      <TPPopover open={open && !disabled} onClose={() => setOpen(false)} anchorRef={btnRef} width={260}>
        <div className="py-1.5" role="menu">
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Lista de precios
          </div>
          {/* Listas reales disponibles — PRIMARIO. La activa (override de línea
              o lista global efectivamente aplicada) va destacada. Elegir una
              llama `onSelect(id)` igual que antes (sin cambios de lógica). */}
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted">Sin listas disponibles.</div>
          ) : (
            options.map((o) => {
              const isSel = activeOptionId != null && activeOptionId === o.id;
              return (
                <button
                  key={o.id}
                  ref={isSel ? activeRef : undefined}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSel}
                  onClick={() => { onSelect(o.id); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-surface2/60",
                    isSel && "bg-primary/10",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "text-[12px] font-semibold",
                      isSel ? "text-primary" : "text-text",
                    )}>
                      {o.name}
                    </div>
                  </div>
                  {isSel && <Check size={12} className="text-primary" />}
                </button>
              );
            })
          )}
          {/* SECUNDARIO — volver a la lista global del encabezado. NO es una
              lista más: vive bajo un divisor, con copy explícito y estilo
              atenuado. `onSelect(null)` limpia el override (lógica intacta). */}
          <div className="my-1 border-t border-border/40" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!hasOverride}
            onClick={() => { onSelect(null); setOpen(false); }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-surface2/60",
              !hasOverride && "bg-surface2/40",
            )}
            title="Vuelve a usar la lista de precios definida en el encabezado del documento"
          >
            <RotateCcw size={11} className="text-muted/70 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted">
                Usar lista global del encabezado
              </div>
              {globalListName && (
                <div className="text-[10px] italic text-muted/70 truncate">{globalListName}</div>
              )}
            </div>
            {!hasOverride && (
              <span className="rounded border border-border/50 bg-surface2/60 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted shrink-0">
                Actual
              </span>
            )}
          </button>
        </div>
      </TPPopover>
    </span>
  );
}

function DocumentScopePicker({
  label,
  selectedName,
  options,
  selectedId,
  onSelect,
  emptyText,
  pickerTitle,
  disabled,
  clearable,
}: {
  label: string;
  selectedName?: string | null;
  options: ReadonlyArray<{ id: string; name: string }>;
  selectedId?: string;
  onSelect: (id: string) => void;
  emptyText: string;
  pickerTitle: string;
  disabled?: boolean;
  /** Si está, agrega como primera opción "Sin <X>" — al elegirla se invoca `onSelect("")`. */
  clearable?: { label: string };
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const display = selectedName || emptyText;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted">{label}:</span>
      <button
        ref={btnRef}
        type="button"
        data-tp-enter="ignore"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={`${pickerTitle} — aplica a toda la factura`}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0 text-[11px] font-semibold transition",
          disabled
            ? "cursor-not-allowed text-muted/60"
            : selectedName
              ? "text-primary hover:bg-primary/10 hover:underline"
              : "italic text-muted/70 hover:bg-surface2/60",
        )}
      >
        <span>{display}</span>
        {!disabled && <ChevronDown size={10} className="text-muted" />}
      </button>
      <TPPopover open={open && !disabled} onClose={() => setOpen(false)} anchorRef={btnRef} width={240}>
        <div className="py-1.5">
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {pickerTitle}
          </div>
          <div className="px-3 pb-1 text-[10px] italic text-muted/70">
            Aplica a toda la factura.
          </div>
          {clearable && (
            <button
              type="button"
              onClick={() => { onSelect(""); setOpen(false); }}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-1.5 text-left transition hover:bg-surface2/60",
                !selectedId && "bg-primary/10",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className={cn(
                  "text-[12px] italic",
                  !selectedId ? "text-primary font-semibold" : "text-muted",
                )}>
                  {clearable.label}
                </div>
              </div>
              {!selectedId && <Check size={12} className="mt-0.5 text-primary" />}
            </button>
          )}
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted">{emptyText}</div>
          ) : (
            options.map((o) => {
              const isSel = selectedId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onSelect(o.id); setOpen(false); }}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-1.5 text-left transition hover:bg-surface2/60",
                    isSel && "bg-primary/10",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "text-[12px] font-semibold",
                      isSel ? "text-primary" : "text-text",
                    )}>
                      {o.name}
                    </div>
                  </div>
                  {isSel && <Check size={12} className="mt-0.5 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </TPPopover>
    </span>
  );
}

// ── Sub-componente: textarea auto-grow para la descripción de la línea ───
// Crece en altura a medida que el usuario escribe / presiona Enter.
function LineDescriptionTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autoSize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoSize(taRef.current);
  }, [value]);

  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={(e) => autoSize(e.currentTarget)}
      placeholder="Agregar descripción…"
      rows={1}
      data-tp-enter="ignore"
      className="w-full resize-none overflow-hidden rounded-md border border-border/30 bg-transparent px-2.5 pt-0.5 pb-1 text-[11px] leading-5 text-muted/90 outline-none transition placeholder:text-muted/50 hover:border-border/60 focus:border-primary/40 focus:text-text"
    />
  );
}

type PriceChipTone = "info" | "warning" | "success" | "primary" | "danger" | "neutral";
type PriceChip = { label: string; tone: PriceChipTone; subtitle?: string; tooltip?: string };

/**
 * Deriva el chip de origen del precio leyendo `line.pricingMeta` (real, del
 * backend) primero. Si no hay meta, cae al heurístico legacy basado en el
 * artículo del catálogo y el simulado.
 *
 * Mapping de `priceSource` (alineado con backend):
 *   PROMOTION         → "Promo"
 *   QUANTITY_DISCOUNT → "Cantidad"
 *   PRICE_LIST        → "Lista"
 *   MANUAL_OVERRIDE   → "Manual"
 *   MANUAL_FALLBACK   → "Manual" (fallback del backend cuando no encontró)
 *   VARIANT_OVERRIDE  → "Variante"
 *   NONE              → null (sin chip)
 *
 * Si `partial === true`, se prioriza el chip "Parcial" (cálculo local porque
 * el backend no resolvió o cayó la red).
 */
function derivePriceChip(
  line: DocumentLine,
  picked: TPArticleLite | undefined,
): PriceChip | null {
  const meta = line.pricingMeta;
  if (meta) {
    if (meta.partial) {
      return {
        label:   "Parcial",
        tone:    "warning",
        tooltip: "Se usó cálculo local porque no se pudo obtener el precio del backend.",
      };
    }
    const src = meta.priceSource ?? "";
    if (src === "PROMOTION" || src === "PROMO") {
      return {
        label:    "Promo",
        tone:     "success",
        // Dedupe T24: el chip ya dice "Promo"; el subtitle muestra SÓLO el
        // nombre de la promo ("Verano 2026"), no "Promo: Verano 2026".
        subtitle: meta.appliedPromotionName ?? undefined,
      };
    }
    if (src === "QUANTITY_DISCOUNT") {
      return { label: "Cantidad", tone: "success" };
    }
    if (src === "PRICE_LIST" || src === "LIST") {
      return {
        label:    "Lista",
        tone:     "info",
        subtitle: meta.appliedPriceListName ? `Lista: ${meta.appliedPriceListName}` : undefined,
      };
    }
    if (src === "VARIANT_OVERRIDE") {
      return { label: "Variante", tone: "info" };
    }
    if (src === "MANUAL_OVERRIDE" || src === "MANUAL_FALLBACK" || src === "MANUAL") {
      return { label: "Precio manual", tone: "warning" };
    }
    if (src === "COMBO_COMPONENTS") {
      // Combo comercial — precio derivado de la suma de sus componentes.
      return { label: "Combo", tone: "info" };
    }
    // Si llegó pricingMeta pero priceSource es desconocido / NONE → sin chip.
    return null;
  }

  // Sin pricingMeta — heurístico legacy.
  if (!picked) return { label: "Manual", tone: "warning" };
  if (picked.code?.startsWith("PROMO")) return { label: "Promo", tone: "success" };
  if (typeof picked.price === "number" && Math.abs(picked.price - line.unitPrice) < 0.01) {
    return { label: "Lista", tone: "info" };
  }
  return { label: "Manual", tone: "warning" };
}

// ── Selector "Aplica a" para Bonificación / Impuestos ───────────────────
// Antes usaba un <select> nativo con estilos del SO, lo que generaba un
// dropdown blanco difícil de leer en tema oscuro. Ahora usa TPPopover
// (mismo componente que el Almacén/Lista/Canal del header), heredando
// fondo del card, borde sutil, hover, opción seleccionada con check y
// z-index manejado por portal.
// Dominio completo de "Aplica a" — alineado con los enums del backend
// (Prisma `TaxApplyOn` = 6 valores; `CommercialApplyOn` = 4 valores). El
// frontend NO inventa: muestra exactamente lo que el motor soporta.
// PRODUCT/SERVICE se conservan en el tipo por compat de datos viejos
// (`composition`/meta) pero NO se ofrecen en los combos.
type AppliesToScope =
  | "TOTAL"
  | "METAL"
  | "HECHURA"
  | "METAL_Y_HECHURA"
  | "SUBTOTAL_AFTER_DISCOUNT"
  | "SUBTOTAL_BEFORE_DISCOUNT"
  | "PRODUCT"
  | "SERVICE";
// Labels claros y consistentes con Configuración → Impuestos. Sin nombres
// técnicos (nada de "METAL_Y_HECHURA" en pantalla).
const APPLIES_TO_LABELS: Record<AppliesToScope, string> = {
  TOTAL:                    "Total",
  METAL:                    "Solo metal",
  HECHURA:                  "Solo hechura",
  METAL_Y_HECHURA:          "Metal + Hechura",
  SUBTOTAL_AFTER_DISCOUNT:  "Subtotal después del descuento",
  SUBTOTAL_BEFORE_DISCOUNT: "Subtotal antes del descuento",
  PRODUCT:                  "Producto",
  SERVICE:                  "Servicio",
};
// ── Decisión funcional (temporal) ───────────────────────────────────────────
// El combo "Aplica a" se limita a 3 opciones simples: Total / Solo metal /
// Solo hechura. Las bases avanzadas (METAL_Y_HECHURA, SUBTOTAL_*, PRODUCT,
// SERVICE) NO se ofrecen en la UI por ahora — el backend las sigue
// soportando (datos viejos / tests) pero no son seleccionables.
// `SIMPLE_SCOPES` es la fuente única de lo que la UI permite elegir.
const SIMPLE_SCOPES = ["TOTAL", "METAL", "HECHURA"] as const;
// Orden canónico de presentación (el AppliesToLink filtra/ordena por esto).
const APPLIES_TO_ORDER: AppliesToScope[] = ["TOTAL", "METAL", "HECHURA"];

/**
 * Scopes seleccionables para una línea (UI). Limitado a las 3 simples:
 *   · TOTAL siempre.
 *   · METAL / HECHURA solo si la línea tiene esa composición (no ofrecer
 *     "Solo metal" en una línea sin metal).
 * `kind` se conserva por compat de firma; ya no diferencia (ambos = 3).
 */
function getAvailableScopes(
  line: DocumentLine,
  _kind: "TAX" | "DISCOUNT" = "TAX",
): AppliesToScope[] {
  const comp = line.pricingMeta?.composition;
  const out: AppliesToScope[] = ["TOTAL"];
  if (comp?.metal)   out.push("METAL");
  if (comp?.hechura) out.push("HECHURA");
  return out;
}

/**
 * AppliesToLink — link compacto "Aplica a: Total ▾" debajo del input.
 * Al click abre un TPPopover con las opciones disponibles en la línea
 * (filtradas por composición). Usa colores del tema y marca la opción
 * seleccionada.
 */
function AppliesToLink({
  value,
  onChange,
  disabled,
  prefix,
  scopes,
}: {
  value:     AppliesToScope;
  onChange:  (v: AppliesToScope) => void;
  disabled?: boolean;
  /** Texto antes del valor. Default "Aplica a:". */
  prefix?:   string;
  /** Scopes visibles. Si se omite se listan todos. TOTAL siempre va. */
  scopes?:   ReadonlyArray<AppliesToScope>;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const visible: AppliesToScope[] = (() => {
    if (!scopes || scopes.length === 0) {
      return APPLIES_TO_ORDER;
    }
    const set = new Set<AppliesToScope>(["TOTAL", ...scopes]);
    return APPLIES_TO_ORDER.filter((k) => set.has(k));
  })();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-tp-enter="ignore"
        // Fuera del flujo Tab principal de la línea (campos numéricos):
        // el "Aplica a:" es secundario y se accede con click. Esto evita
        // que Tab desde Cantidad pase por este link antes de llegar a
        // Bonificación/Impuestos.
        tabIndex={-1}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        title="Cambiar a qué componente aplica"
        className={cn(
          "inline-flex items-center gap-1 rounded text-[10px] transition",
          disabled
            ? "cursor-not-allowed text-muted/60"
            : "cursor-pointer text-muted hover:text-text hover:underline",
        )}
      >
        <span>{prefix ?? "Aplica a:"}</span>
        <span className="font-semibold">{APPLIES_TO_LABELS[value]}</span>
        <ChevronDown size={9} className="opacity-70" />
      </button>
      <TPPopover open={open && !disabled} onClose={() => setOpen(false)} anchorRef={btnRef} width={170}>
        <ul className="py-1">
          {visible.map((k) => {
            const isSel = value === k;
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => { onChange(k); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] transition hover:bg-surface2/60",
                    isSel ? "bg-primary/10 text-primary font-semibold" : "text-text",
                  )}
                >
                  <span>{APPLIES_TO_LABELS[k]}</span>
                  {isSel && <Check size={11} className="text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </TPPopover>
    </>
  );
}

export function TPDocumentLineAdvancedEditor({
  lines,
  updateLine,
  removeLine,
  duplicateLine,
  currency,
  displayRate = 1,
  warehouseId,
  priceListId,
  priceListName,
  priceListOptions,
  channelOptions,
  channelId,
  onChangePriceList,
  onChangeChannel,
  channelName,
  showTax = true,
  reorderLines,
  isReorderable,
  expandedIds: expandedIdsProp,
  onToggleExpand: onToggleExpandProp,
  onEditArticle,
  onResetLine,
  onCreateManualLine,
  viewMode = "unified",
  headerSubtotals,
  onArticlePicked,
  focusedLineId,
  focusSignal,
  articleSearch,
  articleExactLookup,
  onArticleNoExactMatch,
  onArticleMultipleExactMatches,
  warehouses,
  pickedItemsByLineId,
  articleStockBreakdown,
  calculatingLineIds,
  onSetLineTaxOverride,
  availableTaxes,
  onApplyLineOverrides,
  onClearLineOverrides,
  enableLineSimulator = false,
  renderLineExtras,
  renderLineExtraToggle,
  showLineTotalWithTax = false,
  compositionView,
  documentBalanceMode = null,
  advancedOpenIds: advancedOpenIdsProp,
  onToggleAdvancedOpen,
  unitNameByCode,
  currencyById,
  onChangeLinePriceList,
  saleGlobalAdjustments,
  saleCompositionLoading,
  documentFxRate,
  lineTotalEmphasis = "STANDARD",
  inlineLineActions,
  stickyLineActions = true,
  commercialLevelByLineId,
  commercialInfoByLineId,
}: TPDocumentLineAdvancedEditorProps) {
  /** fmtMoney con conversión visual aplicada.
   *  `displayRate` = unidades de moneda base por 1 unidad de la moneda
   *  elegida (ARS por USD). Se DIVIDE para expresar el amount en base
   *  como amount en la moneda del documento. */
  const mFmt = (amount: number) => fmtMoney((amount ?? 0) / displayRate, currency);

  /** Factor que lleva un monto YA expresado en la moneda mostrada a su
   *  equivalente en moneda BASE del tenant. Se usa SOLO para los cortes de
   *  visibilidad de filas/bloques del Resumen Comercial (umbral "es ~0"), para
   *  que el detalle muestre las mismas filas en moneda base y en cualquier otra
   *  moneda. `documentFxRate` = unidades base por 1 unidad de la moneda del
   *  documento (1 si es base); `displayRate` se trunca a 1 cuando el backend ya
   *  convirtió, por eso el factor combina ambos:
   *    · backend convirtió (USD): documentFxRate=446, displayRate=1 → 446
   *    · moneda base:             1 / 1 → 1
   *    · legacy sin convertir:    446 / 446 → 1
   *  NO afecta ningún monto mostrado (eso lo hace `mFmt`); solo el corte de
   *  visibilidad. Con factor = 1 (moneda base) el comportamiento es idéntico al
   *  histórico. Cero matemática comercial. */
  const visibilityBaseFactor = (() => {
    const dr = Number.isFinite(displayRate) && displayRate > 0 ? displayRate : 1;
    const fx =
      typeof documentFxRate === "number" && Number.isFinite(documentFxRate) && documentFxRate > 0
        ? documentFxRate
        : 1;
    return fx / dr;
  })();

  // T34 — Renderiza el panel de detalle fiscal de una línea (header
  // impuesto + base imponible + monto + desglose multi-impuesto).
  // El cómputo se hace independiente del IIFE de la celda Impuestos
  // para permitir renderizarlo en la zona expandida común debajo del
  // row (T34). Si la línea es exenta / sin impuesto / sin override, no
  // renderiza nada. POLICY R6 — todas las lecturas son passthrough del
  // motor; cero matemática nueva.
  const renderLineTaxDetailPanel = (l: DocumentLine): React.ReactNode => {
    const meta = l.pricingMeta;
    const exempt = meta?.taxExemptByEntity === true;
    const override = meta?.taxOverride ?? null;
    const taxZeroed = isTaxClearedOverride(override);
    if (exempt || taxZeroed) return null;
    const taxLineTotal =
      typeof l.taxAmount === "number" && Number.isFinite(l.taxAmount)
        ? l.taxAmount
        : 0;
    if (taxLineTotal <= 0 && !(override && override.value > 0)) return null;

    const qty = Number.isFinite(l.quantity) ? l.quantity : 0;
    const compTaxes = (meta as any)?.composition?.taxes ?? null;
    const taxBreakdown = meta?.taxBreakdown ?? [];
    type DisplayTax = { name: string; rate: number | null; applyOn: string | null; amount: number | null };
    const displayItems: DisplayTax[] = compTaxes && compTaxes.length > 0
      ? compTaxes.map((t: any) => ({
          name:    t.name,
          rate:    typeof t.rate === "number" ? t.rate : null,
          applyOn: t.appliesTo ?? null,
          amount:  typeof t.taxAmount === "number" ? t.taxAmount * qty : null,
        }))
      : taxBreakdown.map((t: any) => ({
          name:    t.name,
          rate:    typeof t.rate === "number" ? t.rate : null,
          applyOn: null,
          amount:  null,
        }));
    const fmtPctLocal = (n: number) => `${formatByType(n, "TAX_PERCENT", { bare: true })}%`;
    const labelForApplyOnLocal = (a: string | null | undefined) =>
      a === "METAL" ? " (sobre metal)" : a === "HECHURA" ? " (sobre hechura)" : "";

    const isManual = !!(override && override.value > 0);
    const headerTax = displayItems.length === 1
      ? `${displayItems[0].name}${displayItems[0].rate != null ? ` ${fmtPctLocal(displayItems[0].rate)}` : ""}${labelForApplyOnLocal(displayItems[0].applyOn)}`
      : displayItems.length > 1
        ? "Impuestos (varios)"
        : "Impuesto";
    const headerLabel = isManual ? `Manual · ${headerTax}` : headerTax;
    const taxRowLabel = displayItems.length === 1 && displayItems[0].name
      ? displayItems[0].name
      : displayItems.length > 1 ? "Impuestos" : "Impuesto";
    const subtotalNet = typeof l.subtotal === "number" && Number.isFinite(l.subtotal)
      ? l.subtotal
      : (typeof l.lineTotal === "number" && Number.isFinite(l.lineTotal) ? l.lineTotal : null);
    const taxTooltip = displayItems.length > 1
      ? displayItems
          .map((t) => `${t.name}${t.rate != null ? ` ${fmtPctLocal(t.rate)}` : ""}${labelForApplyOnLocal(t.applyOn)}`)
          .join(" · ")
      : undefined;
    return (
      <div
        data-tp-line-tax-summary-panel="true"
        className="space-y-1.5 rounded-md border border-border/30 bg-surface2/20 px-3 py-2.5"
      >
        <div
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide leading-tight",
            isManual
              ? "text-amber-600 dark:text-amber-400"
              : "text-text/85",
          )}
          title={taxTooltip}
        >
          {headerLabel}
        </div>
        <div className="space-y-0.5">
          {subtotalNet != null && (
            <div className="flex items-baseline justify-between gap-2 text-[10px] leading-tight">
              <span className="text-muted">Base imponible</span>
              <span className="tabular-nums text-text/85">{mFmt(subtotalNet)}</span>
            </div>
          )}
          {taxLineTotal > 0 && (
            <div className="flex items-baseline justify-between gap-2 text-[10px] leading-tight">
              <span className="text-muted">{taxRowLabel}</span>
              <span className="tabular-nums text-text/85">{mFmt(taxLineTotal)}</span>
            </div>
          )}
        </div>
        {displayItems.length > 1 && (
          <div className="flex flex-col gap-0.5 rounded-md border border-border/30 bg-surface2/20 px-1.5 py-1">
            {displayItems.every((t) => t.rate == null && t.amount == null) ? (
              <div className="text-[10px] italic text-muted">Impuestos varios</div>
            ) : (
              displayItems.map((t, i) => {
                const applyOnLabel =
                  t.applyOn === "METAL"   ? "Solo metal"   :
                  t.applyOn === "HECHURA" ? "Solo hechura" :
                  "Total";
                return (
                  <div key={`${t.name}-${i}`} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2 text-[10px] leading-tight">
                      <span className="min-w-0 truncate text-text/85">
                        {t.name}
                        {t.rate != null && (
                          <span className="ml-1 text-muted">{fmtPctLocal(t.rate)}</span>
                        )}
                      </span>
                      {t.amount != null && (
                        <span className="shrink-0 tabular-nums font-semibold text-amber-500">
                          +{mFmt(t.amount)}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-muted/70">Aplica en: {applyOnLabel}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  // Mantiene en memoria el artículo seleccionado por línea (para chip de
  // origen y stock por almacén). No se persiste en DocumentLine.
  const [pickedById, setPickedById] = useState<Map<string, TPArticleLite>>(() => new Map());

  // Panel "Ajustes avanzados" abierto por línea. Estado local — no
  // persiste. Se cierra automáticamente cuando se limpian los overrides.
  // Modo controlado opcional: si el padre pasa `advancedOpenIds` +
  // `onToggleAdvancedOpen`, el editor LEE de ese Set y delega el toggle
  // al callback. Sin esas props, fallback al state interno (otras pantallas).
  const [internalAdvancedOpenIds, setInternalAdvancedOpenIds] = useState<Set<string>>(() => new Set());
  const advancedOpenIds = advancedOpenIdsProp ?? internalAdvancedOpenIds;
  // Setter "interno" — solo se usa cuando el padre NO controla. Cuando el
  // padre controla, el toggle se delega vía `onToggleAdvancedOpen`.
  const setAdvancedOpenIds = setInternalAdvancedOpenIds;
  function toggleAdvancedOpen(id: string) {
    if (onToggleAdvancedOpen) {
      onToggleAdvancedOpen(id);
      return;
    }
    setInternalAdvancedOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Estado del lightbox de imágenes (se abre al click en thumbnail).
  const [lightbox, setLightbox] = useState<{ images: string[]; alt: string } | null>(null);
  // Modo controlado: si el padre pasa `expandedIds`, lo usamos. Si no, fall
  // back a state interno.
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(() => new Set());
  const expandedIds = expandedIdsProp ?? internalExpandedIds;

  // Auto-poblar `pickedById` para líneas que vienen con `articleId` cargado
  // desde afuera (quick-add / escáner / restaurar borrador). Así la fila
  // muestra el código, stock por almacén, chip Lista/Manual, etc., sin
  // esperar que el usuario re-seleccione manualmente.
  //
  // Fuente primaria: `pickedItemsByLineId` que el padre mantiene con los
  // TPArticleLite reales agregados (production data). Fallback: MOCK_ARTICLES
  // por id (legacy / tests).
  //
  // Para líneas pobladas vía este path también disparamos
  // `enrichWithStockByWarehouse` para que el bloque "Stock por almacén"
  // tenga los datos reales — `handlePickArticle` (combo de línea) ya lo
  // hace cuando se elige por la UI; acá replicamos para los demás flujos.
  useEffect(() => {
    let updates: Array<[string, TPArticleLite]> = [];
    for (const l of lines) {
      if (!l.articleId) continue;
      if (pickedById.has(l.id)) continue;
      const fromParent = pickedItemsByLineId?.get(l.id);
      if (fromParent) {
        updates.push([l.id, fromParent]);
        continue;
      }
      const fromMocks = MOCK_ARTICLES.find((a) => a.id === l.articleId);
      if (fromMocks) updates.push([l.id, fromMocks]);
    }
    if (updates.length === 0) return;
    setPickedById((prev) => {
      const next = new Map(prev);
      for (const [id, art] of updates) next.set(id, art);
      return next;
    });
    // Fetch stock por almacén para cada ítem recién populado (no-op si
    // `articleStockBreakdown` no fue pasado).
    for (const [id, art] of updates) enrichWithStockByWarehouse(id, art);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, pickedItemsByLineId]);
  // Modo UI de descuento e IVA por línea: "amount" (importe en moneda) o
  // "percent" (% sobre la base). El backend SIEMPRE recibe el valor en moneda
  // (l.discountAmount / l.taxAmount). Este modo es sólo de presentación —
  // cuando el usuario tipea con type=percent, convertimos a importe al guardar.
  type AdjFieldType = "amount" | "percent";
  const [discountTypeById, setDiscountTypeById] = useState<Map<string, AdjFieldType>>(() => new Map());
  const [taxTypeById,      setTaxTypeById]      = useState<Map<string, AdjFieldType>>(() => new Map());

  // Default UX: tanto descuento como IVA arrancan en "porcentaje". El usuario
  // puede togglear a "importe" desde el botón %/$ en cada línea.
  function getDiscountType(id: string): AdjFieldType { return discountTypeById.get(id) ?? "percent"; }
  function getTaxType(id: string):      AdjFieldType { return taxTypeById.get(id)      ?? "percent"; }
  function setDiscountType(id: string, t: AdjFieldType) {
    setDiscountTypeById((prev) => { const next = new Map(prev); next.set(id, t); return next; });
  }
  function setTaxType(id: string, t: AdjFieldType) {
    setTaxTypeById((prev) => { const next = new Map(prev); next.set(id, t); return next; });
  }

  // Estado local de "Aplica a" para Bonificación e Impuestos. Default
  // "TOTAL". Cuando cambia (o cuando el usuario edita el monto) se manda
  // al backend como parte del override.
  const [discountAppliesToById, setDiscountAppliesToById] = useState<Map<string, AppliesToScope>>(() => new Map());
  const [taxAppliesToById,      setTaxAppliesToById]      = useState<Map<string, AppliesToScope>>(() => new Map());

  // Estado OPTIMISTA del kind (Bonificación / Recargo) por línea. Toma
  // precedencia sobre `pricingMeta.manualDiscount.kind` durante la ventana
  // entre el click del operador y la llegada del preview backend (que
  // pasa por debounce + fetch + hidratación). Sin esto, el operador veía
  // el kind viejo durante varios cientos de ms tras elegir una opción.
  //
  // Ciclo de vida:
  //  · `selectKind` setea `optimistic[lineId] = nextKind` ANTES del patch.
  //  · El render usa esta cascada de prioridad:
  //      optimistic[lineId] → md.kind → inheritedKind → "BONUS".
  //  · Cuando el preview vuelve y `md.kind` ya coincide con el optimistic,
  //    el useEffect de sincronización borra la entrada (evita stale).
  //  · La X (limpiar override) borra el optimistic explícitamente.
  //  · Líneas eliminadas / artículo cambiado → cleanup global limpia.
  const [optimisticKindByLineId, setOptimisticKindByLineId] = useState<Map<string, "BONUS" | "SURCHARGE">>(() => new Map());
  function getOptimisticKind(id: string): "BONUS" | "SURCHARGE" | undefined {
    return optimisticKindByLineId.get(id);
  }
  function setOptimisticKind(id: string, k: "BONUS" | "SURCHARGE") {
    setOptimisticKindByLineId((prev) => {
      if (prev.get(id) === k) return prev;
      const next = new Map(prev);
      next.set(id, k);
      return next;
    });
  }
  function clearOptimisticKind(id: string) {
    setOptimisticKindByLineId((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  // T5 — Cards de Impuestos colapsibles por línea (paridad con
  // <SaleLineDiscountSummary>). El input + selector %/$ siempre visible;
  // el detalle (breakdown multi-impuesto / total +$X) se abre con el
  // chevron. Default cerrado. Estado local — el preview ignora esto.
  const [openTaxDetailLineIds, setOpenTaxDetailLineIds] = useState<Set<string>>(() => new Set());
  function isTaxDetailOpen(id: string): boolean {
    return openTaxDetailLineIds.has(id);
  }
  function toggleTaxDetailOpen(id: string) {
    setOpenTaxDetailLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Detalle de composición del Resumen Comercial por línea (Total línea c/imp.).
  // Default COLAPSADO: en listas desglosadas el resumen muestra METALES (gramos
  // agregados) + MONETARIO; el detalle por metal padre (Oro/Plata/…) vive detrás
  // de "Ver detalle". Solo estado de UI — cero lógica de negocio.
  const [openCompositionDetailLineIds, setOpenCompositionDetailLineIds] = useState<Set<string>>(() => new Set());
  function isCompositionDetailOpen(id: string): boolean {
    return openCompositionDetailLineIds.has(id);
  }
  function toggleCompositionDetailOpen(id: string) {
    setOpenCompositionDetailLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // T36 — `openBonifDetailLineIds` eliminado: el detalle de Bonificación
  // ahora vive en un popover contextual con state interno (TPPopover).

  // Dropdown del selector de KIND (Bonificación / Recargo) por línea.
  // Solo un dropdown abierto a la vez en todo el editor — el id de la línea
  // activa basta. `null` significa "ninguno abierto". Click-outside y Escape
  // cierran. El dropdown vive en el header de la celda "Bonificación".
  const [openKindMenuLineId, setOpenKindMenuLineId] = useState<string | null>(null);
  // Ref del contenedor del dropdown abierto, para click-outside. Se setea
  // desde el render de la celda activa.
  const kindMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (openKindMenuLineId == null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const node = kindMenuRef.current;
      if (!node) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // El trigger del mismo dropdown lleva `data-kind-menu-trigger`. Si el
      // click cae sobre el trigger, NO cerramos acá: dejamos que su `onClick`
      // decida (toggle / re-open). Sin este guard, mousedown global cierra
      // PRIMERO y onClick lee `isKindMenuOpen=true` del closure → vuelve a
      // setear `null` → el menú queda cerrado y el operador percibe que "no
      // responde" al segundo click.
      if (target.closest("[data-kind-menu-trigger]")) return;
      // Click dentro del menú flotante → NO cerrar (lo cierra el handler
      // del menuitem). Cualquier otro lugar del DOM (inputs, otra fila,
      // sidebar, modal overlay) → cerrar.
      if (node.contains(target)) return;
      setOpenKindMenuLineId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKindMenuLineId(null);
    };
    // CAPTURE PHASE (3er arg = true): muchos componentes hijos (TPNumberInput,
    // TPComboFixed, TPPopover) hacen `stopPropagation()` en mousedown para
    // no perder foco al clickear. Eso impedía que el handler global en bubble
    // phase recibiera el evento → el menú no se cerraba al clickear ciertos
    // controles de la fila. En capture, el handler corre ANTES de que el
    // hijo pueda detener la propagación.
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [openKindMenuLineId]);

  // Cache de la última tasa de impuesto vista por línea. Sirve como
  // fallback ANTI-FLICKER: si entre dos previews llega uno con
  // `taxBreakdown` vacío o sin `rate` (caso edge: error parcial,
  // hidratación incompleta), el input no cae a 0 — usa el último valor
  // estable. Se actualiza solo cuando llega un breakdown con un `rate`
  // legítimo. Se key-a por `articleId` además de `lineId`: si el artículo
  // de la línea cambia, la entrada cacheada no aplica (la rate del
  // artículo viejo no se filtra a uno nuevo).
  const lastTaxRateByLine = useRef<Map<string, { articleId: string | undefined; rate: number }>>(new Map());

  // Cache de la última bonificación vista por línea (anti-flicker, mismo
  // patrón que tax). Guarda PCT y UNIT amount juntos para no recalcular.
  // Se invalida cuando el usuario commitea bonif=0 (limpieza explícita)
  // o cuando cambia el articleId.
  const lastDiscountByLine = useRef<
    Map<string, { articleId: string | undefined; pct: number; unit: number }>
  >(new Map());
  // ── Cleanup de state local huérfano ──────────────────────────────────────
  // Cuando una línea se elimina o se reordena, los Maps/Set/refs que viven
  // dentro del editor pueden quedar con entradas asociadas a ids ausentes.
  // En el caso normal el id es estable y solo se accede por id, así que el
  // dato no se "mezcla" entre líneas. Pero si el operador hace ciclos
  // rápidos (eliminar / agregar / reordenar / aplicar override), entradas
  // viejas pueden reaparecer con valores stale al rehidratar — y los
  // helpers `getDiscountType(id)` etc devuelven el último valor seteado
  // para ese id, aunque la línea ya no exista.
  //
  // Este efecto sincroniza TODO el state local con `lines.id` cada vez que
  // el array cambia. Si un id no está en `lines`, se elimina su entrada en:
  //   · pickedById (TPArticleLite cacheado)
  //   · advancedOpenIds (panel avanzado abierto)
  //   · discountTypeById / taxTypeById (modo %/$)
  //   · discountAppliesToById / taxAppliesToById (scope METAL/HECHURA/...)
  //   · lastTaxRateByLine / lastDiscountByLine (refs anti-flicker)
  //
  // Garantía: misma línea (id estable) preserva su state local entre
  // reorders; líneas eliminadas no contaminan a futuras con id reusado
  // (que no debería pasar — `uid()` genera ids únicos — pero aún así).
  useEffect(() => {
    const validIds = new Set(lines.map((l) => l.id));

    setPickedById((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const k of Array.from(next.keys())) {
        if (!validIds.has(k)) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    setAdvancedOpenIds((prev) => {
      let touched = false;
      const next = new Set(prev);
      for (const k of Array.from(next)) {
        if (!validIds.has(k)) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    setDiscountTypeById((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const k of Array.from(next.keys())) {
        if (!validIds.has(k)) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    setTaxTypeById((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const k of Array.from(next.keys())) {
        if (!validIds.has(k)) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    setDiscountAppliesToById((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const k of Array.from(next.keys())) {
        if (!validIds.has(k)) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    setTaxAppliesToById((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const k of Array.from(next.keys())) {
        if (!validIds.has(k)) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    // Optimistic kind: limpieza triple:
    //   1) Líneas que ya no existen (eliminadas / reorder con id distinto).
    //   2) Líneas donde el preview backend ya hidrató `manualDiscount.kind`
    //      igual al optimistic → ya está reflejado en `pricingMeta`, el
    //      optimistic deja de ser necesario y se borra (evita stale).
    //   3) Líneas donde el override manual fue LIMPIADO upstream (X de la
    //      celda, o "Recalcular precios" al cambiar cliente):
    //        `pricingMeta.manualDiscount == null` Y `manualOverrides.discount`
    //        es falsy. En ese caso el operador (o el flujo del cambio de
    //        cliente) decidió volver al estado heredado/auto del motor —
    //        el optimistic stale debe borrarse para que el header refleje
    //        inmediatamente el kind heredado o BONUS por default.
    setOptimisticKindByLineId((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const [k, opt] of Array.from(next.entries())) {
        if (!validIds.has(k)) { next.delete(k); touched = true; continue; }
        const line = lines.find((l) => l.id === k);
        const settled = line?.pricingMeta?.manualDiscount?.kind;
        if (settled === opt) { next.delete(k); touched = true; continue; }
        const wasReset =
          (line?.pricingMeta?.manualDiscount ?? null) === null &&
          line?.manualOverrides?.discount !== true;
        if (wasReset) { next.delete(k); touched = true; }
      }
      return touched ? next : prev;
    });

    // Refs (no disparan render) — limpiar in-place.
    for (const k of Array.from(lastTaxRateByLine.current.keys())) {
      if (!validIds.has(k)) lastTaxRateByLine.current.delete(k);
    }
    for (const k of Array.from(lastDiscountByLine.current.keys())) {
      if (!validIds.has(k)) lastDiscountByLine.current.delete(k);
    }
  }, [lines]);

  // Solo las 3 opciones simples se hidratan. Si el valor heredado/persistido
  // es una base avanzada (METAL_Y_HECHURA, SUBTOTAL_*, PRODUCT, SERVICE) o
  // cualquier otra cosa → cae a "TOTAL" como fallback seguro (no se ofrece
  // ni se vuelve a poder seleccionar la base avanzada desde la UI).
  const SCOPE_SET = new Set<AppliesToScope>(SIMPLE_SCOPES);
  const asScope = (v: unknown): AppliesToScope | undefined =>
    typeof v === "string" && SCOPE_SET.has(v as AppliesToScope) ? (v as AppliesToScope) : undefined;

  // "Aplica a" — jerarquía de hidratación (display-only, sin cálculo).
  // Fuente ÚNICA = `pricingMeta` (persiste y round-trip por el preview), así
  // tras "Restablecer línea" (meta limpiado) re-hidrata solo. Orden:
  //   1. `appliesTo` embebido en el override de VALOR (meta.{manualDiscount
  //      | taxOverride}.appliesTo) — el operador fijó valor + base juntos.
  //   2. Override de SOLO la base (meta.{manualDiscountAppliesTo |
  //      manualTaxAppliesTo}) — base manual sin tocar el valor.
  //   3. Default HEREDADO del backend (passthrough):
  //       · Bonificación → regla comercial del cliente
  //         (`pricingMeta.inheritedDiscountAppliesTo`).
  //       · Impuestos    → base efectiva del impuesto que usó el motor
  //         (`pricingMeta.composition.taxes[].appliesTo`).
  //   4. "TOTAL" como último recurso.
  function getDiscountAppliesTo(id: string): AppliesToScope {
    const m = lines.find((l) => l.id === id)?.pricingMeta as any;
    return asScope(m?.manualDiscount?.appliesTo)
      ?? asScope(m?.manualDiscountAppliesTo)
      ?? asScope(m?.inheritedDiscountAppliesTo)
      ?? "TOTAL";
  }
  function getTaxAppliesTo(id: string): AppliesToScope {
    const m = lines.find((l) => l.id === id)?.pricingMeta as any;
    return asScope(m?.taxOverride?.appliesTo)
      ?? asScope(m?.manualTaxAppliesTo)
      // Base AUTORITATIVA del motor — MISMA fuente que el label
      // "IVA 21% sobre hechura" (`taxBreakdown[].applyOn`). Sin esto el
      // combo caía a "Total" aunque el motor aplicó METAL/HECHURA.
      ?? asScope(m?.taxBreakdown?.[0]?.applyOn)
      ?? asScope(m?.composition?.taxes?.[0]?.appliesTo)
      ?? "TOTAL";
  }
  function setDiscountAppliesTo(id: string, v: AppliesToScope) {
    setDiscountAppliesToById((prev) => { const next = new Map(prev); next.set(id, v); return next; });
  }
  function setTaxAppliesTo(id: string, v: AppliesToScope) {
    setTaxAppliesToById((prev) => { const next = new Map(prev); next.set(id, v); return next; });
  }

  function toggleExpanded(id: string) {
    if (onToggleExpandProp) {
      onToggleExpandProp(id);
      return;
    }
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /**
   * Si el parent expone un fetcher de stock, lo invoca para esta línea y
   * mergea el resultado en `pickedById` (sin pisar el resto de los datos
   * del item). Race-safe: si el usuario cambió de artículo antes de que
   * volviera la red, el merge se descarta.
   */
  function enrichWithStockByWarehouse(lineId: string, item: TPArticleLite) {
    if (!articleStockBreakdown || !item.id) return;
    articleStockBreakdown(item.id, item.variantId)
      .then((stocks) => {
        if (!stocks || stocks.length === 0) return;
        setPickedById((prev) => {
          const cur = prev.get(lineId);
          if (!cur) return prev;
          if (cur.id !== item.id || cur.variantId !== item.variantId) return prev;
          const next = new Map(prev);
          next.set(lineId, { ...cur, stockByWarehouse: stocks });
          return next;
        });
      })
      .catch(() => { /* silencioso */ });
  }

  function handlePickArticle(lineId: string, item: TPArticleLite | null) {
    // Si el parent provee `onArticlePicked`, le delegamos toda la decisión
    // (dedupe / agregar trailing empty / mover foco). El parent llamará a
    // `updateLine` con el shape correcto y el efecto de auto-populate de
    // `pickedById` se encarga del estado visual aquí.
    if (onArticlePicked) {
      if (!item) {
        setPickedById((prev) => {
          const next = new Map(prev);
          next.delete(lineId);
          return next;
        });
      } else {
        // El parent va a poblar pickedById vía el efecto de auto-populate;
        // pre-seteamos acá para que la fila de stock muestre algo en el
        // intervalo, y disparamos el fetch del stock por almacén.
        setPickedById((prev) => {
          const next = new Map(prev);
          next.set(lineId, item);
          return next;
        });
        enrichWithStockByWarehouse(lineId, item);
      }
      onArticlePicked(lineId, item);
      return;
    }

    if (!item) {
      setPickedById((prev) => {
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      });
      // Limpiar también `articleId`, `imageUrl` y `images` para que la línea
      // vuelva a estado vacío y el dedupe por id funcione consistentemente.
      updateLine(lineId, {
        articleId: undefined,
        article:   "",
        variant:   "",
        imageUrl:  undefined,
        images:    undefined,
        unitPrice: 0,
      });
      return;
    }
    setPickedById((prev) => {
      const next = new Map(prev);
      next.set(lineId, item);
      return next;
    });
    enrichWithStockByWarehouse(lineId, item);
    // Persistir `articleId` + `imageUrl` + `images` en la línea (no sólo
    // article+variant) para que:
    //   · el dedupe por id funcione cuando se escanea / repite el mismo art.
    //   · el auto-populate de pickedById opere tras remount / drag / sort.
    //   · la imagen / galería se mantengan disponibles aunque pickedById se
    //     pierda (post-remount, drag, etc.).
    updateLine(lineId, {
      articleId: item.id,
      article:   item.article,
      variant:   item.variant ?? "",
      imageUrl:  item.imageUrl,
      images:    item.images,
      unitPrice: item.price ?? 0,
    });
  }

  /* (handleApplySimulatedTotal eliminado — el simulador local fue removido.) */

  // ── Sensores DnD (umbral 4px para no disparar al hacer click puro) ───────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // ── Render de una fila (stateless excepto por estado externo) ────────────
  // Una línea es "vacía" si no tiene articleId ni nombre. La detección se
  // hace acá para no acoplarse al consumer (mismo criterio que isReorderable
  // por defecto).
  function isEmptyLineLocal(l: DocumentLine): boolean {
    return !l.articleId && !(l.article ?? "").trim();
  }

  // ── Numeración "Ítem N" ──────────────────────────────────────────────────
  // Asigna a cada línea un número correlativo basado en el ORDEN VISUAL
  // del array `lines` (no en `quantity`). Excluye:
  //   · placeholders vacíos (sin artículo y sin descripción)
  //   · headers (`type === "HEADER"`)
  // Las líneas manuales con descripción CUENTAN como ítems.
  // Al reordenar con drag & drop, `lines` cambia → el map se recalcula
  // automáticamente.
  const itemNumberById = React.useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const ln of lines) {
      if (ln.type === "HEADER") continue;
      const hasArticle = !!ln.articleId;
      const hasManualDesc = ln.isManual === true && (ln.manualDescription ?? "").trim().length > 0;
      if (!hasArticle && !hasManualDesc) continue;
      n += 1;
      map.set(ln.id, n);
    }
    return map;
  }, [lines]);

  function renderLineContent(l: DocumentLine, idx: number, dnd?: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners: any;
  }) {
    // ── Cabecera (HEADER): render compacto, sin inputs comerciales ─────────
    if (l.type === "HEADER") {
      const groupSubtotal = headerSubtotals?.get(l.id) ?? 0;
      return (
        <div
          ref={dnd?.setNodeRef}
          style={dnd?.style}
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 transition-colors duration-150 focus-within:border-primary/60"
        >
          <div className="flex items-center gap-2">
            {dnd && (
              <button
                type="button"
                data-tp-enter="ignore"
                title="Arrastrar para reordenar"
                aria-label="Reordenar cabecera"
                className="flex h-9 w-4 cursor-grab items-center justify-center text-primary/60 hover:text-primary active:cursor-grabbing"
                {...dnd.attributes}
                {...dnd.listeners}
              >
                <GripVertical size={14} />
              </button>
            )}
            <div className="flex flex-col gap-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
                Cabecera
              </div>
              {l.headerGroupBy && (
                <div className="flex items-center gap-1 text-[9px] italic leading-none text-muted/70">
                  <span>
                    {l.headerEditedByUser
                      ? "Editada"
                      : `Generada por ${({
                          CATEGORY:     "categoría",
                          BRAND:        "marca",
                          GROUP:        "grupo",
                          METAL:        "metal",
                          ARTICLE_TYPE: "tipo de artículo",
                        } as Record<string, string>)[l.headerGroupBy] ?? l.headerGroupBy.toLowerCase()}`}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={l.title ?? ""}
                onChange={(e) => {
                  // Si la cabecera fue generada y el operador cambia el
                  // título, marcamos `headerEditedByUser=true` para que la
                  // próxima regeneración NO la pise. Cabeceras 100% manuales
                  // (sin headerGroupBy) no necesitan el flag — el ausencia
                  // del groupBy ya indica que es manual.
                  const newTitle = e.target.value;
                  const patch: Partial<DocumentLine> = { title: newTitle };
                  if (l.headerGroupBy && !l.headerEditedByUser) {
                    patch.headerEditedByUser = true;
                  }
                  updateLine(l.id, patch);
                }}
                placeholder="Título de la sección (ej. ANILLOS)"
                className="w-full bg-transparent text-base font-bold uppercase tracking-wide text-text outline-none placeholder:text-muted/60 focus:placeholder:text-muted/40"
              />
            </div>
            {groupSubtotal > 0 && (
              <div className="shrink-0 text-right">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">Subtotal</div>
                <div className="text-sm font-bold tabular-nums text-primary">
                  {mFmt(groupSubtotal)}
                </div>
              </div>
            )}
            <TPIconButton
              onClick={() => removeLine(l.id)}
              className="h-8 w-8 hover:text-red-400 hover:border-red-400/40"
              title="Eliminar cabecera"
            >
              <Trash2 size={14} />
            </TPIconButton>
          </div>
        </div>
      );
    }

    const isEmptyRow = isEmptyLineLocal(l);
    const picked        = pickedById.get(l.id);
    const priceChip     = derivePriceChip(l, picked);
    const isCalculating = !!calculatingLineIds?.has(l.id);

    // Acciones INLINE con el label "Total línea c/ imp." formando una
    // fila única tipo ERP clásico:
    //   [ Total línea c/ imp. ]  [↺] [⛶] [✕] [⋯]
    //
    // Resto de presets: la toolbar queda al pie del bloque del total
    // (comportamiento UX.12 original).
    //
    // El prop explicito `inlineLineActions` (cuando se pasa) gana sobre
    // la heuristica vieja de `lineTotalEmphasis === "EMPHASIZED"`. Eso
    // permite a la pagina pedir acciones inline INDEPENDIENTEMENTE del
    // enfasis tipografico del total (pedido producto 2026-05-25: CLASSIC
    // debe tener acciones inline aunque el total sea STANDARD).
    const isClassicInline =
      inlineLineActions ?? (lineTotalEmphasis === "EMPHASIZED");

    // R4 (UX jerarquía) — Hero del Total del comprobante. Cuando hay más
    // de una línea visible, el Total línea cae a STANDARD (text-lg)
    // aunque el preset diga EMPHASIZED, para no competir visualmente con
    // el text-3xl/4xl del card del aside. Con UNA sola línea el Total
    // línea ES el total del comprobante; ahí respetamos el preset y
    // mantenemos EMPHASIZED (text-2xl) si CLASSIC lo pide.
    const effectiveLineTotalEmphasis: "STANDARD" | "EMPHASIZED" =
      lineTotalEmphasis === "EMPHASIZED" && lines.length === 1
        ? "EMPHASIZED"
        : "STANDARD";

    // ── Jerarquía visual por tipo de lista (SOLO presentación) ───────────────
    // Lista DESGLOSADA → el operador compra una CONSTRUCCIÓN comercial: los
    // protagonistas son gramos físicos + monetario; el "Total línea c/imp." pasa
    // a SECUNDARIO. Lista UNIFICADA → el protagonista es el Total (precio final).
    //
    // FUENTE: `isLineDesglosadaView` lee el modo de saldo EXPLÍCITO de la línea
    // (`lineBalanceMode` ← `appliedPriceListMode` del motor: METAL_HECHURA ⟹
    // BREAKDOWN). Es una propiedad de LA LÍNEA, NO del estado documental, así
    // que sobrevive a MIXED_LIST_FALLBACK: una línea desglosada conserva su
    // layout aunque otra línea use lista unificada. (Antes esto se infería de
    // `commercialRoundingContext`/`lineMonetarySaldoPostCommercialRounding`, que
    // son PER_DOCUMENT y quedan null en listas mixtas → la línea desglosada se
    // veía como unificada. Bug corregido.) Solo presentación — cero cálculo.
    const lineMetaForHierarchy = l.pricingMeta as any;
    // ── FASE 1 (2026-06-03) — Contrato único `lineCommercialSummary` ────────
    // Si el backend emitió `lineCommercialSummary`, el Resumen Comercial del
    // Artículo se renderiza EXCLUSIVAMENTE desde ahí (cero mezcla con fuentes
    // legacy: commercialRoundingContext / lineCommercialRoundingMetals /
    // lineMonetarySaldoPostCommercialRounding / commercialPhysical /
    // appliedRounding). Si NO existe (snapshots viejos) → comportamiento legacy.
    // El FE NO recalcula nada — solo lee y proyecta el contrato.
    const lineSummary: {
      mode: "UNIFIED" | "BREAKDOWN";
      metals: { visibleGrams: number; monetaryAmount: number; roundingImpact: number;
        byParent: Array<{ metalParentId: string; metalParentName: string; visibleGrams: number; monetaryAmount: number; roundingImpact: number }> } | null;
      monetary: { amount: number; roundingImpact: number };
      totalLineAmount: number;
      source?: Record<string, unknown>;
      // FASE 1 — el card prioriza el resumen comercial AUTÓNOMO display-only
      // (`lineCommercialDisplaySummary`, line-local e inmune a otras líneas/modo);
      // cae a `lineCommercialSummary` legacy si el backend aún no lo emite.
    } | null = lineMetaForHierarchy?.lineCommercialDisplaySummary
      ?? lineMetaForHierarchy?.lineCommercialSummary
      ?? null;
    // FIX UI (2026-06) — el LAYOUT del Resumen Comercial depende del TIPO DE
    // LISTA, NO de si la lista tuvo redondeo. La señal canónica de tipo de
    // lista es line-local e inmune al redondeo/MIXED: `appliedPriceListMode`
    // (METAL_HECHURA ⟹ DESGLOSADA) / `lineBalanceMode`, resuelta por
    // `resolveLineBalanceMode`. `lineSummary.mode` puede llegar UNIFIED para una
    // lista desglosada SIN redondeo comercial → antes eso hacía caer el card en
    // UI unificada/simple (dos listas desglosadas se veían distinto). Orden:
    //   1) tipo de lista explícito (line-local, inmune a redondeo)  ← gana SIEMPRE
    //   2) `lineSummary.mode` (cuando no hay señal explícita de línea)
    //   3) proxy legacy (`isLineDesglosadaView`) para snapshots viejos.
    // Solo presentación — cero cálculo. Los DATOS del desglose (gramos visibles,
    // monetario, total) siguen saliendo de las mismas fuentes passthrough.
    const explicitLineMode = resolveLineBalanceMode(lineMetaForHierarchy);
    // ── Vista por línea: el modo del DOCUMENTO manda (solo Factura) ──────────
    // Cuando el caller provee `documentBalanceMode` (Factura, compositionView
    // "sale"), la VISTA de TODAS las líneas sigue el modo del documento. El
    // override de lista POR LÍNEA es solo de PRECIO, no de vista — por eso al
    // cambiar la lista global / el cliente / el saldo del footer, todas las
    // líneas re-sincronizan su vista (incluidas las que tienen lista propia).
    // Única salvaguarda: una línea SIN datos de metal nunca se fuerza a
    // desglosada (no se inventa metal). SOLO presentación — los datos/cálculos
    // no cambian. Sin `documentBalanceMode` (Compras/Presupuestos) ⇒ back-compat.
    const isComboLineForView =
      l.pricingMeta?.costMode === "COMBO" ||
      (l.pricingMeta as any)?.priceSource === "COMBO_COMPONENTS";
    const lineHasMetalData =
      !isComboLineForView &&
      ((Array.isArray((lineMetaForHierarchy as any)?.composition?.metals) &&
        (lineMetaForHierarchy as any).composition.metals.length > 0) ||
        lineSummary?.metals != null);
    // Back-compat exacto (sin modo de documento): la vista la decide la lista
    // de la línea, tal como antes.
    const backCompatDesglosada =
      explicitLineMode != null
        ? explicitLineMode === "BREAKDOWN"
        : lineSummary
          ? lineSummary.mode === "BREAKDOWN"
          : isLineDesglosadaView(lineMetaForHierarchy);
    const isLineDesglosada =
      compositionView !== "sale" || documentBalanceMode == null
        ? backCompatDesglosada
        // El modo del documento manda; cae a unificado si no hay metal que mostrar.
        : documentBalanceMode === "BREAKDOWN" && lineHasMetalData;

    // Mini-toolbar contextual de la línea: [Colapsar] [Restablecer]
    // [Eliminar X] [Menú ...]. Misma JSX para ambas ubicaciones — solo
    // cambia el spacing externo según `inlineMode`. Mantener una única
    // definición evita divergencia entre presets. Para filas vacías, los
    // iconos que aplican solo con artículo cargado se reemplazan por
    // placeholder invisible (preserva alineación X entre filas).
    const renderLineActionsToolbar = (inlineMode: boolean): React.ReactNode => (
      <div
        className={cn(
          "flex items-center gap-1",
          // Default (no CLASSIC): la toolbar vive DEBAJO del total → mt-2 + justify-end.
          // CLASSIC inline: vive PEGADA al label → sin margen superior ni justify
          // (la fila padre la ubica al lado del label).
          !inlineMode && "mt-2 justify-end",
        )}
      >
        {/* 1) Colapsar / Expandir — usa `toggleAdvancedOpen` que toggle-ea
               el panel `LineAdvancedOverridesPanel` debajo de la fila. */}
        {onApplyLineOverrides && !isEmptyRow && l.articleId ? (() => {
          const isOpen = advancedOpenIds.has(l.id);
          const meta = l.pricingMeta;
          const hasOverrides = !!(
            meta?.manualPrice           ||
            meta?.manualDiscount        ||
            meta?.taxOverride           ||
            meta?.gramsOverride         ||
            meta?.mermaPercentOverride  ||
            meta?.hechuraOverrideAmount
          );
          return (
            <TPIconButton
              onClick={() => toggleAdvancedOpen(l.id)}
              className={cn(
                "h-9 w-9",
                isOpen && "bg-surface2 text-text",
                hasOverrides && !isOpen && "border-primary/40 text-primary",
              )}
              title={isOpen ? "Colapsar línea" : "Expandir línea"}
              aria-label="Colapsar o expandir línea"
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
            </TPIconButton>
          );
        })() : (
          <div aria-hidden="true" className="h-9 w-9" />
        )}

        {/* 1.b) Slot del caller para toggle extra (ej: "Ver detalle de
               pricing" en Factura). El editor solo reserva el espacio; el
               caller construye el botón. Filas vacías lo omiten. */}
        {renderLineExtraToggle && !isEmptyRow && l.articleId
          ? renderLineExtraToggle(l, idx)
          : (renderLineExtraToggle ? <div aria-hidden="true" className="h-9 w-9" /> : null)}

        {/* 2) Restablecer artículo — limpia overrides y vuelve al cálculo
               automático del backend. Sólo aplica si la línea tiene artículo;
               si no, placeholder. */}
        {onResetLine && !isEmptyRow ? (
          <TPIconButton
            onClick={() => onResetLine(l.id)}
            className="h-9 w-9"
            title="Restablecer artículo"
            aria-label="Restablecer artículo"
          >
            <RotateCcw size={14} />
          </TPIconButton>
        ) : (
          <div aria-hidden="true" className="h-9 w-9" />
        )}

        {/* 3) Eliminar línea (X) — SIEMPRE visible (incluido líneas vacías).
               Hover rojo para señalar acción destructiva. */}
        <TPIconButton
          onClick={() => removeLine(l.id)}
          className="h-9 w-9 hover:text-red-500 hover:border-red-500/40"
          title="Eliminar línea"
          aria-label="Eliminar línea"
        >
          <X size={14} />
        </TPIconButton>

        {/* Menú "..." — sólo acciones secundarias (Editar artículo base,
            Duplicar línea). Restablecer y Eliminar son icons visibles. */}
        <TPActionsMenu
          title="Acciones de la línea"
          items={[
            ...(onEditArticle && l.articleId && !isEmptyRow
              ? [{
                  label: "Editar artículo base",
                  icon: <Settings2 size={14} />,
                  onClick: () => onEditArticle(l.articleId!),
                }]
              : []),
            ...(duplicateLine && !isEmptyRow
              ? [{
                  label: "Duplicar línea",
                  icon: <Copy size={14} />,
                  onClick: () => duplicateLine(l.id),
                }]
              : []),
          ]}
        />
      </div>
    );

    // Si la línea ya tiene artículo cargado pero `pickedById` no lo conoce
    // (ej. agregada desde el quick-search del padre), sintetizamos el value
    // a partir de la línea misma para que el input del combo muestre el
    // nombre/variante en vez de quedar vacío.
    const articleValue = picked
      ? {
          id:       picked.id,
          article:  picked.article,
          variant:  picked.variant,
          sku:      picked.sku || picked.code,
          imageUrl: picked.imageUrl,
        }
      : (l.articleId || l.article)
        ? {
            id:       l.articleId ?? "",
            article:  l.article,
            variant:  l.variant,
            sku:      l.sku,
            imageUrl: l.imageUrl,
          }
        : null;

    // Imagen: priorizar la del catálogo (picked) → fallback a la guardada en
    // la línea → placeholder.
    const imageUrl = picked?.imageUrl ?? l.imageUrl;
    // Galería: priorizar `images` del catálogo → fallback `l.images` → si no
    // hay galería, usamos solo `imageUrl` como única imagen del lightbox.
    const galleryImages: string[] =
      (picked?.images && picked.images.length > 0)
        ? picked.images
        : (l.images && l.images.length > 0)
          ? l.images
          : (imageUrl ? [imageUrl] : []);
    const canOpenLightbox = galleryImages.length > 0;

    const stockInfo = (() => {
      if (!picked?.stockByWarehouse) return null;
      if (warehouseId) {
        const match = picked.stockByWarehouse.find((s) => s.warehouse === warehouseId);
        return match ? [match] : picked.stockByWarehouse;
      }
      return picked.stockByWarehouse;
    })();

    // Constraints de cantidad — derivadas del item del catálogo (picked).
    // Si la línea no tiene `picked` (cargada de un draft persistido), usamos
    // defaults razonables (step=1, sin min/max) para que TPNumberInput no
    // bloquee el input.
    const qtyConstraints: QuantityConstraints = picked
      ? resolveQuantityConstraints(picked)
      : { step: 1, default: 1 };
    // ¿La línea administra stock? Servicios = no; combos = depende del flag.
    // Default true para artículos.
    const lineManagesStock =
      typeof picked?.manageStock === "boolean"
        ? picked.manageStock
        : l.itemKind !== "SERVICE";

    // Fase A — política comercial.
    // Si el caller provee `commercialInfoByLineId` lo preferimos (tiene
    // motivo + margen). Si no, caemos a `commercialLevelByLineId` (back-compat).
    // Otros consumidores (Presupuestos / Órdenes / Compras) no pasan ninguno
    // y la fila queda con su estilo base.
    const commercialInfo  = commercialInfoByLineId?.[l.id];
    const commercialLevel = commercialInfo?.level ?? commercialLevelByLineId?.[l.id];
    // Refinamiento — borde lateral DELGADO (apenas un acento de color)
    // como refuerzo secundario. El ancla visual primaria es el bloque
    // "Total línea c/imp." que ya integra ícono + color + sublabel +
    // margen + tooltip. Acá solo agregamos una pista de color sutil
    // para identificar de qué fila se trata cuando hay varias.
    const commercialBorderClass =
      commercialLevel === "CRITICAL" ? "border-l-[3px] border-l-red-500/70"    :
      commercialLevel === "RISK"     ? "border-l-[3px] border-l-orange-500/60" :
      commercialLevel === "WARNING"  ? "border-l-[3px] border-l-amber-500/60"  :
      "";

    return (
      <div
        ref={dnd?.setNodeRef}
        style={dnd?.style}
        data-tp-commercial-level={commercialLevel ?? undefined}
        className={cn(
          // UX.8 — line as "card" (SaaS premium look):
          //   · `rounded-xl` (antes `lg`)            → contorno más suave.
          //   · `border-border/40` (antes `border`)  → ruido visual menor.
          //   · `px-3 py-3` (antes `px-2 py-1.5`)    → respiración interna
          //     (los inputs internos ya tienen su propio padding; este es
          //     el contenedor de la línea).
          //   · `shadow-sm`                          → profundidad sutil
          //     que reemplaza la sensación "grilla" por sensación "card".
          //   · Sin alternancia agresiva (antes `bg-card/60` y `bg-card/40`
          //     intercalados — daba sensación spreadsheet). Ahora UNA sola
          //     superficie `bg-card/50` para todas las líneas: spacing y
          //     borde delgado hacen el trabajo de separación, no el color.
          // py-3.5 (antes py-3): +4px top/bottom de breathing dentro del
          // card de la linea — los labels de 9px de Cantidad / Precio /
          // Bonif / IVA quedaban pegados al borde superior con py-3.
          // px-3.5 (antes px-3): respiracion lateral consistente.
          // R2 (UX densidad) — padding reducido `px-2.5 py-2` (antes
          // `px-3.5 py-3.5`). Junto con la altura input de 34 px (tp-input-dense)
          // y el space-y-2 entre líneas, la altura por línea baja ~40 px
          // sin perder respiración.
          "rounded-xl border border-border/40 bg-card/50 px-2.5 py-2 shadow-sm transition-colors duration-150",
          // Fase A — borde lateral por nivel comercial (override del
          // border default solo en el lado izquierdo).
          commercialBorderClass,
          // Placeholder de fila vacía: misma capa pero más tenue (no se
          // confunde con una línea real cargada).
          isEmptyRow && "opacity-75",
          // Línea activa (foco interno) con borde primario sutil — sin halo
          // invasivo que ya está suprimido en los inputs.
          "focus-within:border-primary/40 focus-within:shadow",
        )}
      >
        {/* ── FILA PRINCIPAL — Img · Artículo · Cantidad · Precio · Desc · IVA · Total ── */}
        {(() => {
          // Fallback `totalLine` SOLO para pantallas legacy
          // (showLineTotalWithTax=false: Presupuestos/Órdenes/Compras) cuando
          // `l.lineTotal` no viene hidratado. En Factura siempre se lee
          // `l.lineTotal`/`l.lineTotalWithTax` del backend (vía
          // `selectInvoiceLineView`/`applySalePreviewToDraft`), así que
          // esta rama no se ejecuta. Se computa con los valores del draft
          // que YA vienen del motor; el frontend no agrega cálculo nuevo.
          const tax   = Number.isFinite(l.taxAmount ?? 0) ? (l.taxAmount ?? 0) : 0;
          const totalLine = Math.max(
            0,
            ((Number.isFinite(l.quantity)  ? l.quantity  : 0) *
             (Number.isFinite(l.unitPrice) ? l.unitPrice : 0))
            - (Number.isFinite(l.discountAmount) ? l.discountAmount : 0),
          ) + (showTax ? tax : 0);
          return (
            <div className={cn(
              // gap-x-3 (antes gap-x-2): +4px entre columnas → cantidad,
              // precio, bonif e impuestos respiran entre si en vez de
              // sentirse pegadas. gap-y-1 (antes gap-y-0): en mobile
              // grid-cols-1 los cells se apilan con minima separacion.
              "grid grid-cols-1 items-start gap-y-1 gap-x-3",
              // Grilla profesional (lg+):
              //   drag(14) ·
              //   artículo  minmax(400px, 1.5fr)  ·
              //   cantidad  minmax(110px, 0.45fr) ·
              //   precio    minmax(220px, 0.85fr) ·
              //   bonif     minmax(130px, 0.50fr) ·
              //   IVA       minmax(130px, 0.50fr) ·
              //   total     minmax(180px, auto)   ·
              //   acciones  160px (FIJO)
              //
              // Pasada +10% sobre el combo del artículo (360→400 min /
              // 1.35→1.5 fr). El resto de la grilla queda igual: la
              // suma de fr (3.8) sigue absorbiendo el sobrante hasta
              // llegar a Total línea, que se mantiene fijo a la derecha
              // (auto, sin fr). Misma grilla para líneas vacías y con
              // artículo → ancho idéntico del combo en ambos casos;
              // nombres largos truncan internamente.
              // UX.12 — Acciones movidas DENTRO del bloque "Total línea"
              // (mini-toolbar contextual). Eliminada la columna 8 del grid
              // que vivía al extremo derecho y se cortaba con el scroll
              // horizontal del layout 2-cols. Ahora 7 columnas:
              //   · Artículo:  minmax(420px, 1.575fr)
              //   · Cantidad:  minmax(110px, 0.45fr)
              //   · Precio:    minmax(200px, 0.85fr)
              //   · Bonif:     minmax(130px, 0.5fr)
              //   · IVA:       minmax(130px, 0.5fr)
              //   · Total:     minmax(200px, auto)  ←  +acciones internas
              //                  (era 160px; +40px para acomodar 4 íconos
              //                   h-9 dispuestos en fila debajo del monto)
              //
              // La barra de acciones queda alineada a la derecha,
              // visualmente junto al monto del Total. Sigue siempre visible
              // dentro del bloque Total (que es la última columna del grid),
              // sin necesidad de scroll horizontal hasta el extremo derecho.
              "lg:grid-cols-[14px_minmax(420px,1.575fr)_minmax(110px,0.45fr)_minmax(200px,0.85fr)_minmax(130px,0.5fr)_minmax(130px,0.5fr)_minmax(240px,1fr)]",
            )}>
              {/* Drag handle */}
              {dnd && (
                <button
                  type="button"
                  data-tp-enter="ignore"
                  title="Arrastrar para reordenar"
                  aria-label="Reordenar línea"
                  className="hidden lg:flex h-9 w-3.5 cursor-grab items-center justify-center text-muted/50 hover:text-muted active:cursor-grabbing"
                  {...dnd.attributes}
                  {...dnd.listeners}
                >
                  <GripVertical size={12} />
                </button>
              )}
              {!dnd && <div className="hidden lg:block" />}

              {/* Cell ARTÍCULO: combo + descripción + stock APILADOS
                  verticalmente dentro de la misma celda (flex column)
                  para que la altura de este bloque NO dependa de la
                  altura de los chips/desgloses de Bonif/Impuestos en
                  las otras columnas. La grilla principal usa
                  `items-start`, así que cada columna conserva su
                  altura natural sin crear huecos verticales debajo
                  del combo. */}
              <div className="flex min-w-0 flex-col gap-1">
                {/* Combo del artículo. Las acciones rápidas (colapsar /
                    restablecer / eliminar) viven en la celda Acciones a la
                    derecha, junto al menú "..." — ver más abajo.
                    Cuando la línea es MANUAL, reemplazamos el combo por un
                    input de texto libre — sin pricing-engine, sin búsqueda. */}
                <div>
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    {(() => {
                      // Badge "Ítem N" — orden visual de la línea en el
                      // documento, NO la cantidad. Sutil, sin competir con
                      // el campo Cantidad. Solo visible en líneas que
                      // cuentan (con artículo o manual con descripción).
                      const num = itemNumberById.get(l.id);
                      if (num == null) return null;
                      // Factura (showLineTotalWithTax=true) → label plano
                      // sin borde ni fondo. "Ítem 3" se lee como una etiqueta
                      // textual igual al "Artículo" que viene a su derecha,
                      // sin competir como badge. Pantallas legacy mantienen
                      // el chip custom legacy con borde y bg.
                      return showLineTotalWithTax ? (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide tabular-nums text-muted/80"
                          title="Orden de línea en el comprobante"
                        >
                          Ítem {num}
                        </span>
                      ) : (
                        <span
                          className="inline-flex h-4 min-w-[1.6rem] items-center justify-center rounded border border-border bg-surface2/60 px-1 text-[10px] font-semibold tabular-nums text-muted/90"
                          title="Orden de línea en el comprobante"
                        >
                          Ítem {num}
                        </span>
                      );
                    })()}
                    {/* R3 (UX densidad) — antes mostrábamos "Descripción" +
                        chip ámbar "Manual" en líneas manuales (dos señales
                        para el mismo concepto). Unificamos a un único label
                        "Manual" en tono ámbar para mantener el indicador
                        visual sin duplicación. */}
                    {l.isManual ? (
                      <span
                        className="text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                        title="Línea manual: texto libre, sin pricing-engine."
                      >
                        Manual
                      </span>
                    ) : (
                      <span>Artículo</span>
                    )}
                    {l.isManual && (displayRate ?? 1) !== 1 && (
                      <span
                        className="text-[10px] italic text-muted"
                        title="Los valores se ingresan en moneda base y se muestran convertidos."
                      >
                        Valores convertidos desde moneda base
                      </span>
                    )}
                  </div>
                  {l.isManual ? (
                    <input
                      type="text"
                      value={l.manualDescription ?? ""}
                      onChange={(e) => updateLine(l.id, { manualDescription: e.target.value })}
                      onBlur={(e) => {
                        // Si el usuario borra todo el texto → eliminar la línea.
                        if (!e.target.value.trim()) removeLine(l.id);
                      }}
                      placeholder="Descripción manual (ej: Servicio de reparación)"
                      className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-text placeholder:text-muted/60 focus:border-primary/50 focus:outline-none"
                    />
                  ) : (
                    <TPArticleVariantSearchSelect
                      value={articleValue}
                      onChange={(item) => handlePickArticle(l.id, item)}
                      placeholder="Buscar artículo, variante, servicio o combo…"
                      focusSignal={focusedLineId === l.id ? focusSignal : undefined}
                      remoteSearch={articleSearch}
                      // Combo POR LÍNEA: NO es scanMode (eso vive en el box
                      // "Agregar rápido / escanear" del header). Acá usamos
                      // modo MANUAL: highlight → match exacto → único →
                      // exactLookup → onCreateManual. Permite seleccionar con
                      // flechas+Enter y prioriza match exacto antes de crear
                      // línea manual.
                      exactLookup={articleExactLookup}
                      onNoExactMatch={onArticleNoExactMatch}
                      onMultipleExactMatches={onArticleMultipleExactMatches}
                      onCreateManual={
                        onCreateManualLine
                          ? (text) => onCreateManualLine(l.id, text)
                          : undefined
                      }
                    />
                  )}
                </div>

                {/* Descripción — solo si hay artículo cargado. En líneas
                    vacías reservamos la misma altura con un placeholder
                    invisible para que las columnas de la derecha
                    (cantidad, precio, total, acciones) queden a la misma
                    Y vertical en TODAS las líneas. */}
                {/* R2 (UX densidad) — placeholders eliminados: las líneas
                    vacías y las sin stock administrado colapsan, dándole al
                    operador feedback de "línea recién creada" sin aire
                    muerto. El grid usa `items-start`, así que las columnas
                    siguen alineadas arriba aunque la celda Artículo sea
                    más corta. */}
                {!isEmptyRow && !l.isManual && (
                  <LineDescriptionTextarea
                    value={l.description ?? ""}
                    onChange={(v) => updateLine(l.id, { description: v })}
                  />
                )}
                {picked && (lineManagesStock || l.itemKind === "SERVICE") && (() => {
                  // Breakdown del catálogo (sin id canónico).
                  const articleStock: ReadonlyArray<{ name: string; qty: number }> =
                    (picked.stockByWarehouse ?? []).map((s) => ({ name: s.warehouse, qty: s.qty }));
                  // Lista canónica de almacenes con stock mergeado.
                  const stockList: ReadonlyArray<{ id: string; name: string; qty: number }> =
                    warehouses && warehouses.length > 0
                      ? warehouses.map((w) => {
                          const match = articleStock.find((s) => s.name === w.name);
                          return { id: w.id, name: w.name, qty: match?.qty ?? 0 };
                        })
                      : articleStock.map((s) => ({ id: s.name, name: s.name, qty: s.qty }));

                  const selectedId = l.warehouseId ?? warehouseId ?? undefined;
                  const selectedItem = stockList.find((w) => w.id === selectedId);
                  const stockQty = selectedItem
                    ? selectedItem.qty
                    : (typeof picked.stock === "number" ? picked.stock : 0);

                  // Lista efectiva: la que el motor aplicó (puede diferir de
                  // la del documento por jerarquía cliente/categoría); si no,
                  // la del documento.
                  const effectiveList =
                    l.pricingMeta?.appliedPriceListName ??
                    priceListName ??
                    null;
                  // ¿Esta línea tiene override individual de lista?
                  const hasLineListOverride =
                    typeof l.priceListIdOverride === "string" && l.priceListIdOverride.length > 0;
                  // Nombre de la lista global para mostrar en el clearable.
                  const globalListName = priceListName ?? null;
                  // Claridad "lista aplicada por línea" — badge cuando la línea
                  // usa una lista distinta a la del documento (override explícito
                  // o lista resuelta por el motor distinta a la del header).
                  // Display-only: compara ids ya resueltos por el backend.
                  const lineListBadge = resolveLineListBadge({
                    appliedPriceListId:    l.pricingMeta?.appliedPriceListId ?? null,
                    appliedPriceListName:  l.pricingMeta?.appliedPriceListName ?? null,
                    priceListIdOverride:   l.priceListIdOverride ?? null,
                    documentPriceListId:   priceListId ?? null,
                    documentPriceListName: globalListName,
                  });
                  return (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-surface2/30 px-2 py-1 text-[11px]">
                      {/* Stock + almacén — solo líneas que administran stock.
                          Los SERVICIOS saltan este sub-bloque pero conservan el
                          selector de lista de precios (abajo), igual que los
                          productos. */}
                      {lineManagesStock && (<>
                      <span className="inline-flex items-center gap-1">
                        <Warehouse size={11} className="text-muted" />
                        <span className="text-muted">Stock:</span>
                      </span>
                      <span className={cn(
                        "tabular-nums font-semibold",
                        stockQty > 0 ? "text-emerald-500" : "text-red-500",
                      )}>
                        {fmtQty(stockQty)}
                      </span>
                      <span aria-hidden className="text-muted/40 select-none">·</span>
                      <WarehouseLinkPicker
                        warehouses={stockList}
                        selectedId={selectedId}
                        onSelect={(id) => updateLine(l.id, {
                          warehouseId:       id,
                          // Override de almacén por línea — cuando el operador
                          // elige uno desde el picker, marcamos override para
                          // que el almacén global del documento NO lo pise.
                          // El reset lo limpia. Los cambios "automáticos"
                          // (cascada del global, init de línea) NO pasan por
                          // este onSelect → no afectan el flag.
                          warehouseOverride: true,
                        })}
                        disabled={isEmptyRow}
                        hasOverride={l.warehouseOverride === true}
                        onClearOverride={() => updateLine(l.id, {
                          warehouseId:       warehouseId,
                          warehouseOverride: false,
                        })}
                      />
                      <span aria-hidden className="text-muted/40 select-none">·</span>
                      </>)}
                      {/* Lista de precios — comportamiento:
                          · onChangeLinePriceList provisto → picker per-línea
                            (override de esta línea; "Usar lista global"
                            limpia el override).
                          · onChangePriceList provisto sin onChangeLinePriceList
                            → picker document-scope (cambia toda la factura).
                          · Sin callbacks → solo display.
                          Se renderiza SIEMPRE (productos y servicios); el
                          sub-bloque de stock de arriba es el único gateado por
                          `lineManagesStock`. */}
                      {onChangeLinePriceList && priceListOptions ? (
                        <LineScopePricelistPicker
                          selectedName={effectiveList}
                          globalListName={globalListName}
                          options={priceListOptions}
                          hasOverride={hasLineListOverride}
                          overrideId={l.priceListIdOverride ?? null}
                          onSelect={(id) => onChangeLinePriceList(l.id, id)}
                          disabled={isEmptyRow}
                        />
                      ) : onChangePriceList && priceListOptions ? (
                        <DocumentScopePicker
                          label="Lista"
                          selectedName={effectiveList}
                          options={priceListOptions}
                          selectedId={priceListId}
                          onSelect={(id) => onChangePriceList(id)}
                          emptyText="Sin lista"
                          pickerTitle="Lista de precios"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-muted">Lista:</span>
                          <span className={cn(
                            "font-semibold",
                            effectiveList ? "text-text" : "italic text-muted/70",
                          )}>
                            {effectiveList || "Sin lista"}
                          </span>
                        </span>
                      )}
                      {/* Badge de claridad: esta línea usa una lista distinta a
                          la del documento (override o jerarquía del motor).
                          Display-only — el valor sale del helper puro. */}
                      {lineListBadge.differs && (
                        <>
                          <span aria-hidden className="text-muted/40 select-none">·</span>
                          <span
                            title={
                              `Lista aplicada en esta línea: ${lineListBadge.appliedName ?? "—"}` +
                              (lineListBadge.documentName
                                ? `\nLista general del documento: ${lineListBadge.documentName}`
                                : "")
                            }
                            className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle size={10} />
                            {lineListBadge.label}
                          </span>
                        </>
                      )}
                      {/* Canal de venta — REMOVIDO de la línea (decisión de
                          producto): aplica solo a nivel documento. El picker
                          global vive en el header de la factura. Mantener un
                          chip por línea generaba la falsa expectativa de que
                          se podía configurar por artículo. Las props
                          `channelOptions`/`channelName`/`onChangeChannel`
                          siguen aceptándose para compatibilidad con otros
                          consumidores (Órdenes, Presupuestos), pero la línea
                          ya no las renderiza. */}
                    </div>
                  );
                })()}
              </div>

              {/* Cell CANTIDAD — constraints (min/max/step/default) vienen del
                  motor de línea (`commercial-line-engine`). Al cambiar el
                  valor pasamos por `applyQuantityChange` para cuantizar al
                  step y limitar al rango.

                  Regla cantidad mínima = 1 (forzada):
                    · No permitimos vender 0 unidades. Si el catálogo del
                      artículo declara min=0 o no declara, igual aplicamos
                      piso de 1.
                    · Si TPNumberInput emite null/NaN (campo vacío al blur),
                      0, negativo o sub-step, normalizamos a 1 (o al min del
                      artículo si es >1). El usuario nunca queda con
                      cantidad inválida, y el campo no "vuelve al valor
                      anterior" silenciosamente. */}
              {(() => {
                const enforcedMin = Math.max(1, qtyConstraints.min ?? 1);
                const totalStock =
                  picked?.stockByWarehouse && picked.stockByWarehouse.length > 0
                    ? picked.stockByWarehouse.reduce((s, w) => s + (w.qty || 0), 0)
                    : (typeof picked?.stock === "number" ? picked.stock : null);
                // Resolver el `code` técnico de la unidad (ej. "UND") al
                // `name` legible ("Unidad") usando el catálogo provisto por
                // el caller. Si la prop no viene o el code no está en el
                // map, cae al code crudo. Se usa tanto en el label como en
                // la prop `unit` que se pasa a `TPQuantityField`.
                const unitCode    = picked?.unitOfMeasure ?? null;
                const unitDisplay = unitCode
                  ? (unitNameByCode?.get(unitCode) ?? unitCode)
                  : null;
                return (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">
                  Cantidad
                  {/* Factura: la unidad viaja inline en el label
                      ("CANTIDAD · Unidad") en lugar de aparecer como badge
                      separado debajo del input. Usa el nombre legible del
                      catálogo (`unitNameByCode`) y cae al code crudo si
                      la prop no se pasó. Pantallas legacy mantienen la
                      unidad como hint debajo del input. */}
                  {showLineTotalWithTax && unitDisplay && (
                    <span className="ml-1 normal-case text-muted/70">· {unitDisplay}</span>
                  )}
                </div>
                <TPQuantityField
                  formatType="QUANTITY"
                  value={l.quantity}
                  onChange={(v) => {
                    // T44.1 — La edición MANUAL del usuario respeta el
                    // valor ingresado tal cual (permite decimales < 1 como
                    // 0,01 / 0,10 / 0,50 que son válidos en artículos por
                    // gramo). El componente hace fallback al `default` en
                    // blur con vacío/NaN; acá sólo descartamos null/NaN
                    // (ya manejado por el componente) y valores no
                    // positivos. El error visual de `belowMin` sigue
                    // funcionando si el valor < min del artículo, sin
                    // clampar silenciosamente. Las flechas del input
                    // siguen usando `step` (gobernado por TPNumberInput).
                    if (v == null || !Number.isFinite(v) || v <= 0) return;
                    if (v === l.quantity) return;
                    updateLine(l.id, { quantity: v });
                  }}
                  constraints={{ ...qtyConstraints, min: enforcedMin, default: enforcedMin }}
                  // T44.1 — "X" interna del TPNumber: SIEMPRE resetea a 1
                  // (no a `enforcedMin`). La regla universal es "limpiar
                  // = volver a 1 unidad" — predecible para el operador
                  // independiente del min del artículo. Si el artículo
                  // exige min > 1, queda con error visual hasta que el
                  // operador ingrese el valor correcto (no se clampa
                  // silenciosamente para no enmascarar la restricción).
                  // Visible sólo cuando hay algo que restablecer
                  // (qty ≠ 1).
                  onClear={
                    Number.isFinite(l.quantity) && l.quantity !== 1
                      ? () => {
                          if (l.quantity === 1) return;
                          updateLine(l.id, { quantity: 1 });
                        }
                      : undefined
                  }
                  unit={unitDisplay}
                  totalStock={lineManagesStock ? totalStock : null}
                  // Semántica unificada "manual reemplaza automático": cuando
                  // hay `meta.manualDiscount` activo el motor reemplaza promo
                  // / qty-discount / cliente por el override del operador.
                  // Los pills "Promo activa" / "Desc. x cantidad" deben
                  // ocultarse aunque los campos legacy del meta sigan
                  // poblados (compatibilidad). No borramos info del motor —
                  // solo dejamos de marcarla como activa visualmente.
                  // Restaurar con X → `manualDiscount: null` → los pills
                  // vuelven en el siguiente render.
                  hasPromotion={!!l.pricingMeta?.appliedPromotionId && !l.pricingMeta?.manualDiscount}
                  hasQuantityDiscount={(l.pricingMeta?.quantityDiscountAmount ?? 0) > 0 && !l.pricingMeta?.manualDiscount}
                  partial={!!l.pricingMeta?.partial}
                  size="sm"
                  compactInline={showLineTotalWithTax}
                  inputClassName="tp-input-dense"
                />
              </div>
                );
              })()}

              {/* Cell PRECIO — `pricingMeta.basePrice` (unitario, antes
                  de descuentos por cantidad/promo). Mismo dato que muestra el
                  Simulador en su línea "Precio lista". Si no hay meta cae al
                  unitPrice como fallback. Si el usuario edita: trata el valor
                  como precio manual final → seteo unitPrice (override).
                  Label: "Precio" en Factura (showLineTotalWithTax=true);
                  "Precio lista" en pantallas legacy (Presupuestos / Órdenes /
                  Compras) que no exhiben el total con impuestos. */}
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">
                  {showLineTotalWithTax ? "Precio" : "Precio lista"}
                </div>
                <div className="relative">
                  <TPNumberInput
                    formatType="MONEY"
                    // El input PRECIO representa el VALOR COMERCIAL BASE
                    // (pre-bonificación), coherente con "Composición del costo".
                    // Precedencia:
                    //   1. `manualPrice` → SOLO cuando el operador hizo un
                    //      override EXPLÍCITO de precio (setea manualPrice +
                    //      manualOverrides.price juntos; ver patchLineHelpers).
                    //   2. `basePrice` (precio de lista del backend) — default.
                    //   3. `unitPrice` — fallback legacy (líneas sin pricingMeta).
                    // NO se cambia a `unitPrice` por existir una bonificación/
                    // descuento: la bonif vive en su propia columna. El precio
                    // NO muta visualmente por aplicar bonificaciones. (El flag
                    // `manualOverride` ya no bifurca acá — antes mostraba el
                    // unitPrice post-bonif y divergía de la composición.)
                    value={
                      l.pricingMeta?.manualPrice != null
                        ? l.pricingMeta.manualPrice
                        : (l.pricingMeta?.basePrice ?? l.unitPrice)
                    }
                    onChange={(v) => {
                      // Fase 2 — Opción A: editar precio = override manual.
                      // Una sola llamada a `applyLineOverrides({ manualPrice })`:
                      //   · setea `pricingMeta.manualPrice` y `manualOverrides.price=true`
                      //   · sincroniza `line.unitPrice` atómicamente
                      //
                      // ANTES había también un `updateLine({ unitPrice })`
                      // separado, pero ambos llamaban `onChange` con un
                      // draft leído de `draftRef.current` que entre medio
                      // podía estar stale → el segundo pisaba al primero
                      // y, si había overrides previos de bonificación o
                      // impuestos, esos también se perdían. Sin el
                      // `updateLine`, los overrides son conmutativos
                      // respecto al orden de carga.
                      //
                      // Path legacy (pantallas sin handler de overrides):
                      // mantenemos `updateLine` directo.
                      const newPrice = Math.max(0, v ?? 0);
                      if (onApplyLineOverrides && (l.articleId || l.isManual)) {
                        onApplyLineOverrides(l.id, { manualPrice: newPrice });
                      } else {
                        updateLine(l.id, { unitPrice: newPrice });
                      }
                    }}
                    decimals={2}
                    min={0}
                    {...(showLineTotalWithTax ? { step: 1 } : {})}
                    compact
                    // Arrows + X igual que el resto de los inputs de la fila.
                    // La X sólo aparece cuando hay un precio MANUAL activo
                    // (`pricingMeta.manualPrice != null`) y, al limpiarlo,
                    // vuelve al precio de lista del backend: `manualPrice:null`
                    // → `applyLineOverrides` restaura `unitPrice` desde
                    // `basePrice` y apaga el flag `manualOverrides.price`.
                    onClear={
                      l.pricingMeta?.manualPrice != null
                        ? () => {
                            if (onApplyLineOverrides && (l.articleId || l.isManual)) {
                              onApplyLineOverrides(l.id, { manualPrice: null });
                            } else {
                              updateLine(l.id, {
                                unitPrice: l.pricingMeta?.basePrice ?? l.unitPrice,
                              });
                            }
                          }
                        : undefined
                    }
                    clearTitle="Volver al precio de lista"
                    clearAriaLabel="Volver al precio de lista"
                    className={cn("tp-input-dense", isCalculating && "opacity-60")}
                  />
                  {isCalculating && (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center"
                      title="Calculando precio…"
                    >
                      <Loader2 size={11} className="animate-spin text-primary/80" />
                    </div>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  {isCalculating ? (
                    <span className="text-[10px] italic text-muted">Calculando…</span>
                  ) : (() => {
                    // Semántica unificada "manual reemplaza automático":
                    // cuando hay `meta.manualDiscount` activo, los pills
                    // que sugieren promo/cantidad ACTIVAS deben ocultarse.
                    // El motor ya aplica el override del operador en lugar
                    // de promo/qty para el descuento. El priceSource del
                    // backend puede seguir siendo "PROMOTION"/"QUANTITY_-
                    // DISCOUNT" (refleja origen del precio inicial), pero
                    // como chip ACTIVO confunde al operador. Otros chips
                    // ("Lista", "Variante", "Precio manual", "Parcial")
                    // siguen visibles porque NO sugieren auto reemplazable.
                    if (!priceChip) return null;
                    const isAutoActivePillReplacedByManual =
                      !!l.pricingMeta?.manualDiscount &&
                      (priceChip.label === "Promo" || priceChip.label === "Cantidad");
                    if (isAutoActivePillReplacedByManual) return null;
                    // T27 — Label compacto (antes TPBadge). Mismo lenguaje
                    // visual que "Bonificación acumulada" / "Manual" / etc.
                    // Colores semánticos por tone:
                    //   · success → verde (Promo / Cantidad / Bonus)
                    //   · warning → naranja (Manual / override)
                    //   · neutral/info → muted (Lista / Variante)
                    //   · danger → rojo (alertas reales)
                    const priceLabelClass =
                      priceChip.tone === "success" ? "text-emerald-600 dark:text-emerald-400"
                      : priceChip.tone === "warning" ? "text-amber-600 dark:text-amber-400"
                      : priceChip.tone === "danger" ? "text-red-500"
                      : "text-muted";
                    return (
                      <>
                        <span
                          className={cn("text-[10px] font-semibold", priceLabelClass)}
                          title={priceChip.tooltip}
                        >
                          {priceChip.label}
                        </span>
                        {priceChip.subtitle && (
                          <span
                            className="truncate text-[10px] italic text-muted"
                            title={priceChip.subtitle}
                          >
                            {priceChip.subtitle}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Cell BONIFICACIÓN — usa `resolveDiscountDisplay` para tener
                  un valor estable bajo cambios de cantidad y respetar
                  override manual cuando exista.
                  Regla del modo `$`: el valor representa el descuento POR
                  UNIDAD (no total de línea). Al cambiar cantidad el monto
                  unitario se mantiene constante, el total de línea cambia
                  proporcionalmente. */}
              {(() => {
                const meta = l.pricingMeta;
                const qtyDiscUnit   = meta?.quantityDiscountAmount  ?? 0;
                const promoDiscUnit = meta?.promotionDiscountAmount ?? 0;
                const md            = meta?.manualDiscount ?? null;
                // Precio manual ACTIVO — el operador fijó un precio final neto.
                // El motor (pricing-engine.sale.ts) en este caso SALTA qty +
                // promo + customer + manualDiscount, y emite
                // `qtyDiscountAmount = basePrice − manualPrice` como DELTA
                // INFORMATIVO (no es un descuento aplicado). Sin esta guarda,
                // la rama PROMO/QTY de la cascada interpretaba ese delta como
                // bonificación efectiva y rellenaba el TPNumber con un %
                // fantasma que el operador NO pidió. Precio manual y
                // bonificación/recargo son DOS OVERRIDES INDEPENDIENTES (ver
                // CLAUDE.md raíz, sección de pricing-engine).
                const hasManualPrice = meta?.manualPrice != null && meta.manualPrice > 0;
                const hasQty        = qtyDiscUnit > 0 && !hasManualPrice;
                const hasPromo      = promoDiscUnit > 0 && !hasManualPrice;
                const qty           = Number.isFinite(l.quantity) ? l.quantity : 0;
                // ANTI-FLICKER: cuando el operador acaba de cambiar la
                // cantidad, `l.quantity` ya es la nueva, pero `l.subtotal`/
                // `l.discountAmount` siguen siendo los del preview anterior
                // (qty viejo) hasta que llegue el siguiente preview
                // (~200-500 ms). Mezclar ambos en un cálculo local produce
                // un valor intermedio incorrecto (ej.: 50% en lugar de 10%).
                // `meta.previewQuantity` es la qty CON LA QUE el motor
                // calculó los importes presentes en `l.*`; usarla para los
                // cálculos derivados garantiza que el numerador y el
                // denominador vivan en el mismo snapshot del motor. Cuando
                // el preview se actualiza, `previewQuantity` se actualiza
                // también y los displays convergen sin frame intermedio. */
                const appliedQty    = (typeof meta?.previewQuantity === "number"
                  && Number.isFinite(meta.previewQuantity)
                  && meta.previewQuantity > 0)
                  ? meta.previewQuantity
                  : qty;
                // Base sobre la que se calcula el % de bonificación VISUAL.
                // Prioridad:
                //   1) `meta.manualPrice` — si el operador puso precio manual,
                //      ese es el monto sobre el que se aplica la bonificación
                //      (alineado con el motor del backend que también la
                //      aplica sobre el manualPrice cuando ambos coexisten).
                //   2) `meta.basePrice` — precio de lista (sin manual).
                //   3) `l.unitPrice` — fallback final.
                //
                // Bug fix: antes este valor caía a `meta.basePrice` aunque
                // hubiera manualPrice → con precio manual 10 y bonif 10%, el
                // label mostraba `−$82.893,75` (10% sobre la lista vieja) en
                // lugar de `−$1,00` (10% sobre 10).
                const basePriceForPct =
                  (meta?.manualPrice != null && meta.manualPrice > 0)
                    ? meta.manualPrice
                    : (meta?.basePrice && meta.basePrice > 0)
                      ? meta.basePrice
                      : (l.unitPrice ?? 0);
                const isPct = getDiscountType(l.id) === "percent";
                const fmtPct = (n: number) =>
                  `${formatByType(n, "PERCENT", { bare: true })}%`;
                const discAppliesTo = getDiscountAppliesTo(l.id);
                // Tipo de ajuste efectivo de la línea: BONUS (resta) o
                // SURCHARGE (suma).
                //
                // Cascada de fuentes (cero recálculo: solo lectura):
                //   0. Optimistic local (`optimisticKindByLineId.get(l.id)`):
                //      el operador eligió un kind en el dropdown — feedback
                //      INMEDIATO sin esperar el round-trip al backend. Se
                //      limpia cuando el preview confirma el mismo kind o
                //      cuando se limpia el override con la X.
                //   1. Manual: `pricingMeta.manualDiscount.kind` (override
                //      explícito del operador, ya confirmado por el motor).
                //   2. Cliente heredado: `meta.inheritedDiscount.ruleType`
                //      → "SURCHARGE" → "SURCHARGE"; "DISCOUNT"/"BONUS" → "BONUS".
                //      El motor ya lo aplicó por clientId; aquí solo se LEE
                //      para renderizar label/badge correctos.
                //   3. Default BONUS (back-compat / sin info).
                //
                // El frontend NO calcula nada con esto — solo decide qué
                // mostrar y qué intención mandar al motor cuando el operador
                // edita.
                const inhRuleType = meta?.inheritedDiscount?.ruleType ?? null;
                const inheritedKind: "BONUS" | "SURCHARGE" | null =
                  inhRuleType === "SURCHARGE" ? "SURCHARGE"
                  : (inhRuleType === "DISCOUNT" || inhRuleType === "BONUS") ? "BONUS"
                  : null;
                const optimisticKind = getOptimisticKind(l.id);
                // T16 — Cuando NO hay manual ni heredado configurado, el
                // kind visual se deriva del SIGNO NETO efectivo del motor:
                //   signedAdj = basePrice × qty − subtotal
                //   > 0 → BONUS (precio bajó)
                //   < 0 → SURCHARGE (precio subió)
                // Esto cubre el caso "promo + cliente de signos opuestos":
                // antes ambos eran "BONUS" por default, y el TPNumber
                // mostraba 0 cuando el neto era recargo. Cero matemática
                // nueva — `basePrice` y `subtotal` ya son passthrough motor.
                const _baseInitForKind =
                  (typeof meta?.basePrice === "number" && meta.basePrice > 0
                    ? meta.basePrice
                    : (l.unitPrice ?? 0)) * (Number.isFinite(l.quantity) ? l.quantity : 0);
                const _subtotalForKind =
                  typeof l.subtotal === "number" && Number.isFinite(l.subtotal)
                    ? l.subtotal : 0;
                // Con manualPrice activo, el delta lista vs subtotal NO refleja
                // bonif/recargo aplicado por el motor (salta qty/promo/customer);
                // forzar a 0 evita derivar kind del delta informativo.
                const _signedAdjForKind = hasManualPrice
                  ? 0
                  : (_baseInitForKind - _subtotalForKind);
                const netKindFromSign: "BONUS" | "SURCHARGE" | null =
                  Math.abs(_signedAdjForKind) > 0.005
                    ? (_signedAdjForKind > 0 ? "BONUS" : "SURCHARGE")
                    : null;
                const discKind: "BONUS" | "SURCHARGE" =
                  optimisticKind             ?? (
                  md?.kind === "SURCHARGE" ? "SURCHARGE"
                  : md?.kind === "BONUS"     ? "BONUS"
                  // T16 — sin manual: priorizar el signo NETO efectivo del
                  // motor sobre el heredado configurado del cliente. Si el
                  // neto es positivo (bonif), aunque el cliente esté
                  // configurado como SURCHARGE, mostrar BONUS porque eso
                  // es lo que efectivamente se aplicó. Heredado vale como
                  // fallback final.
                  : netKindFromSign         ?? inheritedKind ?? "BONUS"
                );
                const isSurcharge = discKind === "SURCHARGE";

                // ── Helper: resuelve qué valor mostrar ──────────────
                // Prioridad:
                //   1) MANUAL  — override del usuario (md.value)
                //   2) PROMO/QTY/MIXED — descuento automático del backend
                //   3) Cache  — último valor estable (anti-flicker entre
                //               previews que devolvieron breakdown vacío)
                //   4) NONE   — 0 (sin info)
                type DiscSource =
                  | "MANUAL" | "PROMOTION" | "QUANTITY_DISCOUNT" | "MIXED"
                  | "CLIENT" | "BACKEND_CACHE" | "NONE";
                const toBoth = (mode: "PERCENT" | "AMOUNT", value: number) =>
                  mode === "PERCENT"
                    ? { pct: value, unit: (basePriceForPct * value) / 100 }
                    : { pct: basePriceForPct > 0 ? (value / basePriceForPct) * 100 : 0, unit: value };

                let source: DiscSource = "NONE";
                let pctEff = 0;
                let unitEff = 0;
                let manualUnit = 0;
                let autoUnit = 0;
                let valueFromBackend = false;
                // La bonificación heredada del cliente NO se cachea: si se
                // cambia a un cliente sin bonificación, no debe quedar el %
                // del cliente anterior pegado vía cache.
                let cacheable = true;

                // 0 ES un valor manual válido — el usuario puede explícitamente
                // querer "sin descuento" reemplazando promo/qty discount auto.
                // Solo `md == null` significa "sin override". `md.value === 0`
                // es un override legítimo de "anular descuento".
                if (md != null) {
                  source = "MANUAL";
                  const both = toBoth(md.mode, md.value);
                  pctEff  = both.pct;
                  unitEff = both.unit;
                  manualUnit = both.unit;
                  valueFromBackend = true;
                } else if (hasQty || hasPromo) {
                  // T16 — Cuando hay PROMO/QTY (y eventualmente CLIENTE de
                  // signo opuesto), el TPNumber debe reflejar el NETO efectivo
                  // con su signo. El gate sigue siendo "hay al menos un
                  // automático per-unit detectable". El caso "solo cliente
                  // (SURCHARGE/DISCOUNT)" lo cubre la rama CLIENT más abajo
                  // (lee el valor CONFIGURADO de la regla heredada).
                  source = hasQty && hasPromo ? "MIXED" : hasQty ? "QUANTITY_DISCOUNT" : "PROMOTION";
                  // El TPNumber representa el DESCUENTO EFECTIVO COMERCIAL
                  // TOTAL de la línea — NO una reconstrucción suma-de-pasos
                  // del pipeline.
                  //
                  // Definición comercial:
                  //   "Lo que el cliente NO pagó respecto del precio de lista
                  //    bruto" = baseInitial − subtotalNet.
                  //
                  //   pctEff  = (baseInitial − subtotalNet) / baseInitial × 100
                  //   unitEff = (baseInitial − subtotalNet) / qty
                  //
                  // Es passthrough puro del motor (dos números, una división)
                  // y robusto contra inconsistencias per-unit / per-línea en
                  // cómo cada step emite su `discountAmount`. Caso que
                  // motivó este fix: cuando el motor emite el step
                  // ENTITY_COMMERCIAL_RULE con applyOn=TOTAL (el cliente
                  // aplica por LÍNEA, no per-unit), sumar steps con `× qty`
                  // uniformemente sub-cuenta el descuento del cliente y
                  // produce un % parcial (ej. 29,80% en lugar de 38,80%).
                  // Tomar el efectivo total (baseInitial − subtotalNet)
                  // evita esa ambigüedad porque mide el resultado, no
                  // los pasos.
                  //
                  // POLICY R6 — el `pricing-engine` sigue siendo única fuente
                  // de verdad: `meta.basePrice` y `l.subtotal` (= pl.lineTotal
                  // hidratado por applySalePreviewToDraft) ya vienen calculados
                  // por el motor; el frontend solo los resta y divide.
                  // Usa `appliedQty` (ancla del snapshot del motor), NO el
                  // `qty` local: si el operador acaba de tipear una qty
                  // nueva pero el preview todavía no respondió, queremos
                  // que `baseInitialLine` y `subtotalNet` correspondan al
                  // MISMO snapshot. Sin esto, parpadea un % intermedio.
                  const baseInitialLine =
                    (typeof meta?.basePrice === "number" && meta.basePrice > 0
                      ? meta.basePrice
                      : (l.unitPrice ?? 0)) * appliedQty;
                  const subtotalNet =
                    typeof l.subtotal === "number" && Number.isFinite(l.subtotal)
                      ? l.subtotal
                      : 0;
                  // T16 — NETO SIGNED: positivo = bonificación efectiva
                  // (precio bajó), negativo = recargo efectivo (precio
                  // subió). Antes el `Math.max(0, …)` clampeaba el caso
                  // SURCHARGE → el TPNumber mostraba 0,00 cuando un cliente
                  // con recargo > promo dejaba un neto positivo de recargo.
                  // Ahora usamos la magnitud absoluta para el display y el
                  // signo decide la dirección (bonif/recargo). El kind se
                  // alinea automáticamente abajo (`netKindFromSign`).
                  const signedAdj = baseInitialLine - subtotalNet;
                  const totalLineAdjEffective = Math.abs(signedAdj);
                  if (baseInitialLine > 0 && appliedQty > 0) {
                    autoUnit = totalLineAdjEffective / appliedQty;
                    unitEff  = autoUnit;
                    pctEff   = Math.round((totalLineAdjEffective / baseInitialLine) * 10000) / 100;
                  }
                  valueFromBackend = true;
                  // Anti-warn: `signedAdj` ya fue consumido vía `Math.abs`
                  // arriba; el signo se computa de nuevo en `netKindFromSign`
                  // (mismo origen, scope distinto). Sin matemática nueva.
                  void signedAdj;
                } else if (
                  // Ajuste comercial HEREDADO del cliente — display-only
                  // (origin=CLIENT). El motor ya lo aplicó por clientId;
                  // mostrar el valor NO lo reenvía (eso requiere
                  // manualOverrides.discount, que solo se setea al editar
                  // → MANUAL). Incluye los 3 ruleType del modelo: DISCOUNT,
                  // BONUS y SURCHARGE (recargo). El kind del frontend se
                  // deriva de `ruleType` más abajo (BONUS/DISCOUNT → "BONUS";
                  // SURCHARGE → "SURCHARGE").
                  //
                  // Excluir si hay manualPrice activo: el motor saltea la regla
                  // del cliente cuando hay precio manual (priceSource=
                  // MANUAL_OVERRIDE) → mostrar el % heredado en el TPNumber
                  // sería engañoso, porque NO se aplicó.
                  !hasManualPrice &&
                  meta?.inheritedDiscount &&
                  (meta.inheritedDiscount.ruleType === "DISCOUNT" ||
                    meta.inheritedDiscount.ruleType === "BONUS" ||
                    meta.inheritedDiscount.ruleType === "SURCHARGE") &&
                  // Representable en el TPNumber si la base es una de las 3
                  // simples (TOTAL/METAL/HECHURA — las que ofrece el combo
                  // "Aplica a"). El TPNumber muestra el % / monto CONFIGURADO
                  // (ej. 5%), no el monto aplicado (eso lo muestra el label
                  // verde con `l.discountAmount`): son datos distintos. Bases
                  // avanzadas (METAL_Y_HECHURA / SUBTOTAL_* / PRODUCT /
                  // SERVICE) → chip-only (no representables en el combo).
                  (meta.inheritedDiscount.applyOn == null ||
                    meta.inheritedDiscount.applyOn === "TOTAL" ||
                    meta.inheritedDiscount.applyOn === "METAL" ||
                    meta.inheritedDiscount.applyOn === "HECHURA") &&
                  // FIXED_AMOUNT en moneda base con documento convertido NO
                  // es representable como número → chip-only (no inventar
                  // equivalencia). PERCENTAGE y FIXED_AMOUNT con doc==base sí.
                  meta.inheritedDiscount.fixedAmountInBaseOnly !== true &&
                  typeof meta.inheritedDiscount.value === "number" &&
                  meta.inheritedDiscount.value > 0
                ) {
                  source = "CLIENT";
                  const inhMode = meta.inheritedDiscount.valueType === "FIXED_AMOUNT"
                    ? "AMOUNT" : "PERCENT";
                  const both = toBoth(inhMode, meta.inheritedDiscount.value);
                  pctEff  = both.pct;
                  unitEff = both.unit;
                  valueFromBackend = true;
                  cacheable = false; // nunca cachear lo heredado del cliente
                  // Purga defensiva: una bonificación heredada NUNCA debe
                  // servirse desde el cache de otro cliente/estado anterior.
                  lastDiscountByLine.current.delete(l.id);
                }

                // Cache de fallback — solo se consulta si no hay info nueva.
                //
                // Con manualPrice activo y SIN manualDiscount: el TPNumber
                // queda en 0 (NONE). NO consultar el cache (mostraría el % de
                // un descuento auto previo que el motor ya saltó). NO cachear
                // tampoco. Purgar lo previo para que un manualPrice no deje
                // residuo si el operador después lo limpia.
                if (hasManualPrice && md == null) {
                  source = "NONE";
                  pctEff = 0;
                  unitEff = 0;
                  lastDiscountByLine.current.delete(l.id);
                } else if (!valueFromBackend) {
                  const cached = lastDiscountByLine.current.get(l.id);
                  if (cached && cached.articleId === l.articleId && (cached.pct > 0 || cached.unit > 0)) {
                    source  = "BACKEND_CACHE";
                    pctEff  = cached.pct;
                    unitEff = cached.unit;
                  }
                } else {
                  // Cache solo cuando el valor es legítimo (positivo) y NO
                  // es heredado del cliente (cacheable=false en ese caso).
                  if (cacheable && (pctEff > 0 || unitEff > 0)) {
                    lastDiscountByLine.current.set(l.id, {
                      articleId: l.articleId,
                      pct:  pctEff,
                      unit: unitEff,
                    });
                  }
                }

                // Nota: el monto de bonificación que se MUESTRA usa
                // `l.discountAmount` (motor), no un recálculo local — ver
                // más abajo. `unitEff`/`pctEff` solo alimentan el VALOR del
                // input (eco de lo que tipeó el operador), no el importe.
                const isManualBonif  = source === "MANUAL";
                // Heredado del cliente: representable (muestra número 13.00) o
                // solo-chip (METAL/HECHURA/BONUS/SURCHARGE → sin número
                // engañoso, consistente con Fase A).
                const isClientBonif  = source === "CLIENT";
                const inhRule        = meta?.inheritedDiscount ?? null;
                const inhChipOnly    =
                  !!inhRule && !isClientBonif && !isManualBonif &&
                  inhRule.ruleType != null && (inhRule.value ?? 0) > 0;
                // Fix B — cuando la bonificación es HEREDADA del cliente, el
                // símbolo/display los gobierna `valueType` del cliente, NO el
                // toggle local: FIXED_AMOUNT/AMOUNT → $, PERCENTAGE → %. Al
                // editar pasa a MANUAL y el toggle local vuelve a mandar.
                const inhVT = inhRule?.valueType;
                const discIsPct = isClientBonif
                  ? (inhVT !== "FIXED_AMOUNT" && inhVT !== "AMOUNT")
                  : isPct;

                // % desglosado para el detalle textual debajo (tooltip):
                const qtyDiscPct = basePriceForPct > 0
                  ? Math.round((qtyDiscUnit / basePriceForPct) * 10000) / 100
                  : 0;
                const promoBaseUnit = Math.max(0, basePriceForPct - qtyDiscUnit);
                const promoDiscPct = promoBaseUnit > 0
                  ? Math.round((promoDiscUnit / promoBaseUnit) * 10000) / 100
                  : 0;

                // commit del usuario — manda override al backend con el
                // mode actual del toggle.
                //
                // Bug fix: 0 ES un valor manual válido. Si el usuario edita
                // 20 → 0, queremos congelar el descuento en 0 (no volver al
                // auto). Solo "Restablecer línea" limpia el override
                // (pasando manualDiscount=null vía resetLine).
                //
                // NO usar `if (!rawValue)` ni `if (rawValue === 0)` para
                // limpiar — ambos serían bugs (0 entra como falsy).
                function commitBonifChange(rawValue: number) {
                  if (onApplyLineOverrides && (l.articleId || l.isManual)) {
                    onApplyLineOverrides(l.id, {
                      manualDiscount: {
                        mode:      discIsPct ? "PERCENT" : "AMOUNT",
                        value:     rawValue,
                        appliesTo: discAppliesTo,
                        kind:      discKind,
                      },
                    });
                  } else {
                    // Path legacy (sin handler de overrides): pisamos
                    // discountAmount directo. NO recomendado — solo para
                    // pantallas que aún no migraron al doc preview.
                    const newBonifUnit = isPct
                      ? (basePriceForPct > 0 ? (basePriceForPct * rawValue) / 100 : 0)
                      : rawValue;
                    updateLine(l.id, { discountAmount: newBonifUnit * qty });
                  }
                }

                // Aviso visual cuando hay descuento auto y el usuario aún
                // no fijó manual: dejar claro qué pasaría si edita.
                const bonifNotice =
                  hasQty && hasPromo
                    ? "Bonificación manual reemplaza promoción + descuento por cantidad"
                    : hasPromo
                      ? "Bonificación manual reemplaza la promoción"
                      : hasQty
                        ? "Bonificación manual reemplaza el descuento por cantidad"
                        : undefined;

                // ─── Binding del TPNumber de Bonificación ─────────────────
                // REGLA UX (revisada): el TPNumber refleja el DESCUENTO
                // EFECTIVO de la línea, sea cual sea su origen (manual,
                // cliente, promo+qty+cliente combinados). Mostrar `0` cuando
                // el motor ya aplicó descuentos confundía al operador: veía
                // el card "Ajustes aplicados: −$X" pero el input principal
                // decía 0,00 → contradicción visual.
                //
                // Cascada:
                //   · `source === "NONE"` → 0 (no hay descuentos).
                //   · Cualquier otro origen → mostrar el efectivo
                //     (`pctEff` o `unitEff`), que ya está calculado por el
                //     motor según los `manualDiscount`/`qtyDiscount`/
                //     `promoDiscount` aplicados a la línea.
                //
                // Cuando el operador edita el TPNumber, `commitBonifChange`
                // sigue convirtiéndolo a override manual igual que antes. El
                // chip "Promo: <nombre>" / "Desc. cantidad" debajo del input
                // sigue diciendo "Auto" para que el operador sepa cuál es el
                // origen del valor actual. POLICY R6 — passthrough estricto
                // del motor, NO se recalcula nada.
                const displayValue =
                  source === "NONE" ? 0 : (discIsPct ? pctEff : unitEff);

                // Bonificación EFECTIVA aplicada por el motor (`l.discountAmount`,
                // hidratado desde `pl.lineDiscount`). El label verde y el badge
                // "Cliente"/"Aplicada por el sistema" SOLO deben renderizarse si
                // hay un descuento realmente aplicado (> 0). Sin esto, al pasar
                // de un cliente con bonificación a uno SIN bonificación quedaba
                // el badge "Cliente" + un monto residual ("−US$ 0.01") aunque
                // el descuento efectivo fuese 0. El valor lo gobierna el
                // backend; acá solo se decide si mostrar (cero recálculo).
                // Para BONUS: el motor expone el monto efectivo en
                // `l.discountAmount` (hidratado de `pl.lineDiscount`).
                // Para SURCHARGE: el motor clampea `lineDiscount` a 0
                // (semánticamente NO es descuento), pero el recargo está
                // expresado en la SUBA del precio unitario: la diferencia
                // `(unitPrice − basePrice) × qty`. Es display puro derivado
                // de dos valores YA emitidos por el motor (sin recálculo
                // comercial). Mantiene la fuente de verdad en backend.
                // SURCHARGE: la diferencia (unitPrice − basePrice) × qty
                // debe usar `appliedQty` (snapshot del motor) por la misma
                // razón anti-flicker que `baseInitialLine` arriba.
                const baseLineAmount = basePriceForPct * appliedQty;
                const appliedDiscount = isSurcharge
                  ? Math.max(0, ((l.unitPrice ?? 0) * appliedQty) - baseLineAmount)
                  : (typeof l.discountAmount === "number" && Number.isFinite(l.discountAmount)
                      ? l.discountAmount
                      : 0);
                const hasAppliedDiscount = appliedDiscount > 0;

                // Fase 2 — Opción A: el input de bonificación es siempre
                // editable mientras el caller proporcione `onApplyLineOverrides`
                // (Factura). Cuando el usuario edita, automáticamente pasa a
                // manual y reemplaza la promo/desc cantidad del motor en esa
                // línea. Solo en pantallas legacy sin handler de overrides
                // se mantiene el bloqueo histórico.
                const canManualBonif  = !!onApplyLineOverrides && (!!l.articleId || l.isManual === true);
                const lockedByBackend = !canManualBonif && !isManualBonif && (hasPromo || hasQty);
                // Monto del descuento automático que sería reemplazado por el
                // override manual (display only, passthrough motor). Cuando
                // el operador escribe un manual, perdemos los pasos del motor
                // (el pricing-engine sustituye los automáticos por el
                // override), pero los campos legacy `quantity/promotion/
                // customerDiscountAmount` pueden seguir presentes en el meta
                // como "lo que el motor calculaba ANTES del override". Si el
                // motor los nullea, el monto agregado queda en 0 y la nota
                // se renderiza sin paréntesis (solo cualitativa).
                //
                // POLICY R6 — cero recálculo. `qtyDiscUnit`/`promoDiscUnit`
                // ya están leídos de `meta.*DiscountAmount` (per-unit); el
                // cliente (`customerDiscountAmount`) viene per-línea entera.
                const customerLineAmount =
                  typeof meta?.customerDiscountAmount === "number" &&
                  Number.isFinite(meta.customerDiscountAmount)
                    ? meta.customerDiscountAmount
                    : 0;
                // Mismo principio: la suma * qty unitario usa la qty del
                // snapshot del motor para evitar mezclar qty nuevo con
                // unitarios viejos.
                const automaticAmountIfNoOverride =
                  (qtyDiscUnit + promoDiscUnit) * appliedQty + customerLineAmount;
                // Texto cualitativo que `bonifNotice` ya provee — se renderiza
                // como tooltip ampliado cuando hay manual + auto disponible.
                void bonifNotice;

                // Selector Bonificación / Recargo. El dropdown del header
                // llama `selectKind("BONUS"|"SURCHARGE")` con el destino.
                // Tres ramas claramente comentadas — ver casos a/b/c abajo.
                const adjLabel = isSurcharge ? "Bonificación" : "Bonificación"; // (placeholder, recomputed below)
                const adjSign  = isSurcharge ? "+" : "−";
                // ↑ Mantenemos los nombres para no romper consumidores
                // existentes, pero `adjLabel` real es:
                const adjLabelText = isSurcharge ? "Recargo" : "Bonificación";
                const selectKind = (nextKind: "BONUS" | "SURCHARGE") => {
                  if (!onApplyLineOverrides || !(l.articleId || l.isManual)) return;
                  // Idempotente: si ya es el kind elegido, no patcheamos.
                  if (nextKind === discKind && md != null) return;
                  // OPTIMISTIC FIRST: actualizamos el state local antes del
                  // patch. El render usa esta cascada como source-of-truth
                  // visual mientras el preview backend va y vuelve. Garantiza
                  // que el label/signo/color cambian en el MISMO click.
                  setOptimisticKind(l.id, nextKind);
                  if (md && md.value > 0) {
                    // (a) Override manual ya existente: re-commit con el
                    // kind elegido, preservando value / mode / appliesTo.
                    onApplyLineOverrides(l.id, {
                      manualDiscount: {
                        mode:      md.mode,
                        value:     md.value,
                        appliesTo: md.appliesTo ?? discAppliesTo,
                        kind:      nextKind,
                      },
                    });
                  } else if (isClientBonif && inhRule && typeof inhRule.value === "number" && inhRule.value > 0) {
                    // (b) Ajuste HEREDADO del cliente: el dropdown promueve
                    // la herencia a override MANUAL EXPLÍCITO con el kind
                    // elegido, preservando value/appliesTo. No mutamos la
                    // herencia: la cristalizamos en `manualDiscount`. Limpiar
                    // con la X devuelve a la herencia original.
                    const inhMode: "PERCENT" | "AMOUNT" =
                      inhRule.valueType === "FIXED_AMOUNT" || inhRule.valueType === "AMOUNT"
                        ? "AMOUNT" : "PERCENT";
                    onApplyLineOverrides(l.id, {
                      manualDiscount: {
                        mode:      inhMode,
                        value:     inhRule.value,
                        appliesTo: (inhRule.applyOn === "TOTAL" || inhRule.applyOn === "METAL" || inhRule.applyOn === "HECHURA")
                          ? (inhRule.applyOn as AppliesToScope)
                          : discAppliesTo,
                        kind:      nextKind,
                      },
                    });
                  } else {
                    // (c) Sin manual ni herencia representable. Si la línea
                    // tiene descuento automático visible (promo / desc. por
                    // cantidad), promovemos su EFECTIVO actual a manual con
                    // el kind elegido — preserva la intención visible del
                    // operador en lugar de perderla a 0.
                    //
                    // `pctEff`/`unitEff` son passthrough del motor
                    // (calculados con `appliedQty` del snapshot, no
                    // matemática nueva). Si no hay efectivo, queda 0 manual
                    // explícito (el operador eligió kind sin valor; al
                    // tipear, ese kind ya viaja).
                    const fallbackMode: "PERCENT" | "AMOUNT" = discIsPct ? "PERCENT" : "AMOUNT";
                    const fallbackVal  = fallbackMode === "PERCENT" ? pctEff : unitEff;
                    onApplyLineOverrides(l.id, {
                      manualDiscount: {
                        mode:      fallbackMode,
                        value:     Number.isFinite(fallbackVal) ? Math.max(0, fallbackVal) : 0,
                        appliesTo: discAppliesTo,
                        kind:      nextKind,
                      },
                    });
                  }
                };
                // Estado del dropdown solo para ESTA línea.
                const isKindMenuOpen = openKindMenuLineId === l.id;

                return (
                  <div>
                    {/* Wrapper `relative` LOCAL al header (trigger + menu).
                        `block` (no `inline-flex`) para que el header se
                        comporte igual que los `<div>` planos de Precio /
                        Impuestos / Total línea c/imp. → mismo flujo block,
                        misma altura natural, label alineado verticalmente
                        con los vecinos. `top-full` del menu cae a la altura
                        del wrapper (= altura del button), no al pie de la
                        celda completa. */}
                    {/* T38+T40 — Header de celda + ícono ⓘ pegado al label.
                        `h-[14px]` fija la altura del header para que el
                        TPNumber siguiente arranque a la misma altura que
                        en la celda Impuestos (idéntica altura de header
                        → inputs alineados verticalmente entre celdas). */}
                    <div className="flex h-[14px] items-center gap-1.5">
                    <div className="relative">
                    {/* Header de la celda = SELECTOR del tipo de ajuste.
                        Cumple el mismo tamaño/altura/alineación que el label
                        plano que existía antes (text-[9px] uppercase tracking
                        wide), pero ahora es un <button> con caret que abre
                        un dropdown contextual con "Bonificación" / "Recargo".
                        Tamaño: el button no agrega padding/border (Tailwind
                        preflight resetea ambos), así que la altura de la fila
                        no cambia. Color tenue según kind: emerald = bonif,
                        amber = recargo. Sin override ni herencia, el operador
                        no-developer ve "Bonificación ▾" en muted. */}
                    {canManualBonif ? (
                      <button
                        type="button"
                        data-tp-enter="ignore"
                        data-kind-menu-trigger
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setOpenKindMenuLineId(isKindMenuOpen ? null : l.id)}
                        aria-haspopup="menu"
                        aria-expanded={isKindMenuOpen}
                        aria-label={`Tipo de ajuste: ${adjLabelText}`}
                        title="Elegir tipo de ajuste"
                        className={cn(
                          // Mismo tipo de tipografía que los demás headers
                          // (Precio / Impuestos / Total línea c/imp.) que son
                          // <div className="text-[9px] font-semibold uppercase
                          // tracking-wide text-muted">. Sin `leading-none` ni
                          // `inline-flex`: heredamos el line-height del padre
                          // — eso es lo que hace que el input siguiente quede
                          // alineado verticalmente con los demás de la fila.
                          "flex items-center gap-[3px] text-[9px] font-semibold uppercase tracking-wide",
                          "rounded-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
                          // Color sutil indica kind sin gritar. Solo cuando
                          // el operador eligió/heredó algo NO neutro; sin
                          // datos cae a `text-muted` (= idéntico al label
                          // viejo de "Bonificación" plano).
                          (md != null || isClientBonif || inhChipOnly)
                            ? (isSurcharge
                                ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                                : "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300")
                            : "text-muted hover:text-text",
                        )}
                      >
                        <span aria-hidden className="tabular-nums">{adjSign}</span>
                        <span>{adjLabelText}</span>
                        <ChevronDown size={9} className="text-muted/70 shrink-0" aria-hidden />
                      </button>
                    ) : (
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">
                        {adjLabelText}
                      </div>
                    )}

                    {/* Dropdown del selector — overlay flotante. Posicionado
                        absoluto sobre el header (no empuja contenido); cae
                        debajo del trigger. Click fuera / Escape lo cierran
                        (handler global a nivel del editor). */}
                    {isKindMenuOpen && (
                      <div
                        ref={kindMenuRef}
                        role="menu"
                        aria-label="Tipo de ajuste"
                        // `top-full mt-1`: el menú cae 4 px debajo del trigger
                        // (el wrapper relative ahora envuelve SOLO el header).
                        // z-[80]: sobre filas/inputs vecinos sin chocar con
                        // el sistema de modales (que vive en z-[100+]).
                        className="absolute left-0 top-full z-[80] mt-1 min-w-[140px] rounded-md border border-border bg-card py-1 shadow-md"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          data-tp-enter="ignore"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { selectKind("BONUS"); setOpenKindMenuLineId(null); }}
                          className={cn(
                            "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
                            "hover:bg-surface2",
                            !isSurcharge && "text-emerald-600 dark:text-emerald-400 font-semibold",
                          )}
                        >
                          <span aria-hidden className="w-3 text-center text-emerald-600 dark:text-emerald-400">−</span>
                          <span>Bonificación</span>
                          {!isSurcharge && <Check size={12} className="ml-auto text-emerald-600 dark:text-emerald-400" aria-hidden />}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          data-tp-enter="ignore"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { selectKind("SURCHARGE"); setOpenKindMenuLineId(null); }}
                          className={cn(
                            "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
                            "hover:bg-surface2",
                            isSurcharge && "text-amber-600 dark:text-amber-400 font-semibold",
                          )}
                        >
                          <span aria-hidden className="w-3 text-center text-amber-600 dark:text-amber-400">+</span>
                          <span>Recargo</span>
                          {isSurcharge && <Check size={12} className="ml-auto text-amber-600 dark:text-amber-400" aria-hidden />}
                        </button>
                      </div>
                    )}
                    </div>{/* ← cierre del wrapper relative del header */}
                    {/* T38 — Ícono ⓘ arriba-derecha del input de Bonificación.
                        Anclado al header de la celda; abre popover con el
                        detalle de ajustes aplicados (Promo/Cliente/Cantidad/
                        Manual). Si no hay ajuste efectivo, no se renderiza. */}
                    <LineInfoPopover
                      hasContent={Math.abs(lineEffectiveAdjustmentSigned(l)) > 0.005}
                      ariaLabel="Ver detalle de ajustes aplicados"
                    >
                      <SaleLineDiscountSummary
                        line={l}
                        currency={currency}
                        displayRate={displayRate}
                        part="panel"
                        open
                      />
                    </LineInfoPopover>
                    </div>{/* ← cierre del flex wrapper T38 (header + ⓘ) */}

                    {lockedByBackend ? (
                      // ── Modo bloqueado: input read-only con el valor efectivo
                      // del backend + chips desglosados debajo. Mantenemos el
                      // TPNumberInput visible (disabled) para que el campo
                      // Bonificación NUNCA desaparezca de la línea.
                      <>
                        <div className="flex items-stretch gap-1">
                          <TPNumberInput
                            value={displayValue}
                            onChange={() => { /* read-only en modo bloqueado */ }}
                            formatType={discIsPct ? "PERCENT" : "MONEY"}
                            decimals={2}
                            min={0}
                            compact
                            readOnly
                            disabled
                            wrapClassName="flex-1 min-w-0"
                            className="tp-input-dense"
                          />
                          <span
                            className="inline-flex h-[34px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted/60"
                            title="Bonificación gobernada por el backend"
                          >
                            {discIsPct ? "%" : "$"}
                          </span>
                          {/* T37 — Ícono ⓘ se movió a la fila "Aplica a" más abajo. */}
                        </div>
                        {/* Sublabel conceptual: el TPNumber muestra el
                            DESCUENTO EFECTIVO ACUMULADO del pipeline, no
                            una regla suelta ni la suma de porcentajes. El
                            motor aplica promo → desc. cantidad → cliente
                            en cascada: 1 − (0.90 × 0.85 × 0.80) = 38,80%.
                            El tooltip explica el concepto al hover. */}
                        {source !== "NONE" && (
                          <div
                            data-tp-bonif-effective-label="true"
                            className="mt-0.5 text-[9px] italic text-muted/60"
                            title={
                              source === "MANUAL"
                                ? (bonifNotice
                                    ? `${bonifNotice}. El motor sustituye el descuento automático por el override.`
                                    : "Valor manual ingresado por el operador (reemplaza los descuentos automáticos en esta línea).")
                                : source === "CLIENT"
                                  ? "Descuento heredado de la regla del cliente."
                                  : "Descuento efectivo final del pipeline. El motor aplica promo / descuento por cantidad / cliente en cascada (no suma porcentajes). El % mostrado es el resultado acumulado."
                            }
                          >
                            {/* T9 + T24 — Sublabel compacto, colores semánticos:
                                · md.value === 0 → "Sin bonificación" /
                                  "Sin recargo" (estado neutro, muted).
                                · md.value > 0 → label "Manual" naranja
                                  (mismo tono que el override del precio).
                                · CLIENT / pipeline → verde si BONUS,
                                  naranja si SURCHARGE. */}
                            {source === "MANUAL"
                              ? ((md?.value ?? 0) <= 0.005
                                  ? (isSurcharge ? "Sin recargo" : "Sin bonificación")
                                  : <span className="font-semibold not-italic text-amber-600 dark:text-amber-400">Manual</span>)
                              : source === "CLIENT"
                                ? <span className={cn(
                                    "not-italic",
                                    isSurcharge
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                  )}>
                                    {isSurcharge ? "Recargo del cliente" : "Bonificación del cliente"}
                                  </span>
                                : <span className={cn(
                                    "not-italic",
                                    isSurcharge
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                  )}>
                                    {isSurcharge ? "Recargo acumulado" : "Bonificación acumulada"}
                                  </span>}
                          </div>
                        )}
                      {/* Resumen del desglose por origen — reemplaza los
                          badges sueltos ("Auto" / "Promo activa" / "Promo
                          ..." / "Desc. cantidad" / "Cliente" / "Manual" +
                          monto duplicado) por un bloque agrupado:
                            · Ajustes aplicados por el sistema (con totales)
                            · Ajuste manual (o "Sin ajuste manual")
                          El TPNumberInput de arriba queda intacto y
                          visualmente separado. */}
                      {/* T35 — Trigger "Ver ajustes" se movió a la celda
                          Total línea c/imp. (más abajo). La celda
                          Bonificación queda limpia: TPNumber + toggle
                          + Aplica a + sub-label de estado. */}
                      </>  /* rama BLOQUEADA */
                    ) : (
                      // ── Modo editable: input + toggle %/$ + badge "Manual" si aplica.
                      <>
                        <div className="flex items-stretch gap-1">
                          {/* Wrapper relative para alojar el overlay
                              "Calculando…" durante el round-trip del preview
                              (mismo patrón que el TPNumber de Precio). El
                              flujo lógico X → applyLineOverrides → state →
                              preview funciona correctamente (cubierto por
                              tests), pero el debounce de 200 ms + RTT del
                              fetch + render produce una ventana de 300-500
                              ms en la que el `displayValue` puede mostrar
                              el valor manual stale (porque `l.subtotal`/
                              `l.unitPrice` no se rehidratan hasta el
                              response). El overlay comunica al operador
                              que el motor está procesando, eliminando la
                              sensación de "no recalcula inmediatamente". */}
                          <div className="relative flex-1 min-w-0">
                          <TPNumberInput
                            value={displayValue}
                            onChange={(v) => commitBonifChange(Math.max(0, v ?? 0))}
                            formatType={discIsPct ? "PERCENT" : "MONEY"}
                            decimals={2}
                            min={0}
                            compact
                            className={cn("tp-input-dense", isCalculating && "opacity-60")}
                            // Etiqueta semántica de la X — la X de
                            // Bonificación PONE EL VALOR EN 0 como override
                            // manual explícito (NO restaura el automático).
                            // El motor recibe manualDiscount = { value: 0 }
                            // y aplica 0 reemplazando promo/qty/cliente. Los
                            // automáticos solo vuelven con "Restablecer línea"
                            // o reingreso del artículo (acciones explícitas).
                            clearAriaLabel="Poner bonificación en 0"
                            clearTitle="Poner bonificación en 0"
                            // X interna: setea override manual con value=0
                            // preservando mode/appliesTo/kind actuales. Eso
                            // mantiene `manualOverrides.discount = true` y
                            // `meta.manualDiscount = { value: 0, ... }` → el
                            // siguiente preview manda manualDiscountOverride
                            // con value 0 → el motor aplica 0 manual y NO
                            // recalcula promo/qty/cliente. Pills y card
                            // automáticos siguen ocultos (porque hasManual
                            // sigue true).
                            // Aparece solo cuando hay valor visible (> 0)
                            // y el contexto permite override.
                            onClear={
                              // canManualBonif ya implica !!onApplyLineOverrides.
                              // Borramos también el optimistic kind para que
                              // el render vuelva inmediatamente al kind base
                              // (manualDiscount={value:0} sigue siendo BONUS
                              // por default si no hay kind previo; preservamos
                              // el `discKind` actual para no perder la
                              // intención del operador).
                              canManualBonif && (displayValue ?? 0) > 0
                                ? () => {
                                    clearOptimisticKind(l.id);
                                    onApplyLineOverrides!(l.id, {
                                      manualDiscount: {
                                        mode:      discIsPct ? "PERCENT" : "AMOUNT",
                                        value:     0,
                                        appliesTo: discAppliesTo,
                                        kind:      discKind,
                                      },
                                    });
                                  }
                                : undefined
                            }
                          />
                          {isCalculating && (
                            <div
                              data-tp-bonif-calculating="true"
                              className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center"
                              title="Recalculando descuento…"
                            >
                              <Loader2 size={11} className="animate-spin text-primary/80" />
                            </div>
                          )}
                          </div>
                          <button
                            type="button"
                            data-tp-enter="ignore"
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (!onApplyLineOverrides || !(l.articleId || l.isManual)) return;
                              const nextIsPct = !discIsPct;
                              const nextMode: "PERCENT" | "AMOUNT" = nextIsPct ? "PERCENT" : "AMOUNT";
                              setDiscountType(l.id, nextIsPct ? "percent" : "amount");
                              if (md && md.value > 0) {
                                // (a) Manual existente: cambia mode preservando
                                // kind/appliesTo. Convierte el valor entre %
                                // y monto usando `basePriceForPct` (lectura,
                                // no recálculo comercial).
                                let newValue = md.value;
                                if (md.mode === "PERCENT" && !nextIsPct) {
                                  newValue = (basePriceForPct * md.value) / 100;
                                } else if (md.mode === "AMOUNT" && nextIsPct) {
                                  newValue = basePriceForPct > 0 ? (md.value / basePriceForPct) * 100 : 0;
                                }
                                onApplyLineOverrides(l.id, {
                                  manualDiscount: {
                                    mode:      nextMode,
                                    value:     Math.max(0, Math.round(newValue * 100) / 100),
                                    appliesTo: discAppliesTo,
                                    kind:      discKind,
                                  },
                                });
                              } else if (isClientBonif && inhRule && typeof inhRule.value === "number" && inhRule.value > 0) {
                                // (b) Herencia del cliente sin manual aún: el
                                // toggle de modo PROMUEVE la herencia a override
                                // manual EXPLÍCITO con el `mode` opuesto al
                                // valueType heredado. Antes el click solo
                                // actualizaba un state local pero `discIsPct`
                                // seguía gobernado por `inhVT` → el botón "no
                                // respondía". Ahora cristaliza la intención
                                // (preserva value/appliesTo/kind) y el motor
                                // recibe el patch.
                                onApplyLineOverrides(l.id, {
                                  manualDiscount: {
                                    mode:      nextMode,
                                    value:     inhRule.value,
                                    appliesTo: discAppliesTo,
                                    kind:      discKind,
                                  },
                                });
                              }
                              // (c) Sin manual ni herencia: el state local
                              // alcanza para reflejar el cambio en el render
                              // (el TPNumberInput re-formatea su valor 0).
                            }}
                            title={`Cambiar a ${isPct ? "importe" : "porcentaje"}`}
                            aria-label="Cambiar tipo de bonificación"
                            // Clases NEUTRALES idénticas al botón %/$ de
                            // Impuestos (línea ~3123). El color semántico
                            // del kind (verde BONUS / ámbar SURCHARGE) vive
                            // solo en el label superior, el badge "Manual /
                            // Cliente" y el monto aplicado. Mantener el
                            // botón %/$ neutral evita que dos chips de color
                            // compitan visualmente y alinea estructura con
                            // la celda de Impuestos.
                            className="inline-flex h-[34px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted transition hover:bg-surface2/60 hover:text-text"
                          >
                            {discIsPct ? "%" : "$"}
                          </button>
                          {/* T37 — Ícono ⓘ se movió a la fila "Aplica a" más abajo. */}
                        </div>
                        {/* Sublabel conceptual: el TPNumber muestra el
                            DESCUENTO EFECTIVO ACUMULADO del pipeline, no
                            una regla suelta ni la suma de porcentajes. El
                            tooltip explica el concepto al hover.
                            Mismo bloque que la rama bloqueada arriba —
                            unificado para coherencia visual entre modos. */}
                        {/* T40 — Sublabel de estado ENTRE el TPNumber y el
                            "Aplica a" (Manual / Cliente / Bonificación
                            acumulada / Sin bonificación). Wrapper con
                            `min-h-[14px]` SIEMPRE renderizado: cuando no
                            hay sublabel, ocupa el espacio igual para que el
                            combo "Aplica a" quede alineado verticalmente
                            con el combo "Aplica a" de la celda Impuestos
                            (que también reserva el mismo espacio). */}
                        <div
                          data-tp-bonif-effective-label="true"
                          className="mt-0.5 min-h-[14px] text-[9px] italic leading-tight text-muted/60"
                          title={
                            source === "MANUAL"
                              ? (bonifNotice
                                  ? `${bonifNotice}. El motor sustituye el descuento automático por el override.`
                                  : "Valor manual ingresado por el operador (reemplaza los descuentos automáticos en esta línea).")
                              : source === "CLIENT"
                                ? "Descuento heredado de la regla del cliente."
                                : source === "MIXED" || source === "PROMOTION" || source === "QUANTITY_DISCOUNT"
                                  ? "Descuento efectivo final del pipeline. El motor aplica promo / descuento por cantidad / cliente en cascada (no suma porcentajes). El % mostrado es el resultado acumulado."
                                  : undefined
                          }
                        >
                          {source === "NONE"
                            ? <>&nbsp;</>
                            : source === "MANUAL"
                              ? ((md?.value ?? 0) <= 0.005
                                  ? (isSurcharge ? "Sin recargo" : "Sin bonificación")
                                  : <span className="font-semibold not-italic text-amber-600 dark:text-amber-400">Manual</span>)
                              : source === "CLIENT"
                                ? <span className={cn(
                                    "not-italic",
                                    isSurcharge
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                  )}>
                                    {isSurcharge ? "Recargo del cliente" : "Bonificación del cliente"}
                                  </span>
                                : <span className={cn(
                                    "not-italic",
                                    isSurcharge
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                  )}>
                                    {isSurcharge ? "Recargo acumulado" : "Bonificación acumulada"}
                                  </span>}
                        </div>
                        {/* "Aplica a" — se oculta cuando scope=TOTAL y no
                            hay alternativas (ruido puro). Si la línea tiene
                            metal/hechura (hay scopes reales) o el scope ya
                            NO es TOTAL, se sigue mostrando. */}
                        {onApplyLineOverrides
                          && (discAppliesTo !== "TOTAL" || getAvailableScopes(l, "DISCOUNT").length > 1) && (
                          <div className="mt-0.5">
                            <AppliesToLink
                              value={discAppliesTo}
                              scopes={getAvailableScopes(l, "DISCOUNT")}
                              onChange={(next) => {
                                setDiscountAppliesTo(l.id, next);
                                // Cero matemática nueva: `pctEff`/`unitEff`
                                // ya vienen del motor (passthrough en
                                // `selectInvoiceLineView`); acá solo armamos
                                // la intención manual a reenviar.
                                const md2     = l.pricingMeta?.manualDiscount ?? null;
                                const curMode = (md2?.mode ?? (discIsPct ? "PERCENT" : "AMOUNT")) as "PERCENT" | "AMOUNT";
                                const curVal  = md2 != null
                                  ? md2.value
                                  : (curMode === "PERCENT" ? pctEff : unitEff);
                                onApplyLineOverrides(l.id, {
                                  manualDiscountAppliesTo: next,
                                  manualDiscount: {
                                    mode:      curMode,
                                    value:     Number.isFinite(curVal) ? curVal : 0,
                                    appliesTo: next,
                                    kind:      md2?.kind ?? discKind,
                                  },
                                });
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Cell IMPUESTOS — TPNumber siempre editable (sin toggle de
                  "Editando"), igual que Bonificación. Cualquier cambio del
                  valor o del selector %/$ envía un override al backend; el
                  motor recalcula. El frontend NO calcula impuestos — solo
                  expone el override. */}
              {showTax && (() => {
                const meta      = l.pricingMeta;
                const exempt    = meta?.taxExemptByEntity === true;
                const override  = meta?.taxOverride ?? null;
                // FIX label stale — el operador borró/puso 0 el impuesto:
                // intención EXPLÍCITA de "sin impuesto". El label NO debe
                // revivir el IVA anterior ni el monto anterior (ni desde
                // `composition.taxes`/`taxBreakdown`/cache de rate). Se trata
                // como "sin impuesto" y se limpia el bloque inferior. El
                // total línea c/ imp. ya viene correcto del backend.
                const taxZeroed = isTaxClearedOverride(override);
                const breakdown = meta?.taxBreakdown ?? [];
                const items     = exempt ? [] : breakdown;
                const qty       = Number.isFinite(l.quantity) ? l.quantity : 0;
                // Importe de impuesto de la línea = SIEMPRE el del motor
                // (`l.taxAmount`, ya hidratado por `selectInvoiceLineView` /
                // `applySalePreviewToDraft`). FUENTE ÚNICA del "+$" que se
                // muestra debajo del input: es el MISMO valor que consume la
                // celda "Total línea c/ imp." (ahí se llama `lineTax`). No se
                // deriva del rate ni de qty en frontend (eso divergía del
                // total y revivía importes viejos del cache de rate). Para
                // derivar el % visible sí se usa una cascada estable aparte
                // (`taxRateStable`), porque el % no debe parpadear con qty.
                const taxLineTotal = exempt
                  ? 0
                  : (typeof l.taxAmount === "number" && Number.isFinite(l.taxAmount)
                      ? l.taxAmount
                      : 0);
                // Base imponible unitaria (precio neto unitario).
                const taxBaseUnit  = (l.unitPrice && l.unitPrice > 0)
                  ? l.unitPrice
                  : (meta?.basePrice ?? 0);

                // ── Tasa estable bajo cambios de cantidad ─────────────
                // Bug fix flicker: el % visible NO debe derivarse de
                // `taxAmount / qty` porque taxAmount queda STALE durante
                // el debounce del preview. Lo tomamos de fuentes estables,
                // en orden:
                //   1) override manual (lo que el usuario fijó)
                //   2) rate explícito del taxBreakdown (1 ítem, ej. IVA 21)
                //   3) suma de rates si multi-impuesto y todos tienen rate
                //   4) cache de último rate visto (anti-flicker entre previews)
                //   5) 0 (sin info)
                let taxRateStable: number = 0;
                let rateFromBackend = false;
                // Cliente exento: el impuesto efectivo es 0. Marcamos
                // rateFromBackend para NO leer el cache (evita revivir el
                // 21% del artículo) y dejar taxRateStable en 0.
                if (exempt) rateFromBackend = true;
                // Sin impuesto (exento o override borrado/0) → purgar el
                // cache de rate de esta línea para que un cambio posterior
                // (otro cliente / otra tasa) NUNCA reviva el 21% viejo.
                if (exempt || taxZeroed) lastTaxRateByLine.current.delete(l.id);
                if (override?.mode === "PERCENT") {
                  taxRateStable = override.value;
                  rateFromBackend = true;
                } else if (items.length === 1 && typeof items[0].rate === "number") {
                  taxRateStable = items[0].rate;
                  rateFromBackend = true;
                } else if (items.length > 1) {
                  const allHaveRate = items.every((it) => typeof it.rate === "number");
                  if (allHaveRate) {
                    taxRateStable = items.reduce((s, it) => s + (it.rate as number), 0);
                    rateFromBackend = true;
                  }
                }
                // Si el backend NO dio una rate confiable este render,
                // usamos el último valor cacheado para no parpadear a 0.
                // El cache se ignora si el artículo cambió (no filtramos
                // la rate del artículo viejo a uno nuevo).
                if (!rateFromBackend) {
                  // Guard anti-stale: si la línea tiene impuesto CERO explícito
                  // (sin override, sin breakdown, taxAmount 0) el cache NO debe
                  // resucitar una tasa de otro cliente/contexto (ej.: volver a
                  // un cliente exento dejaba el 21% del cliente anterior vía
                  // cache). Una tasa cacheada nunca pisa un impuesto 0 real.
                  const explicitZeroTax =
                    !override &&
                    items.length === 0 &&
                    typeof l.taxAmount === "number" &&
                    l.taxAmount === 0;
                  if (explicitZeroTax) {
                    lastTaxRateByLine.current.delete(l.id);
                  }
                  const cached = explicitZeroTax
                    ? undefined
                    : lastTaxRateByLine.current.get(l.id);
                  if (cached && cached.articleId === l.articleId && cached.rate > 0) {
                    taxRateStable = cached.rate;
                  }
                  // Fallback final — fix de inconsistencia visual:
                  // si tras agotar override / breakdown.rate / cache aún queda
                  // 0 PERO el motor calculó `l.taxAmount > 0` (ej. tributos
                  // FIXED_AMOUNT o PERCENTAGE_PLUS_FIXED sin `rate` explícito),
                  // derivamos la tasa efectiva del propio importe del backend.
                  // Sin esto, el input quedaba en 0,00% mientras el label
                  // "Impuestos: ARS X" mostraba un monto > 0 — dos fuentes
                  // distintas. Con esto, ambos consumen `l.taxAmount` y
                  // convergen al mismo valor.
                  if (
                    taxRateStable === 0 &&
                    typeof l.taxAmount === "number" &&
                    l.taxAmount > 0 &&
                    qty > 0 &&
                    taxBaseUnit > 0
                  ) {
                    taxRateStable = (l.taxAmount / qty / taxBaseUnit) * 100;
                  }
                } else {
                  // Cacheamos el rate confiable + articleId actual.
                  lastTaxRateByLine.current.set(l.id, { articleId: l.articleId, rate: taxRateStable });
                }

                // Unit tax derivado del rate estable (NO de taxAmount/qty).
                // SOLO se usa para el VALOR del input cuando el operador
                // está en modo AMOUNT y todavía no fijó un override (mientras
                // tanto mostramos una estimación del unitario). El IMPORTE
                // monetario que se muestra como "+$" NO se deriva de acá:
                // ese sale del motor (`l.taxAmount`) — ver `taxLineTotal`.
                const taxUnitStable = override?.mode === "AMOUNT"
                  ? override.value
                  : (taxBaseUnit * taxRateStable) / 100;

                const fmtPct = (n: number) =>
                  `${formatByType(n, "TAX_PERCENT", { bare: true })}%`;
                const hasMany = items.length > 1;
                // Modo del selector %/$ — toggle persistido localmente igual
                // que en Bonificación (`getTaxType`).
                const isPct = getTaxType(l.id) === "percent";
                // Prioridad de display:
                //   1) override MANUAL — decisión explícita del operador,
                //      gana INCLUSO si el cliente es exento (la exención es
                //      un default, no un candado: el motor ya respeta el
                //      override sobre la exención).
                //   2) exento sin override → 0 (default de hidratación).
                //   3) rate/unit estable del motor.
                const displayValue = override
                  ? override.value
                  : exempt
                    ? 0
                    : (isPct ? taxRateStable : taxUnitStable);
                // La exención NO bloquea el input: el operador puede cargar
                // impuesto manual sobre un cliente exento (queda en 0 hasta
                // que escriba). Editable mientras haya artículo/manual + handler.
                const canEdit = (!!l.articleId || l.isManual === true) && !!onSetLineTaxOverride;

                return (
                  <div>
                    {/* T38+T40 — Header de celda Impuestos + ícono ⓘ pegado
                        al label. `h-[14px]` idéntico a la celda Bonificación
                        → TPNumber arranca a la misma altura → inputs
                        alineados verticalmente entre celdas. */}
                    <div className="flex h-[14px] items-center gap-1.5">
                      {/* Selector rápido — click en "Impuestos" permite marcar
                          uno o varios impuestos porcentuales existentes; la SUMA
                          de sus tasas se carga en el ÚNICO `taxOverride` (PERCENT)
                          que el contrato soporta. No es multi-impuesto real:
                          el backend recibe un solo override. Sin impuestos o sin
                          permiso de edición → label plano (comportamiento previo). */}
                      <LineTaxQuickPicker
                        taxes={availableTaxes ?? []}
                        disabled={!canEdit}
                        onApply={(sumPercent) => {
                          setTaxType(l.id, "percent");
                          onSetLineTaxOverride!(l.id, {
                            mode:      "PERCENT",
                            value:     sumPercent,
                            appliesTo: getTaxAppliesTo(l.id),
                          });
                        }}
                      />
                      <LineInfoPopover
                        hasContent={
                          !exempt && !taxZeroed
                          && (taxLineTotal > 0 || (!!override && override.value > 0))
                        }
                        ariaLabel="Ver detalle de impuestos"
                      >
                        {renderLineTaxDetailPanel(l)}
                      </LineInfoPopover>
                    </div>
                    {/* TPNumber + selector %/$ — siempre editables si la
                        línea no es exenta. */}
                    <div className="flex items-stretch gap-1">
                      <TPNumberInput
                        value={displayValue}
                        formatType={isPct ? "TAX_PERCENT" : "MONEY"}
                        onChange={(v) => {
                          if (!canEdit) return;
                          const raw = Math.max(0, v ?? 0);
                          onSetLineTaxOverride!(l.id, {
                            mode:      isPct ? "PERCENT" : "AMOUNT",
                            value:     raw,
                            appliesTo: getTaxAppliesTo(l.id),
                          });
                        }}
                        decimals={2}
                        min={0}
                        compact
                        readOnly={!canEdit}
                        wrapClassName="flex-1 min-w-0"
                        className="tp-input-dense"
                        // Etiqueta semántica de la X — comunica QUÉ hace al
                        // limpiar. La X de Impuestos PONE EL VALOR EN 0 como
                        // override manual explícito (NO restaura el automático).
                        // El motor recibe taxOverride = { value: 0 } y aplica
                        // 0 reemplazando IVA configurado / exención del
                        // cliente. Los automáticos solo vuelven con
                        // "Restablecer línea" o reingreso del artículo.
                        // Coherente con la X de Bonificación.
                        clearAriaLabel="Poner impuesto en 0"
                        clearTitle="Poner impuesto en 0"
                        // X interna: setea override manual con value=0
                        // preservando mode/appliesTo actuales. Eso mantiene
                        // `manualOverrides.tax = true` y `meta.taxOverride =
                        // { value: 0, ... }` → el siguiente preview manda
                        // taxOverride con value 0 → el motor aplica 0 manual
                        // y NO reactivar IVA/exención. El badge "Impuesto
                        // manual" se reemplaza por null (`taxZeroed===true`
                        // gana en la cascada del badge — sin label sucio).
                        // Aparece solo cuando hay valor visible (> 0).
                        //
                        // Anti-flicker durante el round-trip del preview:
                        // limpiamos también el cache local `lastTaxRateByLine`
                        // para que la tasa vieja NO reaparezca un frame en lo
                        // que llega el preview con el value=0 hidratado.
                        onClear={
                          // El bloque editable ya solo se renderiza cuando
                          // hay onSetLineTaxOverride definido (mismo guard
                          // que el onChange de arriba con `!`).
                          canEdit && (displayValue ?? 0) > 0
                            ? () => {
                                lastTaxRateByLine.current.delete(l.id);
                                onSetLineTaxOverride!(l.id, {
                                  mode:      isPct ? "PERCENT" : "AMOUNT",
                                  value:     0,
                                  appliesTo: getTaxAppliesTo(l.id),
                                });
                              }
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        data-tp-enter="ignore"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          // Cambiar el modo del selector. Si hay un override
                          // activo, además convertimos el value entre %/$
                          // y mandamos el nuevo override (sin calcular nada
                          // — el backend recalcula). Sin override, solo
                          // cambia la presentación local.
                          const nextIsPct = !isPct;
                          setTaxType(l.id, nextIsPct ? "percent" : "amount");
                          if (override && canEdit) {
                            const v = override.value;
                            let newValue = v;
                            if (!nextIsPct && taxBaseUnit > 0) {
                              // % → $
                              newValue = (taxBaseUnit * v) / 100;
                            } else if (nextIsPct && taxBaseUnit > 0) {
                              // $ → %
                              newValue = (v / taxBaseUnit) * 100;
                            }
                            onSetLineTaxOverride!(l.id, {
                              mode:      nextIsPct ? "PERCENT" : "AMOUNT",
                              value:     Math.max(0, Math.round(newValue * 100) / 100),
                              appliesTo: getTaxAppliesTo(l.id),
                            });
                          }
                        }}
                        title={`Cambiar a ${isPct ? "importe" : "porcentaje"}`}
                        aria-label="Cambiar tipo de impuesto"
                        className="inline-flex h-[34px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted transition hover:bg-surface2/60 hover:text-text"
                      >
                        {isPct ? "%" : "$"}
                      </button>
                      {/* T37 — Ícono ⓘ se movió a la fila "Aplica a" más abajo. */}
                      {/* X externa eliminada — la X ahora vive dentro del
                          TPNumberInput vía la prop onClear. */}
                    </div>
                    {/* Info compacta debajo de Impuestos — máximo 3
                        líneas: Aplica a · badge corto · importe.        */}
                    {(() => {
                      // Preferimos `composition.taxes` (que SÍ trae appliesTo
                      // METAL/HECHURA/...) sobre `taxBreakdown` (sin appliesTo).
                      // Cuando no hay composition, fallback a items (TOTAL implícito).
                      const compTaxes = l.pricingMeta?.composition?.taxes ?? null;
                      const labelForApplyOn = (applyOn: string | null | undefined): string => {
                        if (applyOn === "METAL")   return " (sobre metal)";
                        if (applyOn === "HECHURA") return " (sobre hechura)";
                        return ""; // PRODUCT / SERVICE / TOTAL → sin sufijo.
                      };
                      type DisplayTax = { name: string; rate: number | null; applyOn: string | null; amount: number | null };
                      const displayItems: DisplayTax[] =
                        compTaxes && compTaxes.length > 0
                          ? compTaxes.map((t) => ({
                              name:    t.name,
                              rate:    typeof t.rate === "number" ? t.rate : null,
                              applyOn: t.appliesTo ?? null,
                              // taxAmount viene por unidad — escalamos a la línea.
                              amount:  typeof t.taxAmount === "number" ? t.taxAmount * qty : null,
                            }))
                          : items.map((t) => ({
                              name:    t.name,
                              rate:    typeof t.rate === "number" ? t.rate : null,
                              applyOn: null,
                              amount:  null,
                            }));
                      const hasManyDisplay = displayItems.length > 1;

                      // T25 — `taxBadge` aislado eliminado: ahora el mini
                      // card fiscal (más abajo) consolida header + base + tax.
                      // Tooltip: lista completa con applyOn cuando hay >1.
                      const taxTooltip = hasManyDisplay
                        ? displayItems
                            .map((t) =>
                              `${t.name}${t.rate != null ? ` ${fmtPct(t.rate)}` : ""}${labelForApplyOn(t.applyOn)}`,
                            )
                            .join(" · ")
                        : undefined;
                      void hasMany; // ya no se usa: reemplazado por hasManyDisplay.

                      // T5 — Card desplegable de Impuestos (paridad con
                      // `<SaleLineDiscountSummary>` de Bonificación). Mantenemos
                      // SIEMPRE visibles arriba: TPNumber (input), selector
                      // %/$ y "Aplica en" — son controles primarios. El
                      // DETALLE (badge + sublabel + breakdown multi-impuesto
                      // + importe total) entra dentro de un card colapsable
                      // controlado por `openTaxDetailLineIds`. Cero recálculo:
                      // todos los importes ya estaban siendo passthrough del
                      // motor; solo cambia la presentación.
                      //
                      // El card NO se renderiza cuando no hay detalle útil
                      // que mostrar (sin tasa visible, sin override y sin
                      // monto > 0) — evita un card vacío. "Exento cliente" y
                      // "Sin impuesto" quedan como labels inline (info breve,
                      // no requiere colapsar nada).
                      const detailOpen   = isTaxDetailOpen(l.id);
                      // P1 #5 (Etapa E2) — FIX label fantasma: cuando el
                      // operador limpia el override (taxZeroed=true) el card
                      // de "Detalle" no debe revivir items stale del preview
                      // anterior. Con multi-impuesto (hasManyDisplay=true)
                      // el card se mostraba con el desglose viejo aunque el
                      // input estuviera en 0 y el label inline "Sin impuesto"
                      // ya estuviera activo. El gate global !taxZeroed cubre
                      // los 3 sub-renders (origen, desglose, header summary).
                      const hasTaxCardDetail =
                        !taxZeroed && (
                          (taxLineTotal > 0) ||
                          hasManyDisplay ||
                          (!!override && override.value > 0)
                        );
                      // T31 — `headerSummary` removido: el trigger ahora arma
                      // su `triggerAmount` localmente dentro del IIFE del card.
                      return (
                        <>
                          {/* T40 — Sublabel ENTRE el input y el "Aplica a",
                              alineado con el sublabel de Bonificación (mismo
                              `min-h-[14px]` para que los combos "Aplica a"
                              de Bonif e Impuestos queden a la misma altura).
                              Estados terminales:
                                · Exento cliente → naranja
                                · Sin impuesto (operador anuló) → muted
                              Sin estado terminal → placeholder vacío que
                              reserva el espacio. */}
                          <div
                            className={cn(
                              "mt-0.5 min-h-[14px] text-[9px] italic leading-tight",
                              exempt
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted/60",
                            )}
                            title={exempt ? taxTooltip : undefined}
                          >
                            {exempt
                              ? "Exento cliente"
                              : (taxZeroed && !(override && override.value > 0))
                                ? "Sin impuesto"
                                : <>&nbsp;</>}
                          </div>
                          {/* "Aplica a" — se oculta cuando scope=TOTAL y no
                              hay alternativas. Sin ícono ⓘ (que se movió al
                              header de la celda, arriba-derecha del input). */}
                          {canEdit
                            && (getTaxAppliesTo(l.id) !== "TOTAL" || getAvailableScopes(l, "TAX").length > 1) && (
                            <div className="mt-0.5">
                              <AppliesToLink
                                value={getTaxAppliesTo(l.id)}
                                scopes={getAvailableScopes(l, "TAX")}
                                onChange={(next) => {
                                  setTaxAppliesTo(l.id, next);
                                  // SIEMPRE viaja la base como override
                                  // independiente del valor → el motor
                                  // recalcula el impuesto HEREDADO sobre esa
                                  // base aunque la tasa siga configurada.
                                  onApplyLineOverrides?.(l.id, { manualTaxAppliesTo: next });
                                  // Si hay override de valor, sincronizamos
                                  // su `appliesTo` embebido (precedencia
                                  // backend: el de valor gana).
                                  if (override) {
                                    onSetLineTaxOverride!(l.id, {
                                      mode:      override.mode,
                                      value:     override.value,
                                      appliesTo: next,
                                    });
                                  }
                                }}
                              />
                            </div>
                          )}

                          {/* T35 — Trigger "Ver impuestos" se movió a la
                              celda Total línea c/imp. (más abajo). La celda
                              Impuestos queda limpia: TPNumber + toggle + Aplica a
                              + sub-labels de estado (Exento / Sin impuesto). */}
                        </>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Cell TOTAL LÍNEA — dos modos:
                  · Default (showLineTotalWithTax=false): muestra `lineTotal`
                    sin impuestos (Órdenes/Presupuestos siguen igual).
                  · Factura (showLineTotalWithTax=true): muestra
                    `lineTotalWithTax` arriba (con impuestos, ya redondeado
                    por el motor) y debajo, en pequeño, el subtotal y los
                    impuestos como composición. NO recalcula nada — los tres
                    valores vienen ya del backend (`sales/preview`).
                  UX.12 — wrapper `flex flex-col items-end`: contiene el
                  bloque del Total (label + monto + sub-líneas, contiguos
                  sin gap entre sí) Y la barra de acciones (mini-toolbar
                  contextual) DEBAJO con su propio `mt-2`. Antes las
                  acciones eran columna 8 separada del grid → se cortaban
                  con el scroll horizontal del layout 2-cols.
                  UX.13 — `lg:sticky lg:right-0 lg:z-10` + `lg:bg-card`:
                  cuando el editor desborda y el operador hace scroll
                  horizontal para ver inicio del artículo, el bloque del
                  Total queda PEGADO a la derecha y SIEMPRE visible (con
                  acciones incluidas). El `bg-card` opaco tapa el contenido
                  scrolleable que pasa por detrás; el `shadow-left` tenue
                  insinúa la separación. `pl-2 -mr-3 pr-3` extiende el
                  fondo del sticky a través del padding del wrapper de
                  línea (`px-3`) para que el corte sea limpio en el borde
                  derecho del card, sin un parche visible. En mobile y
                  viewports anchos sin scroll el comportamiento es
                  idéntico al de un bloque normal. */}
              <div
                className={cn(
                  // CLASSIC: el cell se vuelve una FILA — `[totalStack | actionsBlock]`
                  // pegados a la derecha con gap compacto. `items-start` para que las
                  // acciones queden alineadas con el TOP del bloque del total (label
                  // + monto), no centradas verticalmente (que producía un offset
                  // visual hacia abajo cuando había sub-líneas debajo del monto).
                  // La toolbar vive en su propio contenedor (trailing actions),
                  // separada del bloque del monto. Layout ERP clásico:
                  //   | impuestos | total | acciones |.
                  // Resto de presets: columna stack al estilo UX.12 (toolbar al pie).
                  isClassicInline
                    ? "flex items-start justify-end gap-3"
                    : "flex flex-col items-end",
                  // UX.21 — sticky condicional al toggle del usuario
                  // (`invoiceUiPreferences.stickyActions`) Y al preset
                  // (CLASSIC declara false). El caller decide el valor
                  // final como AND lógico.
                  stickyLineActions
                    // `lg:-mr-1` (antes `-mr-3`): el card de la línea usa `px-2.5`
                    // (10px). Un `-mr-3` (12px) sangraba 2px MÁS que el padding y
                    // tapaba el borde derecho del card. `-mr-1` (4px) mantiene un
                    // bleed mínimo del fondo sticky dentro del padding y deja el
                    // borde + sombra visibles. Sticky / shadow / pr / pl sin tocar.
                    && "lg:sticky lg:right-0 lg:z-10 lg:bg-card lg:-mr-1 lg:pr-3 lg:pl-2 lg:shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.12)]",
                )}
              >
                {/* IIFE outer — captura el contenido del total (label +
                    monto + sub-líneas) en `totalContent` una vez, y elige
                    el envoltorio:
                    · CLASSIC → `<div flex-col>` para que la mini-toolbar
                      pueda vivir al lado (trailing actions, layout fila).
                    · Resto → totalContent pasa "transparente" al cell
                      column-flex (comportamiento UX.12 original). */}
                {(() => {
                  const totalContent = showLineTotalWithTax ? (() => {
                  // Todos los valores vienen del backend (vía
                  // `selectInvoiceLineView`); el editor no recalcula nada.
                  const lineExempt  = l.pricingMeta?.taxExemptByEntity === true;
                  // "Sin impuesto" explícito (override manual borrado/0) —
                  // misma semántica que el bloque del input. Gate UNIFICADO:
                  // exento O zeroed ⇒ impuesto 0 y total = neto (no confiar
                  // en `l.lineTotalWithTax`, que puede venir stale con 21%).
                  const lineTaxCleared = isTaxClearedOverride(l.pricingMeta?.taxOverride ?? null);
                  const noTax = lineExempt || lineTaxCleared;
                  // Base imponible = neto post-descuento. En este shape
                  // legacy `l.lineTotal` está asignado con `lineTotalWithTax`
                  // (con impuestos), así que el neto vive en `l.subtotal`.
                  // Sin esta lectura correcta, el label "Base imponible"
                  // mostraba el monto WithTax (ej: 990 en lugar de 900) y
                  // hacía que la celda no cuadrara con el footer/Hero.
                  const subtotalNet = typeof l.subtotal === "number" && Number.isFinite(l.subtotal)
                    ? l.subtotal
                    : (typeof l.lineTotal === "number" && Number.isFinite(l.lineTotal)
                        ? l.lineTotal
                        : totalLine);
                  const lineTax = !noTax && typeof l.taxAmount === "number" && Number.isFinite(l.taxAmount)
                    ? l.taxAmount
                    : 0;
                  // Sin impuesto (exento/zeroed) → total = neto (passthrough,
                  // no recálculo: el impuesto ES 0). Con impuesto → preferir
                  // el `lineTotalWithTax` del backend (preserva redondeo).
                  const totalWithTax = noTax
                    ? subtotalNet
                    : (typeof l.lineTotalWithTax === "number" && Number.isFinite(l.lineTotalWithTax)
                        ? l.lineTotalWithTax
                        : subtotalNet + lineTax);
                  // Opción A — TOTAL LÍNEA C/ IMP. POST-redondeo comercial.
                  // El backend emite `lineTotalWithTaxPostCommercialRounding`
                  // (= lineTotalWithTax + metalImpact + hechuraImpact). El
                  // Resumen Comercial y el número grande del bloque lo usan
                  // para que se cumpla por construcción:
                  //   METAL Comercial post + MONETARIO Comercial post = TOTAL post
                  // Passthrough puro (REGLA DE ORO: backend calcula, FE muestra).
                  // En líneas exentas conservamos el comportamiento previo
                  // (total = neto) — el redondeo comercial sobre exento es edge.
                  const postCRField = (l.pricingMeta as any)?.lineTotalWithTaxPostCommercialRounding;
                  const totalWithTaxPost = noTax
                    ? totalWithTax
                    // FASE 1 — total línea c/imp. desde el contrato único.
                    : (lineSummary && typeof lineSummary.totalLineAmount === "number"
                        ? lineSummary.totalLineAmount
                        : (typeof postCRField === "number" && Number.isFinite(postCRField)
                            ? postCRField
                            : totalWithTax));
                  // T28 — Origen del precio se infiere desde el chip de la
                  // celda Precio (Manual/Promo/Lista/Variante). Acá ya no se
                  // duplica con un sub-label en "Total línea c/imp.".
                  // Refinamiento Fase A — Estado comercial INTEGRADO al
                  // bloque Total línea. El LABEL del bloque MUTA según
                  // el nivel comercial: pasa de "Total línea c/imp."
                  // (neutro) a un texto contextual que ES la advertencia
                  // ("⚠ Venta con pérdida"). Esto redefine el significado
                  // del número que viene abajo — el operador NO tiene que
                  // interpretar el color, lo lee directamente.
                  // Cero matemática: el código del motor determina el texto.
                  // El label deriva del nivel + código primario que ya nos
                  // entrega `deriveCommercialInfo`. UX simplificada: LOW_MARGIN
                  // nunca llega a CRITICAL (el helper lo filtra de blocking),
                  // así que el fallback de CRITICAL ahora cubre los riesgos
                  // que SÍ pueden escalar.
                  const commercialLabelText =
                    commercialInfo?.level === "CRITICAL"
                      ? (commercialInfo.primaryCode === "LOSS_SALE"
                          ? "Venta con pérdida"
                          : commercialInfo.primaryCode === "ZERO_OR_NEGATIVE_PRICE"
                          ? "Precio cero o negativo"
                          : commercialInfo.primaryCode === "PARTIAL_DATA"
                          ? "Cálculo parcial"
                          : commercialInfo.primaryCode === "COST_UNRESOLVED"
                          ? "Costo no resuelto"
                          : "Riesgo comercial")
                      : commercialInfo?.level === "RISK"
                      ? (commercialInfo.primaryCode === "LOSS_SALE"
                          ? "Venta a pérdida"
                          : commercialInfo.primaryCode === "COST_UNRESOLVED"
                          ? "Costo no resuelto"
                          : commercialInfo.primaryCode === "PARTIAL_DATA"
                          ? "Cálculo parcial"
                          : "Riesgo comercial")
                      : commercialInfo?.level === "WARNING"
                      ? "Margen bajo"
                      : null;
                  // R6 Fix A — el chip ya no pinta caja propia. El wrapper
                  // alerta externo (líneas más abajo) tiene su propio bg +
                  // border-l + shadow por nivel; si el chip además renderea
                  // su `rounded border bg-*`, terminamos con DOBLE caja
                  // ámbar/naranja/roja (una del chip a 100% ancho por
                  // `items-stretch`, otra del wrapper) que se ve como
                  // "barra de header invadiendo el monto". Solucionado:
                  // el chip aporta SOLO color de texto + peso; el wrapper
                  // aporta el contenedor visual.
                  const isCommercialAlerted = !!commercialLevel && commercialLevel !== "OK";
                  const commercialLabelClasses = !isCommercialAlerted
                    ? "text-muted"
                    : commercialLevel === "CRITICAL"
                      ? "text-red-700 dark:text-red-300"
                      : commercialLevel === "RISK"
                        ? "text-orange-700 dark:text-orange-300"
                        : "text-amber-800 dark:text-amber-300";
                  // Tooltip multilínea: motivo del nivel + métricas
                  // (margen, recomendado, costo, precio). Cero recálculo;
                  // solo formato. El "headline" se elige según level para
                  // que WARNING no muestre un texto técnico ("Margen 8% <
                  // 15%") sino una frase accionable y CRITICAL no muestre
                  // "Margen crítico" (el motor puede mandarlo en
                  // primaryMessage por valor legacy en DB).
                  const commercialTooltip = (() => {
                    if (!commercialInfo) return undefined;
                    const lines: string[] = [];
                    const headline =
                      commercialInfo.level === "WARNING"
                        ? "La línea se encuentra por debajo del margen recomendado."
                        : commercialInfo.level === "CRITICAL" || commercialInfo.level === "RISK"
                          ? (commercialLabelText ?? commercialInfo.primaryMessage ?? null)
                          : commercialInfo.primaryMessage ?? null;
                    if (headline) {
                      lines.push(headline, "");
                    }
                    if (commercialInfo.marginPercent != null) {
                      lines.push(
                        `Margen: ${formatByType(commercialInfo.marginPercent, "MARGIN_PERCENT", { bare: true })}%`,
                      );
                    }
                    if (commercialInfo.recommendedMarginPercent != null && commercialInfo.recommendedMarginPercent > 0) {
                      lines.push(
                        `Recomendado: ${formatByType(commercialInfo.recommendedMarginPercent, "MARGIN_PERCENT", { bare: true })}%`,
                      );
                    }
                    if (commercialInfo.unitCost != null) {
                      lines.push(`Costo: ${fmtMoney(commercialInfo.unitCost, currency)}`);
                    }
                    if (commercialInfo.unitPrice != null) {
                      lines.push(`Precio final: ${fmtMoney(commercialInfo.unitPrice, currency)}`);
                    }
                    return lines.length > 0 ? lines.join("\n") : undefined;
                  })();
                  return (
                    <>
                      {/* UX WARNING — wrapper sutil ámbar alrededor del
                          bloque "Total línea". Da presencia visual al
                          estado WARNING sin pintar el monto. En CRITICAL/
                          RISK/OK el wrapper queda transparente (sin
                          deco), preservando el comportamiento previo
                          píxel a píxel. */}
                      <div
                        className={cn(
                          // R6 Etapa 1 — WRAPPER ALERTA con CARRIL ESTABLE en
                          // TODOS los estados (incluye OK). Esto elimina el
                          // reflow al transicionar OK ↔ WARNING ↔ RISK ↔
                          // CRITICAL: cambia solo el color del border-l + bg
                          // + shadow; el tamaño/padding/min-w no se mueven.
                          //
                          // `items-stretch` para que los hijos (chip, monto,
                          // metadata, composición) decidan su propia
                          // alineación con `justify-end` / `text-right`.
                          // R6 Fix C — `gap-y-1.5` (6 px) garantiza
                          // separación vertical uniforme entre TODAS las
                          // secciones (chip / monto / metadata / Precio
                          // Unitario / composición / Recalculando). Antes
                          // dependíamos de `mt-1`/`mt-2`/`mt-0.5` mezclados,
                          // que se rompía cuando el monto usaba leading-none.
                          "flex flex-col items-stretch gap-y-1.5",
                          // Carril estable — dimensiones idénticas en todos los niveles.
                          "min-w-[200px] max-w-[280px]",
                          "rounded-md border-l-[3px] px-2 py-1.5",
                          // Color del border-l + caja por nivel.
                          // OK: border transparente (mantiene el carril sin
                          // pintar nada).
                          commercialLevel === "WARNING"
                            && "border-amber-400 bg-amber-500/20 shadow-[0_0_0_1px_rgba(245,158,11,0.30)] dark:border-amber-500 dark:bg-amber-400/[0.20] dark:shadow-[0_0_0_1px_rgba(251,191,36,0.30)]",
                          commercialLevel === "RISK"
                            && "border-orange-500 bg-orange-500/15 shadow-[0_0_0_1px_rgba(249,115,22,0.30)] dark:border-orange-500 dark:bg-orange-500/[0.18] dark:shadow-[0_0_0_1px_rgba(251,146,60,0.30)]",
                          commercialLevel === "CRITICAL"
                            && "border-red-500 bg-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.40)] dark:border-red-500 dark:bg-red-500/[0.22] dark:shadow-[0_0_0_1px_rgba(248,113,113,0.40)]",
                          (!commercialLevel || commercialLevel === "OK")
                            && "border-transparent",
                        )}
                        data-tp-commercial-total-block={commercialLevel ?? undefined}
                        data-tp-commercial-primary-code={commercialInfo?.primaryCode ?? undefined}
                      >
                      {/* Refinamiento Fase A (final) — el LABEL del bloque
                          ES la advertencia. En estado OK conserva el texto
                          neutro "Total línea c/imp." (azul muted). En
                          warning/risk/critical el label MUTA al texto
                          contextual de la alerta ("⚠ Venta con pérdida")
                          con su color, y el ícono ⚠ aparece a la izquierda.
                          Resultado: el operador lee directamente el estado,
                          sin tener que interpretar el color del número. */}
                      {/* AJUSTE VISUAL — En SALDO DESGLOSADO se OCULTA el bloque
                          principal "Total línea c/imp." (label + monto): es
                          redundante porque el Resumen Comercial del Artículo ya
                          muestra METALES + MONETARIO + Total línea c/imp.
                          secundario. En UNIFICADO se mantiene protagonista.
                          Solo visibilidad — cero cambio de cálculo / state /
                          payload (`totalWithTaxPost` sigue calculándose). */}
                      {!isLineDesglosada && (
                      <>
                      <div
                        className={cn(
                          // R6 Etapa 1 — chip con altura reservada (min-h-[20px])
                          // + alineación derecha consistente. La altura fija
                          // evita que el chip "salte" cuando aparece o
                          // desaparece (transición OK → WARNING). 11 px +
                          // font-bold para legibilidad; `whitespace-nowrap`
                          // impide el wrap "Margen / bajo".
                          "min-h-[20px] flex items-center justify-end gap-1",
                          "text-[11px] font-bold uppercase tracking-wide whitespace-nowrap",
                          commercialLabelClasses,
                          isCalculating && "opacity-50",
                        )}
                        title={
                          commercialTooltip
                            ?? "Incluye impuestos. Si hay redondeo por comprobante, se aplica al total del documento (no a cada línea)."
                        }
                        data-tp-commercial-label={commercialLevel ?? undefined}
                      >
                        {commercialLevel && commercialLevel !== "OK" && (
                          <AlertTriangle
                            size={lineTotalEmphasis === "EMPHASIZED" ? 13 : 11}
                            className="shrink-0"
                            aria-hidden
                          />
                        )}
                        <span>{commercialLabelText ?? "Total línea c/ imp."}</span>
                      </div>
                      {/* R4 — Tamaño del monto controlado por preset + count.
                          · STANDARD (default — COMPACT/CUSTOM/SINGLE_COLUMN
                            o EMPHASIZED con >1 línea): `text-lg`.
                          · EMPHASIZED + 1 sola línea (CLASSIC con un único
                            ítem): `text-2xl` + tracking-tight para
                            aprovechar el ancho extra. Con varias líneas
                            cae a text-lg para no competir con el hero del
                            aside (text-3xl/4xl del Total del comprobante). */}
                      <div
                        className={cn(
                          // R6 Etapa 1 — monto con altura reservada para evitar
                          // saltos al transicionar de estado (cuando aparece o
                          // desaparece el chip arriba, o cuando el preset
                          // cambia entre `text-2xl` y `text-lg`).
                          //   · STANDARD: min-h 32 px (cabe text-lg + leading).
                          //   · EMPHASIZED: min-h 40 px (cabe text-2xl).
                          // R6 Fix B — `leading-tight` (~1.25) en lugar de
                          // `leading-none`. Restaura el padding natural del
                          // line-height arriba/abajo del texto: la metadata
                          // y la composición ya no quedan pegadas al monto
                          // cuando se usa `text-2xl` + `items-end`.
                          "flex items-end justify-end font-bold tabular-nums leading-tight transition-opacity",
                          // Jerarquía por tipo de lista (solo tipografía):
                          //  · DESGLOSADA → Total SECUNDARIO (más chico, sin el
                          //    text-2xl/text-lg protagónico). Gramos+monetario
                          //    mandan arriba.
                          //  · UNIFICADA  → Total PROTAGONISTA (tamaño actual).
                          isLineDesglosada
                            ? "text-base min-h-[26px]"
                            : (effectiveLineTotalEmphasis === "EMPHASIZED"
                                ? "text-2xl tracking-tight min-h-[40px]"
                                : "text-lg min-h-[32px]"),
                          // SOLO CRITICAL pinta el monto rojo (WARNING/RISK
                          // mantienen `text-primary` — el chip + wrapper ya
                          // comunican el estado; pintar el monto naranja
                          // confundía visualmente con CRITICAL). En DESGLOSADA
                          // (no-CRITICAL) el Total va atenuado (secundario).
                          commercialLevel === "CRITICAL" ? "text-red-600 dark:text-red-400"
                            : (isLineDesglosada ? "text-muted/80" : "text-primary"),
                          isCalculating && "opacity-40",
                        )}
                        title={commercialTooltip}
                        data-tp-commercial-total={commercialLevel ?? undefined}
                      >
                        {mFmt(totalWithTaxPost)}
                      </div>
                      </>
                      )}
                      {/* Margen resultante — solo cuando hay nivel ≠ OK y
                          el motor expuso `marginPercent`. Si la config del
                          tenant trajo el recomendado, se renderiza en una
                          segunda línea para que el operador compare de un
                          vistazo. Cero matemática — passthrough. */}
                      {commercialInfo
                        && commercialInfo.level !== "OK"
                        && commercialInfo.marginPercent != null && (
                        <div
                          // R6 Etapa 1 — text-right (el wrapper es
                          // items-stretch). El gap vertical lo aporta el
                          // wrapper (gap-y-1.5) — sin mt local redundante.
                          className="text-[10px] text-muted leading-tight text-right"
                          data-tp-commercial-margin-block
                        >
                          <div>
                            Margen:{" "}
                            <span className="font-mono tabular-nums">
                              {formatByType(commercialInfo.marginPercent, "MARGIN_PERCENT", { bare: true })}%
                            </span>
                          </div>
                          {commercialInfo.recommendedMarginPercent != null && commercialInfo.recommendedMarginPercent > 0 && (
                            <div className="text-muted/70">
                              Recomendado:{" "}
                              <span className="font-mono tabular-nums">
                                {formatByType(commercialInfo.recommendedMarginPercent, "MARGIN_PERCENT", { bare: true })}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* R6 Etapa 2 — Precio Unitario, Composición y
                          "Recalculando…" ahora viven DENTRO del wrapper
                          alerta para que el border-l + bg del nivel
                          comercial envuelva todo el bloque como UNA sola
                          unidad visual. Antes la composición quedaba
                          afuera y se veía "desconectada" del estado
                          comercial. El cierre del wrapper se movió debajo
                          del bloque "Recalculando…" (final del subárbol). */}
                      {/* T23 — Sub-label fiscal "Base imponible · IVA X%"
                          movido al card de Impuestos (celda anterior) para
                          mejorar jerarquía visual: "Total línea c/imp." queda
                          como resultado final limpio; el detalle fiscal vive
                          junto al input/label que lo origina. */}
                      {/* T8 + T14 — Unitario final + Cantidad (sólo qty > 1).
                          ─────────────────────────────────────────────────────
                          FUENTE PRIMARIA OBLIGATORIA: `pricingMeta.unitTotalWithTax`
                          (passthrough estricto del motor:
                            pl.unitTotalWithTax → pricingMeta.unitTotalWithTax
                            → l.pricingMeta.unitTotalWithTax).
                          Es el campo CANÓNICO del contrato (POLICY R4.1) y el
                          mismo que consume la celda "Total línea c/imp." del
                          Simulador. NO derivar nunca por defecto.

                          FALLBACK LEGACY (solo snapshots viejos < v5 que no
                          emiten `unitTotalWithTax`): `lineTotalWithTax / qty`.
                          Estos dos valores YA están en el contrato; la
                          división replica la definición del propio campo
                          (POLICY R4.1 lo define como `lineTotalWithTax / qty`).
                          NO es cálculo comercial nuevo — es la fórmula del
                          campo aplicada sobre dos passthrough motor.
                          ───────────────────────────────────────────────────── */}
                      {(() => {
                        // 1) Fuente primaria obligatoria — passthrough del motor.
                        const fromBackend = l.pricingMeta?.unitTotalWithTax;
                        const hasBackendField =
                          typeof fromBackend === "number" && Number.isFinite(fromBackend);
                        // 2) Fallback legacy únicamente cuando el campo
                        //    canónico NO viene del motor. Mantener este path
                        //    estrecho — no debería disparar en flujos vigentes.
                        const fallbackLegacy =
                          !hasBackendField && l.quantity > 0
                            ? totalWithTax / l.quantity
                            : null;
                        const unitTotalWithTax = hasBackendField
                          ? (fromBackend as number)
                          : fallbackLegacy;
                        // T20 — Reglas de visibilidad estrictas:
                        //   1. qty <= 1 → ocultar (el "Total línea c/imp." ES
                        //      el unitario; mostrar otro número duplicaría
                        //      o, peor, induciría error si el motor emite un
                        //      `unitTotalWithTax` mal hidratado).
                        //   2. No hay campo válido → ocultar (no inventar).
                        //   3. SANITY: si `qty > 1` pero el campo backend
                        //      no se reconcilia con el total de línea
                        //      (`|unitTotalWithTax × qty − totalWithTax| > 1`
                        //      → más de AR$ 1 de drift), ocultar el label —
                        //      es mejor no mostrar que mostrar un valor que
                        //      contradice el total. Backend bug: el campo
                        //      debe representar `lineTotalWithTax / qty`
                        //      (POLICY R4.1). El frontend no lo "arregla".
                        if (unitTotalWithTax == null || l.quantity <= 1) return null;
                        const drift = Math.abs(unitTotalWithTax * l.quantity - totalWithTax);
                        if (drift > 1) return null;
                        // R3 (UX densidad) — ocultar también cuando el
                        // unitario final coincide prácticamente con el
                        // valor editable de la celda Precio (no hay
                        // bonificación + impuesto que mueva el unitario).
                        // En ese caso "Precio Unitario: $X" duplica
                        // visualmente el campo Precio sin aportar info.
                        if (
                          typeof l.unitPrice === "number"
                            && Number.isFinite(l.unitPrice)
                            && Math.abs(unitTotalWithTax - l.unitPrice) < 0.01
                        ) {
                          return null;
                        }
                        return (
                          <div
                            data-tp-unit-final={hasBackendField ? "backend" : "legacy-fallback"}
                            className={cn(
                              // R6 Etapa 1 + Fix D — text-right. Gap vertical
                              // viene del wrapper (gap-y-1.5).
                              "text-[10px] leading-tight text-muted tabular-nums text-right transition-opacity",
                              isCalculating && "opacity-50",
                            )}
                          >
                            {/* T28 — Sólo "Precio Unitario" (la cantidad ya
                                vive como input editable en la celda Cantidad;
                                duplicarla acá agregaba ruido visual). */}
                            Precio Unitario: {mFmt(unitTotalWithTax)}
                          </div>
                        );
                      })()}

                      {/* T8 + T12 + T13 + T22 — Mini desglose por componente.
                          Paridad VISUAL con la sección "Composición del precio"
                          del Simulador (`PriceCompositionCards`):
                          · METALES agrupados por METAL PADRE con
                              <padre> — <gramos equivalentes> gr · <ARS venta>
                            — usa `buildMetalParentSaleLines` (T22). Mismo
                            criterio que `MetalSaleCard`: gramos = totalEquivGr,
                            monto = Σ composition.metals[i].lineSale × qty
                            (contrato motor: Σ === metalSale).
                          · HECHURA UNIFICADA = hechura + productos + servicios
                            + impuestos imputados a hechura — usa
                            `buildLineHechuraSaleUnified` (T13). Mismo criterio
                            que el card HECHURA del Simulador.
                          Cero matemática comercial: los helpers solo
                          AGREGAN/DISTRIBUYEN bases ya emitidas por el motor
                          (POLICY R6 / R4.5). El frontend NO calcula precios. */}
                      {(() => {
                        const meta = l.pricingMeta;
                        if (isCalculating) return null;
                        const metals = (meta as any)?.composition?.metals as Array<any> | undefined;
                        // T22 — `buildMetalParentSaleLines` devuelve, por padre:
                        // · gramos equivalentes LADO VENTA (= costEquivGr ×
                        //   metalSaleFactor) escalados a la línea — IDÉNTICO
                        //   al "saleGramsTotal" que muestra `MetalSaleCard`
                        //   del Simulador en la cabecera del card.
                        // · monto venta = Σ lineSale del padre × qty
                        //   (passthrough motor). `null` si snapshot legacy.
                        // `metalSaleFactor` sale del motor (metalSale/metalCost);
                        // si es null/≤0, el helper cae a costEquivGr (sin
                        // margen) — mismo fallback que el Simulador.
                        const metalSaleFactor = computeMetalSaleFactor({
                          metalCost: meta?.metalCost ?? null,
                          metalSale: meta?.metalSale ?? null,
                        });
                        // AUDITORÍA FLASH — anclar el escalado de la composición a
                        // la CANTIDAD DEL ÚLTIMO PREVIEW VÁLIDO (`meta.previewQuantity`,
                        // que setea `selectInvoiceLineView`), NO a la `l.quantity` viva.
                        // Mientras el preview está pendiente, `composition.metals` es
                        // per-unidad del preview ANTERIOR; multiplicarlo por la qty
                        // NUEVA produce un valor intermedio erróneo (metal/gramos/
                        // monetario) hasta que el motor responde. Con la qty anclada el
                        // Resumen Comercial queda CONGELADO al último valor válido y solo
                        // cambia cuando llega el preview (ahí composición y previewQuantity
                        // se actualizan juntas). Si la firma coincide, previewQuantity ===
                        // l.quantity → idéntico. Cero matemática nueva: solo elige qué qty
                        // multiplica el helper de display (passthrough motor).
                        const previewQtyAnchor =
                          (typeof (meta as any)?.previewQuantity === "number"
                            && Number.isFinite((meta as any).previewQuantity)
                            && (meta as any).previewQuantity > 0)
                            ? ((meta as any).previewQuantity as number)
                            : l.quantity;
                        // BLINDAJE COMBO (defensa en profundidad) — un COMBO_COMMERCIAL
                        // es saldo monetario puro: NUNCA deriva metalParents físicos,
                        // aunque el backend (por regresión) emitiera composition.metals.
                        // El guard canónico es el backend (forzar metals:[] en el
                        // agregado del Redondeo Comercial); esto es belt-and-suspenders
                        // del card. Identidad: costMode COMBO / priceSource COMBO_COMPONENTS.
                        const isComboLine =
                          l.pricingMeta?.costMode === "COMBO"
                          || (l.pricingMeta as any)?.priceSource === "COMBO_COMPONENTS";
                        const metalParents = !isComboLine && Array.isArray(metals) && metals.length > 0
                          ? buildMetalParentSaleLines(metals, previewQtyAnchor, metalSaleFactor)
                          : [];
                        // LÍNEA MONETARIA PURA — sin metal físico real (servicio,
                        // combo comercial, producto sin metales, o cualquier línea
                        // con `metalParents.length === 0`). Se trata como saldo
                        // monetario: "Ver detalle comercial" + descomposición
                        // monetaria (Valor comercial → Redondeo → Valor redondeado)
                        // igual que combo/unificada. Los artículos CON metal real
                        // (`metalParents.length > 0`) NO entran → conservan su
                        // detalle de metal. Generaliza lo que antes era solo combo.
                        const isMonetaryOnlyLine = metalParents.length === 0;
                        // T30 — Hechura COHERENTE con el total final.
                        // Regla canónica del Simulador (HechuraSaleCard SSOT):
                        //   `Hechura display = totalWithTax − Σ(Metales)`
                        // Garantiza por construcción que
                        //   `Σ Metales + Hechura = Total línea c/imp.`
                        // — incluyendo descuentos, promos, recargos, impuestos
                        // y redondeos. Hechura ABSORBE todo lo que no es metal
                        // (mismo criterio que el Simulador, que llama a su
                        // header `displaySaleTotal = totalWithTax − Σ metalSale`).
                        // Fallback legacy: cuando los metales no traen
                        // `saleAmountLine` (snapshots v4/v3 sin per-cost-line
                        // lineSale), volvemos a `buildLineHechuraSaleUnified`
                        // (subtotal hechura + productos + servicios +
                        // impuestos imputados) — comportamiento anterior.
                        // POLICY R6 — la resta es display agregación sobre dos
                        // passthrough motor (`totalWithTax` y `lineSale`),
                        // cero matemática comercial nueva.
                        // T45.1 — Fix bug FX (hechura bruta cuando no hay
                        // metales): la gate antes exigía
                        // `metalParents.length > 0 && every(...)`. Si la
                        // línea era SOLO HECHURA (sin metal), length===0
                        // → false → caía al fallback `buildLineHechura...`
                        // que devuelve el subtotal BRUTO (sin descuentos).
                        // Resultado: HECHURA mostrada > Total línea c/imp.
                        //
                        // Regla canónica (SSOT del Simulador):
                        //   `Hechura display = totalWithTax − Σ(metales)`
                        // Cuando no hay metales, Σ = 0 → Hechura = total.
                        // Garantiza por construcción que la suma del card
                        // coincide con el Total línea c/imp.
                        //
                        // El fallback `buildLineHechuraSaleUnified` solo
                        // aplica cuando hay metales PERO ninguno trae
                        // `lineSale` (snapshot legacy v3/v4) — caso edge.
                        const allMetalsHaveSale = metalParents.every((m) => m.saleAmountLine != null);
                        const sumMetalSale = metalParents.reduce(
                          (s, m) => s + (m.saleAmountLine ?? 0),
                          0,
                        );
                        // Receta BASE PRE-redondeo (idéntica a la Composición del costo).
                        // El card usa ESTE para "Valor comercial" del metal; el redondeo
                        // va aparte (cardMetalImpact). Fallback a saleAmountLine (POST)
                        // para snapshots legacy sin `saleAmountLinePre`.
                        const sumMetalSalePre = metalParents.reduce(
                          (s, m) => s + ((m as any).saleAmountLinePre ?? m.saleAmountLine ?? 0),
                          0,
                        );
                        const hechFallback = !allMetalsHaveSale
                          ? buildLineHechuraSaleUnified({
                              metalSaleUnit:   meta?.metalSale,
                              hechuraSaleUnit: meta?.hechuraSale,
                              // Misma ancla anti-flash que los metales (qty del último
                              // preview válido, no la viva) para el fallback de hechura
                              // de snapshots legacy.
                              quantity:        previewQtyAnchor,
                              products:        (meta as any)?.composition?.products,
                              services:        (meta as any)?.composition?.services,
                              taxBreakdown:    meta?.taxBreakdown as any,
                            })
                          : null;
                        // Impacto $ del Redondeo Comercial del metal que compone el
                        // Metal Visible y se descuenta de la Hechura, preservando:
                        //   Metal Visible + Hechura = Total línea c/ imp.
                        // DOMINIO ARTÍCULO — DEBE ser el AUTÓNOMO por línea (inmune a
                        // otras líneas / tipo de documento), MISMA cadena que
                        // `cardMetalImpact`:
                        //   1) lineCommercialSummary.metals.roundingImpact (contrato FASE 1)
                        //   2) lineOwnMetalRoundingMonetaryImpact            (autónomo PER_DOC/MIXED)
                        //   3) metalSaleRoundingDelta                        (PER_LINE motor, legacy)
                        //   4) 0
                        // ❌ NUNCA `metalRoundingMonetaryImpact` (prorrateo DOCUMENTAL:
                        //    depende de Σ gramos del comprobante → contamina la pieza en
                        //    MIXED, ej. 675 en vez de 2.650). El backend ya separa ambos
                        //    dominios en campos distintos; el card lee SOLO el autónomo.
                        const metalRoundingImpact = (() => {
                          const s = lineSummary?.metals?.roundingImpact;
                          if (typeof s === "number" && Number.isFinite(s)) return s;
                          const own = (meta as any)?.lineOwnMetalRoundingMonetaryImpact;
                          if (typeof own === "number" && Number.isFinite(own)) return own;
                          const delta = (meta as any)?.metalSaleRoundingDelta;
                          if (typeof delta === "number" && Number.isFinite(delta)) return delta;
                          return 0;
                        })();
                        // HECHURA puede quedar NEGATIVA cuando una bonificación
                        // manual sobre "Solo metal" excede la base del metal: el
                        // motor emite componentes negativos válidos (ver
                        // CLAUDE.md raíz, "Pricing-engine: componentes negativos
                        // son válidos"). No clampear: passthrough puro.
                        // Descomposición COMERCIAL — MONETARIO = SALDO COMERCIAL
                        // POST-redondeo (= total comercial − Σ metalSale, redondeado).
                        // El backend lo emite por línea como
                        // `lineMonetarySaldoPostCommercialRounding` (ej. 185.500),
                        // con el fix del motor (saldo sobre metalSale, NO sobre
                        // valoración física). Passthrough puro — el FE NO lo compone.
                        //   · Modo DESGLOSADO (snapshot trae el saldo) → se muestra
                        //     ESE valor post directamente.
                        //   · Sin saldo (UNIFICADO / lista sin redondeo / legacy) →
                        //     fallback al residuo comercial (totalPost − metal comercial),
                        //     que da el MISMO número cuando el fix está activo.
                        const monetarySaldoPostField =
                          (meta as any)?.lineMonetarySaldoPostCommercialRounding;
                        const hasCommercialSaldo =
                          typeof monetarySaldoPostField === "number"
                          && Number.isFinite(monetarySaldoPostField);
                        // MONETARIO — fuente según el modo de la línea:
                        //   · DESGLOSADA → contrato único `lineSummary.monetary.amount`
                        //     (saldo comercial post-redondeo, ej. 185.500). Passthrough.
                        //   · UNIFICADA  → el contrato emite `monetary.amount = TOTAL`
                        //     (sin desglose metal/no-metal), por eso mostramos el
                        //     residuo no-metal (totalPost − Σ metalSale).
                        //
                        //   DECISIÓN COMERCIAL (2026-06-04): la Lista Unificada PUEDE
                        //   conservar datos internos de metal/hechura en el payload
                        //   (no se bloquean — futuros pagos/saldos/cuenta corriente con
                        //   metal), pero su MONETARIO visible NO se recalcula ni se
                        //   reduce por el redondeo metálico DOCUMENTAL. En UNIFICADA NO
                        //   se resta `metalRoundingImpact` (puede venir prorrateado por
                        //   el redondeo de metal de OTRA línea en un comprobante mixto →
                        //   la pieza cambiaría de valor solo por agregar otra línea). El
                        //   gate vive en `resolveLineMonetaryDisplay` (SSOT del display);
                        //   ver el bloque "DECISIÓN COMERCIAL" en saleCompositionDisplay.ts.
                        //   · Sin `lineSummary` (snapshots legacy) → cadena legacy intacta.
                        const hechuraDisplayTotal = resolveLineMonetaryDisplay({
                          isLineDesglosada,
                          hasLineSummary:            !!lineSummary,
                          lineSummaryMonetaryAmount: lineSummary?.monetary?.amount ?? null,
                          totalWithTaxPost,
                          sumMetalSale,
                          metalRoundingImpact,
                          allMetalsHaveSale,
                          hechFallbackTotal:         hechFallback?.total ?? null,
                          hasCommercialSaldo,
                          monetarySaldoPostField:    hasCommercialSaldo ? monetarySaldoPostField : null,
                        });
                        // ── Opción B — Resumen Comercial AUTÓNOMO de la línea ──────
                        // El card debe explicar la PIEZA, no el documento: METAL,
                        // MONETARIO y TOTAL salen del MISMO cálculo autónomo de
                        // línea (`lineOwn*`, inmune a otras líneas — backend
                        // computeLineAutonomousCommercialMoney). Solo DESGLOSADA usa
                        // estos campos; UNIFICADA ya es autónoma (appliedRounding) y
                        // conserva su camino. Fallback: `metalSaleRoundingDelta`
                        // (PER_LINE) / valores actuales para snapshots legacy.
                        // Invariante garantizado por el backend:
                        //   (sumMetalSale + cardMetalImpact) + cardMonetario === cardTotal
                        // El footer/Sale.total NO se tocan (siguen con el prorrateo).
                        const ownMetalImpact   = (meta as any)?.lineOwnMetalRoundingMonetaryImpact;
                        // NOTA (2026-06) — `lineOwnMonetarySaldoPostCommercialRounding`
                        // YA NO se usa como MONETARIO del card: en listas DESGLOSADAS
                        // SIN redondeo trae el TOTAL DE LÍNEA (no el saldo) → rompía
                        // METALES + MONETARIO = TOTAL. El MONETARIO se deriva por
                        // residual `cardTotal − metalFinalCard` (ver más abajo).
                        const ownTotal         = (meta as any)?.lineOwnTotalWithTaxPostCommercialRounding;
                        // DESGLOSADA — el Resumen Comercial del Artículo usa SIEMPRE el
                        // redondeo AUTÓNOMO de la línea (backend
                        // `computeLineAutonomousCommercialMoney`), NUNCA el prorrateo
                        // documental (`distributeMetalRoundingImpactPerLine` →
                        // `metalRoundingMonetaryImpact`). En MIXED ese prorrateo depende de
                        // Σ gramos del documento y cambia al modificar otras líneas → viola
                        // "mismo artículo = mismo Resumen Comercial". Cadena (todo per-línea,
                        // inmune a otras líneas):
                        //   1) `lineOwnMetalRoundingMonetaryImpact` — autónomo PER_DOCUMENT/MIXED.
                        //   2) `metalSaleRoundingDelta`             — autónomo PER_LINE (motor).
                        //   3) 0 — sin autónomo: fila OCULTA y "Valor final" = "Valor comercial"
                        //      (base PRE estable). Preferible a un prorrateo ajeno.
                        // `metalRoundingMonetaryImpact` NO entra a esta cadena en ningún caso.
                        const ownDelta = (meta as any)?.metalSaleRoundingDelta;
                        // FUENTE CANÓNICA del "Redondeo comercial metal" del card
                        // per-línea, SIEMPRE per-línea (inmune a otras líneas), en
                        // prioridad:
                        //   1) lineSummary.metals.roundingImpact  (contrato único FASE 1)
                        //   2) lineOwnMetalRoundingMonetaryImpact  (autónomo PER_DOC/MIXED)
                        //   3) metalSaleRoundingDelta              (PER_LINE motor, legacy)
                        //   4) 0
                        // ❌ NUNCA `metalRoundingMonetaryImpact` (prorrateo DOCUMENTAL:
                        //    depende de Σ gramos del documento → cambia al modificar
                        //    otra línea) ni `commercialRoundingContext.breakdown.*`
                        //    (agregado documental). En UNIFICADA el card no muestra
                        //    redondeo de metal (fila oculta) ⇒ 0, jamás el documental.
                        const summaryMetalImpact = lineSummary?.metals?.roundingImpact;
                        const cardMetalImpact  = isLineDesglosada
                          ? (typeof summaryMetalImpact === "number" && Number.isFinite(summaryMetalImpact)
                              ? summaryMetalImpact
                              : (typeof ownMetalImpact === "number" && Number.isFinite(ownMetalImpact)
                                  ? ownMetalImpact
                                  : (typeof ownDelta === "number" && Number.isFinite(ownDelta)
                                      ? ownDelta
                                      : 0)))
                          : 0;
                        // Documento con listas mixtas (passthrough del backend; no se
                        // recalcula). Solo dispara el aviso "valor propio de la línea".
                        const isMixedDoc = (meta as any)?.priceListMixed === true;
                        // S4.2 (Hito S4) — FIX MIXED RETIRADO. Tras S4.1a+b el backend
                        // entrega el target α limpio TAMBIÉN en MIXED (`Sale.total` y
                        // `ownTotal` coinciden con el total real; preview===confirm
                        // validado). El Card lee el contrato normal C-FASE1 (`ownTotal`)
                        // por igual en MIXED y homogéneo — sin parche. Solo display.
                        const cardTotal        = isLineDesglosada
                          ? (typeof ownTotal === "number" && Number.isFinite(ownTotal)
                              ? ownTotal
                              : totalWithTaxPost)
                          : totalWithTaxPost;
                        // FIX 2026-06 — MONETARIO del card en DESGLOSADO = RESIDUAL por
                        // línea `cardTotal − valor final metal` (espejo del footer
                        // `total − Σ valor final metal`). Garantiza por construcción:
                        //   METALES + MONETARIO = TOTAL LÍNEA.
                        // `metalFinalCard` es el MISMO "Valor final metales" que el card
                        // ya muestra (`sumMetalSalePre + cardMetalImpact`, ver línea de
                        // render del valor final del metal). Antes el MONETARIO usaba
                        // `lineOwnMonetarySaldoPostCommercialRounding`, que en listas
                        // desglosadas SIN redondeo trae el TOTAL DE LÍNEA → contaba el
                        // metal dos veces. UNIFICADO sin cambios (`hechuraDisplayTotal`).
                        // El redondeo comercial monetario sigue mostrándose como impacto
                        // dentro de la descomposición (`resolveLineMonetaryRoundingDecomposition`
                        // recibe este `cardMonetario` como `monetarioFinal`). Solo display.
                        // Valor final del metal RESIDUAL (estructural): cierra el
                        // invariante con el TOTAL por construcción. Sigue siendo la
                        // base del MONETARIO cuando NO hay saldo autoritativo o cuando
                        // éste diverge materialmente del residual (MIXED degenerado).
                        const metalFinalCardResidual = sumMetalSalePre + cardMetalImpact;
                        const monetarioResidual = Math.round((cardTotal - metalFinalCardResidual) * 100) / 100;
                        // FIX 2026-06-16 — SALDO MONETARIO POST AUTORITATIVO (mismo
                        // patrón que el footer `TotalDelComprobanteCard.tsx:413-449`).
                        // El backend YA emite el saldo limpio en
                        // `lineSummary.monetary.amount` (= `lineCommercialSummary` /
                        // `lineCommercialDisplaySummary`). El residual `cardTotal −
                        // Σ valor final metal` arrastra el drift `Σ round` / coma
                        // flotante (ej. 718659.38 − 517759.375 = 200900.005 →
                        // round → 200900,01 en vez de 200900,00). Adoptamos el saldo
                        // autoritativo SOLO cuando reconcilia con el residual (drift
                        // ≤ 0,05, muy por encima del ~0,01 real y muy por debajo de
                        // cualquier divergencia material). En MIXED degenerado donde
                        // el `lineSummary` no coincide → cae al residual (comportamiento
                        // actual intacto). Cero recálculo: passthrough del backend.
                        const authoritativeLineSaldo: number | null =
                          isLineDesglosada &&
                          lineSummary != null &&
                          typeof lineSummary.monetary?.amount === "number" &&
                          Number.isFinite(lineSummary.monetary.amount)
                            ? Math.round(lineSummary.monetary.amount * 100) / 100
                            : null;
                        const cardMonetario    = isLineDesglosada
                          ? (authoritativeLineSaldo != null &&
                             Math.abs(authoritativeLineSaldo - monetarioResidual) <= 0.05
                              ? authoritativeLineSaldo
                              : monetarioResidual)
                          : hechuraDisplayTotal;
                        // Valor final del metal del card RECONCILIADO: en DESGLOSADO se
                        // DERIVA del saldo elegido para que METALES + MONETARIO = TOTAL
                        // sea EXACTO (el metal absorbe el centavo del drift), análogo a
                        // cómo el footer deriva `metalDeductionForSaldoBase`. Cuando se
                        // usa el residual, equivale a `metalFinalCardResidual`. Este es
                        // el valor que debe renderizar el "Valor final metales".
                        const metalFinalCard   = isLineDesglosada
                          ? Math.round((cardTotal - cardMonetario) * 100) / 100
                          : metalFinalCardResidual;
                        const hasMetals  = metalParents.length > 0;
                        // Visibilidad INVARIANTE a la moneda: se decide sobre el
                        // equivalente en base (ver `visibilityBaseFactor`). En
                        // moneda base es idéntico a `> 0.005`; en moneda no-base
                        // evita que un saldo de pocos pesos desaparezca por caer
                        // bajo medio centavo de la moneda del documento.
                        const hasHechura = isAmountSignificantInBase(cardMonetario, visibilityBaseFactor);
                        // COMBO: el combo SIEMPRE tiene detalle comercial disponible
                        // (su saldo monetario + composición de componentes), así que el
                        // card del Resumen nunca se oculta — garantiza que el control
                        // "Ver detalle comercial" exista por igual en saldo DESGLOSADO y
                        // UNIFICADO. Para no-combos el comportamiento queda idéntico.
                        if (!hasMetals && !hasHechura && !isComboLine) return null;
                        return (
                          // T45.3 — Card "Composición del total" con jerarquía
                          // visual premium. Layout:
                          //   · Header "COMPOSICIÓN DEL TOTAL" (uppercase muted).
                          //   · Sección METAL: label + filas grid [nombre|importe]
                          //     con variantes indentadas (sin importe).
                          //   · Divisor sutil.
                          //   · Sección HECHURA: misma fila grid [nombre|importe].
                          // Toda la alineación de importes pasa por
                          // `grid-cols-[1fr_auto]` → columnas consistentes
                          // independientemente del nombre. Cero matemática nueva
                          // (todos los valores son passthrough motor).
                          <div
                            data-tp-line-saldo-desglosado="true"
                            // UX.8 — "Composición del total" más integrada
                            // a la línea: SIN border (la línea contenedora
                            // ya tiene su propio border + shadow → un border
                            // anidado da sensación "ventana dentro de
                            // ventana"). Solo `bg-surface2/25` (capa muy
                            // sutil) + padding propio + un ring-1 muy tenue
                            // para delimitar. Cero contenido modificado.
                            // UX.14 — paddings y spacing reducidos para
                            // bajar protagonismo visual (px 3.5→3, py 3→2,
                            // mt-2.5→2, mt-1.5→1). Toda la información se
                            // mantiene (gramos, monto, variantes, hechura,
                            // monto monetario) — solo se comprime el aire
                            // entre filas. Cero cambio en typography.
                            // R6 Fix D — gap vertical viene del wrapper
                            // (gap-y-1.5). El `mt-1` adicional suma respiro
                            // extra entre Precio Unitario y la card de
                            // Composición (que es un sub-bloque "más
                            // pesado" — ring + padding propio).
                            className="mt-1 rounded-lg bg-surface2/25 ring-1 ring-border/10 px-3 py-2"
                          >
                            {/* ── Header del card ─────────────────────────── */}
                            {/* Etapa D' (cierre conceptual) — rename del título
                                a "Resumen comercial del artículo" para reflejar
                                que el bloque muestra el RESULTADO COMERCIAL
                                FINAL (post-redondeo cuando hay snapshot). */}
                            <div className="text-[9px] font-semibold uppercase tracking-wider leading-tight text-muted/70">
                              Resumen comercial del artículo
                            </div>
                            {/* Total línea c/imp. — fila informativa SECUNDARIA debajo del
                                título, SIEMPRE en desglosado (colapsado Y expandido). En
                                modo desglosado el total vive ÚNICAMENTE acá: el bloque
                                principal superior se oculta y el detalle MONETARIO ya no lo
                                repite. Chico, muted (NO naranja): label y valor con el MISMO
                                color. Passthrough de `totalWithTaxPost`. */}
                            {isLineDesglosada && (
                              <div className="mt-0.5 grid grid-cols-[1fr_auto] items-baseline gap-2" data-tp-line-total-collapsed>
                                <span className="text-[10px] leading-tight text-muted/65">Total línea c/ imp.</span>
                                <span className="tabular-nums text-[10px] leading-tight text-muted/65">{mFmt(cardTotal)}</span>
                              </div>
                            )}
                            <div className="mt-1 border-t border-border/25" />

                            {/* ── Etapa D' — lectura del snapshot canónico ──── */}
                            {/* R-COMMERCIAL-ROUNDING-VISIBILITY: cuando el
                                snapshot existe, el resumen comercial del
                                artículo muestra el RESULTADO COMERCIAL FINAL
                                (postGrams + postRoundingSaldoMonetario). La
                                visualización NO depende de `appliedToLineCount`
                                — el conteo es metadata informativa (badge
                                "Aplicado a nivel comprobante") y nunca degrada
                                valores comerciales. REGLA DE ORO: cero
                                recálculo FE — solo selección de la fuente
                                correcta. */}
                            {(() => {
                              // LAYOUT per-línea (Opción 1, 2026-06-03): el render
                              // del Resumen Comercial NO depende de
                              // `commercialRoundingContext` documental. Se eliminó el
                              // `crHasBreakdown` muerto que lo leía. La visibilidad la
                              // decide `isLineDesglosadaView(meta)` (modo de la lista de
                              // ESTA línea) y los valores salen de las fuentes PER-LÍNEA
                              // → una línea desglosada se ve IGUAL en comprobante 100%
                              // desglosado o mixto.
                              // Gramos del metal (display) — fuente PER-LÍNEA:
                              // `lineCommercialRoundingMetals` (gramos POST de ESTA
                              // línea; postGrams = round(gramos × pureza × merma ×
                              // MARGEN de la línea)). Es per-línea, así que agregar
                              // otra línea del mismo metal NO altera ésta (fix del
                              // bug "Resumen Comercial mezcla líneas").
                              //
                              // ⚠️ NO usar `crCtx.breakdown.metalsPostGrams` ni
                              // `crCtx.breakdown.metals`: son AGREGADOS del documento
                              // (Σ de todas las líneas) → acumulaban. El
                              // `commercialRoundingContext` queda solo para el footer
                              // y el badge "aplicado a nivel comprobante".
                              //
                              // Fallback a los agregados SOLO para snapshots viejos
                              // (Ver Factura de ventas confirmadas pre-fix) que no
                              // traen el campo per-línea.
                              // Fuente PER-LÍNEA del Redondeo Comercial, en
                              // prioridad: `lineCommercialRoundingMetals`
                              // (PER_DOCUMENT per-línea) →
                              // `appliedRounding.physical.metals` (PHYSICAL
                              // per-línea) → doc-level legacy. MISMA fuente que
                              // el footer. Devuelve [] si no hay (→ crudo).
                              // FASE 1 — si hay contrato único, los gramos/impacto por
                              // padre salen EXCLUSIVAMENTE de `lineSummary.metals.byParent`
                              // (postGrams = visibleGrams; monetaryImpact = roundingImpact).
                              // Sin contrato → fuente legacy. `deltaGrams`/`preGrams` no
                              // viajan en el summary (display secundario) → se omiten.
                              const crMetals = lineSummary
                                ? (lineSummary.metals
                                    ? lineSummary.metals.byParent.map((p) => ({
                                        metalParentId:   p.metalParentId,
                                        metalParentName: p.metalParentName,
                                        postGrams:       p.visibleGrams,
                                        monetaryImpact:  p.roundingImpact,
                                      }))
                                    : [])
                                : pickLineCommercialRoundingMetals(meta, { allowDocLevelFallback: false });
                              // Opción A (R-COMMERCIAL-METAL-VISIBLE) — el Resumen
                              // Comercial del Artículo cumple POR CONSTRUCCIÓN:
                              //   Metal Comercial + Monetario = Total línea c/ imp.
                              // con
                              //   Metal Comercial = Σ saleAmountLine
                              //       + metalRoundingMonetaryImpact
                              //   Monetario       = Total línea c/ imp. − Metal Comercial
                              // Del snapshot del Redondeo Comercial SOLO se leen datos
                              // FÍSICOS secundarios (postGrams / deltaGrams).
                              //   ❌ NO se lee `crMetal.postAmount`.
                              //   ❌ NO se lee `crHechura.postRoundingSaldoMonetario`.
                              //   (ambos rompían el invariante y mezclaban el redondeo
                              //    físico/financiero con el comercial).
                              //   · NO recalcular nada — todos los importes son
                              //     passthrough motor (saleAmountLine,
                              //     lineTotalWithTaxPostCommercialRounding,
                              //     metalRoundingMonetaryImpact,
                              //     hechuraRoundingMonetaryImpact).
                              //
                              // Vista RESUMIDA (default colapsada): gramos de metal
                              // AGREGADOS (Σ por padre). El detalle por metal padre
                              // (Oro/Plata/…) queda detrás de "Ver detalle". Cero
                              // recálculo: el mismo postGrams/gramsEquivLine por fila.
                              const compositionDetailOpen = isCompositionDetailOpen(l.id);
                              const aggregateMetalGrams = metalParents.reduce((sum, m) => {
                                // Camino normal: match por ID del metal padre
                                // (identidad canónica, Divisas → Metales Padre).
                                // Fallback (último recurso): por nombre, solo
                                // para snapshots viejos sin `metalParentId`.
                                const mPid = (m as any).metalParentId;
                                const cm = crMetals
                                  ? ((mPid
                                        ? crMetals.find((x: any) => x.metalParentId === mPid)
                                        : null)
                                      ?? crMetals.find((x: any) => x.metalParentName === m.name))
                                  : null;
                                const g = (cm && typeof cm.postGrams === "number")
                                  ? cm.postGrams
                                  : (m as any).gramsEquivLine;
                                return sum + (typeof g === "number" && Number.isFinite(g) ? g : 0);
                              }, 0);
                              return (
                                <>
                                  {/* ── Sección METAL ─────────────────────────── */}
                                  {/* Resumen comercial BÁSICO (METALES + MONETARIO) visible
                                      SIEMPRE (también colapsado): metal, gramos y Valor
                                      comercial del metal. "Ver detalle / Ver menos" solo
                                      revela/oculta los DETALLES (redondeo comercial metal,
                                      valor final metales, sub-filas monetarias). Solo
                                      visibilidad — cero cálculo. */}
                                  {/* COMBO: aunque `metalParents` esté vacío (el combo es
                                      saldo monetario puro, sin metal a nivel de línea) la
                                      sección se renderiza para mostrar el empty-state
                                      explicativo — así el combo se ve IGUAL en saldo
                                      DESGLOSADO y UNIFICADO (antes el empty-state quedaba
                                      como código muerto, anidado bajo `metalParents > 0`). */}
                                  {/* En UNIFICADO el resumen comercial (metales + monetario)
                                      vive DETRÁS de "Ver detalle" (el total unificado ya es el
                                      protagonista arriba). En DESGLOSADO se muestra siempre. */}
                                  {(metalParents.length > 0 || isComboLine) && (isLineDesglosada || compositionDetailOpen) && (
                                    <div className="mt-1.5 space-y-1">
                                      <div className="text-[9px] font-semibold uppercase tracking-wide leading-tight text-muted/70">
                                        METALES
                                      </div>
                                      <div className="space-y-1.5">
                                        {/* SIEMPRE (colapsado y expandido) por metal padre:
                                            NOMBRE + gramos finales + "Valor comercial"
                                            (saleAmountLine). Es el resumen BÁSICO que el
                                            operador necesita ver sin expandir. Las filas de
                                            redondeo ("Redondeo comercial metal" / "Valor final
                                            metales") siguen detrás de "Ver detalle". */}
                                        {/* Combo (Modelo A): no posee metal a nivel
                                            de línea — su metal vive dentro de los
                                            componentes. Empty-state claro para que el
                                            panel comercial/metal no parezca roto. Solo
                                            display; los componentes se ven en el expand
                                            de línea ("Composición del combo"). */}
                                        {isComboLine && metalParents.length === 0 && (
                                          <div className="rounded-md border border-border/40 bg-surface2/30 px-2.5 py-1.5 text-[10px] leading-snug text-muted/80">
                                            Este combo no posee metales a nivel de línea.
                                            La composición de sus componentes está disponible
                                            en el detalle de línea.
                                          </div>
                                        )}
                                        {metalParents.map((m) => {
                                          // Lectura del snapshot D' por metal padre
                                          // (match por ID; fallback por nombre para
                                          // snapshots viejos). Cero matemática FE.
                                          const mPidD = (m as any).metalParentId;
                                          const crMetal = crMetals
                                            ? ((mPidD
                                                  ? crMetals.find((cm: any) => cm.metalParentId === mPidD)
                                                  : null)
                                                ?? crMetals.find((cm: any) => cm.metalParentName === m.name))
                                            : null;
                                          const hasPostGrams =
                                            !!crMetal && typeof crMetal.postGrams === "number";
                                          // Gramos FINAL (información secundaria — el
                                          // protagonista del Resumen Comercial es el
                                          // invariante monetario). postGrams cuando hay
                                          // snapshot del redondeo físico; fallback al
                                          // gramos equivalente per-línea del motor.
                                          const displayGrams = hasPostGrams
                                            ? crMetal!.postGrams
                                            : m.gramsEquivLine;
                                          // Opción A — Importe del metal = `saleAmountLine`
                                          // puro (passthrough motor). El impacto monetario
                                          // del Redondeo Comercial NO se pliega acá (es
                                          // per-LÍNEA, no per-padre) sino que se muestra
                                          // UNA sola vez como sub-línea consolidada más
                                          // abajo. Así el Resumen cumple por construcción:
                                          //   Σ metal (saleAmountLine)
                                          //     + metalRoundingMonetaryImpact
                                          //     + Monetario = Total línea c/ imp.
                                          // ❌ NO se lee `crMetal.postAmount` (rompía el
                                          // invariante y mezclaba el redondeo físico con
                                          // el comercial).
                                          // Regla canónica — valor comercial del metal padre =
                                          // `m.saleAmountLine` (base ÚNICA que CIERRA contra el
                                          // total). NO usar `byParent.monetaryAmount` (postGrams ×
                                          // refValue): difiere por el residuo. El redondeo del
                                          // metal NO va por padre (es per-línea) → se muestra como
                                          // fila única a nivel METALES (abajo).
                                          // "Valor comercial" del metal = base PRE-redondeo
                                          // (`saleAmountLinePre`, = Composición del costo). Cae a
                                          // `saleAmountLine` (POST) en snapshots legacy sin el campo.
                                          const displayAmount =
                                            (m as any).saleAmountLinePre != null
                                              ? (m as any).saleAmountLinePre
                                              : (m.saleAmountLine != null ? m.saleAmountLine : null);
                                          return (
                                            <div key={`mp-${m.name}`} className="space-y-0.5">
                                              {/* ── RESULTADO PRINCIPAL — nombre IZQ ·
                                                  gramos finales (grande) DER. ── */}
                                              <div className="grid grid-cols-[1fr_auto] items-baseline gap-2">
                                                <span className="truncate text-[10px] font-semibold uppercase tracking-wide leading-tight text-muted/80">
                                                  {m.name}
                                                </span>
                                                <span className={cn(
                                                  "tabular-nums leading-tight",
                                                  // DESGLOSADO: gramos protagonistas (foco azul).
                                                  // UNIFICADO: neutro (el protagonista es el total).
                                                  isLineDesglosada ? "text-base font-bold text-primary" : "text-[12px] font-semibold text-text",
                                                )}>
                                                  {formatByType(displayGrams, "METAL_GRAMS")}
                                                </span>
                                              </div>
                                              {/* ── ORIGEN — variante(s): label · gramos (sin monto). ── */}
                                              {m.variants.length > 0 && (
                                                <div className="mt-1 space-y-px">
                                                  {m.variants.map((v) => (
                                                    <div
                                                      key={`mp-${m.name}-v-${v.label}`}
                                                      className="text-[10px] leading-tight text-muted/65"
                                                    >
                                                      <span className="tabular-nums truncate">
                                                        {v.label}
                                                        <span className="text-muted/45"> · </span>
                                                        {formatByType(v.gramsLine, "METAL_GRAMS")}
                                                      </span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              {/* ── Valor comercial del metal padre = saleAmountLine
                                                  (base canónica que cierra contra el total). ──
                                                  Detrás de `compositionDetailOpen`: colapsado se ve
                                                  solo nombre + gramos; el "Valor comercial" aparece
                                                  al desplegar "Ver detalle" (junto a los redondeos). */}
                                              {displayAmount != null && compositionDetailOpen && (
                                                <div className="mt-1 grid grid-cols-[1fr_auto] items-baseline gap-2">
                                                  <span className="text-[10px] leading-tight text-muted/65">Valor comercial</span>
                                                  <span className="tabular-nums text-[11px] font-semibold leading-tight text-muted/80">
                                                    {mFmt(displayAmount)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {/* Opción A — Impacto monetario del Redondeo
                                          Comercial consolidado UNA sola vez (es un valor
                                          per-LÍNEA, no per-metal-padre). Sumado a
                                          Σ `saleAmountLine` compone el Metal Comercial:
                                            Metal Comercial = saleAmountLine
                                              + metalRoundingMonetaryImpact
                                          Passthrough puro del backend SSOT
                                          (`distributeMetalRoundingImpactPerLine`); el FE
                                          NO prorratea ni recalcula. Es el ajuste que
                                          lleva el VALOR COMERCIAL del metal de
                                          `saleAmountLine` a su valor post-redondeo
                                          (ej. 340.312,50 − 7.031,25 = 333.281,25). */}
                                      {/* Redondeo comercial del metal: MOVido a la
                                          sección "Redondeos" al final del detalle
                                          (después de METALES/MONETARIO/TOTAL), para que
                                          la composición principal se lea primero. */}
                                      {/* Total metales — agregado, SOLO en el detalle y
                                          SOLO con múltiples metales padre (con uno solo
                                          el valor ya está arriba). Σ gramos (passthrough). */}
                                      {compositionDetailOpen && metalParents.length > 1 && (
                                        <div className="mt-1.5 pt-1 border-t border-border/20 grid grid-cols-[1fr_auto] items-baseline gap-2">
                                          <span className="text-[10px] font-medium leading-tight text-muted">Total metales</span>
                                          <span className="tabular-nums text-[12px] font-semibold leading-tight text-foreground/80">
                                            {formatByType(aggregateMetalGrams, "METAL_GRAMS")}
                                          </span>
                                        </div>
                                      )}
                                      {/* ── Redondeo comercial metal + Valor final metales —
                                          SOLO en Lista DESGLOSADA (y solo expandida). En Lista
                                          UNIFICADA (`MARGIN_TOTAL`) el metal NO tiene pipeline de
                                          redondeo propio: su valor es una distribución visual del
                                          precio único, y el redondeo del precio final se ve en
                                          MONETARIO. Por eso acá se ocultan ambas filas en UNIFICADA
                                          (evita "Valor final metales" = "Valor comercial" redundante
                                          y un "Redondeo comercial metal" que siempre sería 0).
                                          Solo gating visual — `metalRoundingImpact` / `sumMetalSale`
                                          no se tocan. Desglosada NO cambia (sigue colapsada→oculta,
                                          expandida→visible).
                                          LÍNEA MONETARIA PURA (servicio/combo/producto sin metal):
                                          sin metal a nivel de línea → estas filas darían "Valor final
                                          metales: $0" y un redondeo de metal siempre 0 (ruido). Se
                                          ocultan; su detalle comercial es 100% el bloque MONETARIO. ── */}
                                      {(isLineDesglosada && compositionDetailOpen && !isMonetaryOnlyLine) && (
                                        <>
                                          {/* Redondeo comercial metal — fila única a nivel LÍNEA
                                              (no por padre): `metalRoundingMonetaryImpact` es por
                                              línea (prorrateado por gramsPure). Passthrough. */}
                                          {isAmountSignificantInBase(cardMetalImpact, visibilityBaseFactor) && (
                                            <div className="mt-1.5" data-tp-metal-rounding-line>
                                              {/* Fila label · importe. `min-w-0` permite que el label
                                                  envuelva sin pisar el importe (fix overflow); el
                                                  importe nunca se trunca (`whitespace-nowrap`). */}
                                              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                                                <span className="min-w-0 break-words text-[10px] italic leading-tight text-muted/65">
                                                  Redondeo comercial metal
                                                  {/* Chip de ORIGEN — dominio ARTÍCULO. El valor es propio
                                                      de la línea (autónomo), nunca el prorrateo documental. */}
                                                  <span
                                                    className="ml-1 inline-block not-italic align-middle rounded bg-surface2/60 px-1 py-px text-[8px] font-medium uppercase tracking-wide text-muted/70"
                                                    data-tp-metal-rounding-origin
                                                  >
                                                    línea
                                                  </span>
                                                </span>
                                                <span className="not-italic whitespace-nowrap tabular-nums text-[11px] font-semibold leading-tight text-muted/80" data-tp-metal-rounding-line-impact>
                                                  {cardMetalImpact > 0 ? "+" : ""}{mFmt(cardMetalImpact)}
                                                </span>
                                              </div>
                                              {/* MIXED — aclara que el valor es propio de la pieza,
                                                  no un prorrateo del comprobante. */}
                                              {isMixedDoc && (
                                                <div className="mt-0.5 text-[9px] leading-snug text-muted/55" data-tp-metal-rounding-mixed-note>
                                                  Comercial de esta línea (no documental).
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {/* Valor final metales — contribución del metal que CIERRA
                                              contra el total: Valor final metales + Monetario = Total
                                              línea c/ imp. Usa `metalFinalCard` RECONCILIADO (derivado
                                              de `cardTotal − cardMonetario` cuando el saldo es
                                              autoritativo) — NO el residual crudo `sumMetalSalePre +
                                              cardMetalImpact`. Así el metal absorbe el centavo del drift
                                              y la suma visual cierra exacta (mismo valor reconciliado
                                              que alimenta `cardMonetario`). */}
                                          <div className="mt-1 pt-1 border-t border-border/20 grid grid-cols-[1fr_auto] items-baseline gap-2" data-tp-metal-final>
                                            <span className="text-[10px] font-medium leading-tight text-muted">Valor final metales</span>
                                            <span className="tabular-nums text-[12px] font-semibold leading-tight text-foreground/80">
                                              {mFmt(metalFinalCard)}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {/* ── Divisor METAL ↔ MONETARIO ─────────────────── */}
                                  {metalParents.length > 0 && hasHechura && (isLineDesglosada || compositionDetailOpen) && (
                                    <div className="my-3 border-t border-border/25" />
                                  )}

                                  {/* ── Sección MONETARIO ───────────────────────── */}
                                  {/* DESGLOSADO: visible siempre (el monto monetario es
                                      protagonista). UNIFICADO: detrás de "Ver detalle". Las
                                      sub-filas ("Valor comercial" + "Redondeo comercial") ya
                                      viven detrás de `compositionDetailOpen`. */}
                                  {hasHechura && (isLineDesglosada || compositionDetailOpen) && (() => {
                                    // Opción A (descomposición FÍSICA) — MONETARIO =
                                    // SALDO MONETARIO POST-redondeo (`hechuraDisplayTotal`,
                                    // que arriba toma `lineMonetarySaldoPostCommercialRounding`
                                    // del backend cuando hay snapshot DESGLOSADO, ej.
                                    // 185.500; o el fallback comercial si no).
                                    // Backend SSOT — el FE NO lo compone ni redondea.
                                    // El Total línea es la CONSECUENCIA (metal físico +
                                    // monetario), no se fuerza a múltiplo redondo.
                                    // Δ del Redondeo Comercial sobre el bucket
                                    // monetario, PER-LÍNEA (no el agregado del
                                    // documento). Backend SSOT
                                    // (`hechuraRoundingMonetaryImpact`). El delta del
                                    // saldo se muestra ahora en la sección "Redondeos"
                                    // al final del detalle (no inline acá).
                                    return (
                                      <div className={cn(metalParents.length === 0 && "mt-1.5", "space-y-1")}>
                                        {/* MONETARIO — label IZQ · valor PROTAGONISTA DER
                                            (mismo patrón que "ORO · 1,40 g" en metales). */}
                                        <div className="grid grid-cols-[1fr_auto] items-baseline gap-2">
                                          <span className="text-[9px] font-semibold uppercase tracking-wide leading-tight text-muted/70">
                                            MONETARIO
                                          </span>
                                          <span
                                            data-tp-hechura-display-total
                                            className={cn(
                                              "tabular-nums leading-tight text-right",
                                              isLineDesglosada ? "text-lg font-bold" : "text-[12px] font-semibold",
                                              // DESGLOSADO: monetario protagonista (foco azul).
                                              // UNIFICADO: neutro. Negativo: siempre rojo.
                                              cardMonetario < 0
                                                ? vt.colors.discount
                                                : (isLineDesglosada ? "text-primary" : "text-text"),
                                            )}
                                          >
                                            {mFmt(cardMonetario)}
                                          </span>
                                        </div>
                                        {/* Total línea c/imp. — MOVIDO al header del Resumen
                                            Comercial (debajo del título), donde ahora vive
                                            SIEMPRE en desglosado. Se elimina de acá para no
                                            duplicarlo cuando el detalle MONETARIO está
                                            expandido. */}
                                        {/* Redondeo COMERCIAL del bucket monetario (hechura /
                                            saldo) — fila TÉCNICA secundaria (mismo patrón/estilo
                                            que el redondeo del metal). SOLO EXPANDIDO en AMBOS
                                            modos: la vista cerrada muestra únicamente el MONETARIO
                                            principal; el detalle del redondeo se revela con
                                            "Ver detalle / Ver composición". (Antes
                                            `compositionDetailOpen || isLineDesglosada` lo dejaba
                                            visible colapsado en DESGLOSADA — contradecía el propio
                                            "Solo expandido".) Fallback
                                            `hechuraRoundingMonetaryImpact ?? hechuraSaleRoundingDelta`:
                                              · PER_DOCUMENT → hechuraRoundingMonetaryImpact.
                                              · PER_LINE      → hechuraSaleRoundingDelta.
                                            NO es el redondeo físico del metal ni el financiero. */}
                                        {compositionDetailOpen && (() => {
                                          // Impacto del redondeo comercial monetario del bucket
                                          // hechura/saldo — SOLO para DESGLOSADA (passthrough):
                                          //   · DESGLOSADA (contrato) → `lineSummary.monetary.roundingImpact`.
                                          //   · Legacy (sin contrato) → `resolveCommercialHechuraImpact`.
                                          // En UNIFICADA este valor se IGNORA: el helper deriva el
                                          // redondeo del TOTAL (`totalWithTaxPost − totalWithTax`),
                                          // porque el metal se muestra crudo y TODO el redondeo del
                                          // total cae en el monetario (regla Lista Unificada).
                                          // DESGLOSADA — Trabajo #2 (Evolución): el redondeo monetario
                                          // se lee C-FASE1-first, simétrico con el Footer (Paso 2.2) y con
                                          // la cadena de impacto metal del Card:
                                          //   1) lineSummary.monetary.roundingImpact  (C-FASE1; lineSummary
                                          //      = lineCommercialDisplaySummary ?? lineCommercialSummary)
                                          //   2) lineOwnHechuraRoundingMonetaryImpact  (B, autónomo)
                                          //   3) resolveCommercialHechuraImpact(...)   (legacy)
                                          // (1) y (2) provienen del mismo primitivo autónomo → equivalentes
                                          // para líneas frescas; (1) es el contrato canónico. UNIFICADA NO
                                          // cambia: el helper la ignora y usa `unificadoImpact`.
                                          const ownHechuraImpact = (meta as any)?.lineOwnHechuraRoundingMonetaryImpact;
                                          const summaryHechuraImpact =
                                            isLineDesglosada && lineSummary ? lineSummary.monetary.roundingImpact : undefined;
                                          const desglosadoImpact =
                                            !isLineDesglosada
                                              ? (lineSummary ? 0 : resolveCommercialHechuraImpact(
                                                  meta as any,
                                                  { allowPerLineLegacy: (meta as any)?.priceListMixed !== true },
                                                ))
                                              : (typeof summaryHechuraImpact === "number" && Number.isFinite(summaryHechuraImpact)
                                                  ? summaryHechuraImpact
                                                  : (typeof ownHechuraImpact === "number" && Number.isFinite(ownHechuraImpact)
                                                      ? ownHechuraImpact
                                                      : resolveCommercialHechuraImpact(
                                                          meta as any,
                                                          { allowPerLineLegacy: (meta as any)?.priceListMixed !== true },
                                                        )));
                                          // UNIFICADA (MARGIN_TOTAL) — el ÚNICO redondeo es el del PRECIO
                                          // FINAL (FINAL_PRICE), que el motor YA emite como `appliedRounding`
                                          // (applyOn="TOTAL"). `unitAdjustment = postRounding − preRounding`
                                          // es el delta POR UNIDAD; el delta de la LÍNEA = unitAdjustment ×
                                          // qty (igual que el backend, sales.service.ts:5336). Passthrough
                                          // puro de un campo ya presente en `pricingMeta` (applySalePreview
                                          // ToDraft.ts:225). NO se usa metalRoundingMonetaryImpact /
                                          // hechuraRoundingMonetaryImpact / saldoPre — solo este campo.
                                          const ar = (meta as any)?.appliedRounding;
                                          const unitAdjustment =
                                            ar && ar.applyOn === "TOTAL"
                                            && typeof ar.unitAdjustment === "number" && Number.isFinite(ar.unitAdjustment)
                                              ? ar.unitAdjustment
                                              : null;
                                          // Z (redondeo monetario UNIFICADA) — DOS mecanismos mutuamente
                                          // excluyentes en runtime:
                                          //   1. FINAL_PRICE (lista MARGIN_TOTAL, applyOn="TOTAL") →
                                          //      `appliedRounding.unitAdjustment × qty`. Es el redondeo
                                          //      PER_LINE propio de la lista unificada.
                                          //   2. PER_DOCUMENT UNIFICADO → `hechuraRoundingMonetaryImpact`
                                          //      (cuota prorrateada del ajuste documental). El PER_DOCUMENT
                                          //      SUPRIME el PER_LINE, así que cuando este mecanismo está
                                          //      activo NO hay `appliedRounding.applyOn="TOTAL"`.
                                          // Por eso el orden es: FINAL_PRICE primero; PER_DOCUMENT como
                                          // fallback SOLO cuando no hubo redondeo de línea. Nunca coexisten
                                          // (el test los pone ambos para verificar la precedencia).
                                          // Passthrough puro — cero matemática FE.
                                          const hechuraImpactDoc = (meta as any)?.hechuraRoundingMonetaryImpact;
                                          const unificadoImpact =
                                            unitAdjustment != null
                                              ? unitAdjustment * previewQtyAnchor
                                              : (isAmountSignificantInBase(hechuraImpactDoc, visibilityBaseFactor)
                                                  ? hechuraImpactDoc
                                                  : null);
                                          // COMBO (saldo monetario puro) — su Redondeo Comercial es SIEMPRE
                                          // monetario, sin importar si la lista es UNIFICADA o DESGLOSADA.
                                          // Según la lista, el backend lo emite en campos distintos:
                                          //   · FINAL_PRICE (MARGIN_TOTAL)  → `appliedRounding.unitAdjustment`.
                                          //   · PER_DOCUMENT (METAL_HECHURA) → `lineOwnHechuraRoundingMonetaryImpact`
                                          //     / `hechuraRoundingMonetaryImpact` / `lineSummary.monetary.roundingImpact`.
                                          // En DESGLOSADA el camino `desglosadoImpact` puede quedar en 0
                                          // (lo sombrea `summary.monetary.roundingImpact = 0`) y NO lee
                                          // `appliedRounding` → el detalle no aparecía. Para el combo tomamos
                                          // el PRIMER valor monetario disponible (cualquier fuente) y lo
                                          // mostramos como pieza unificada. Passthrough puro — cero recálculo.
                                          // Generalizado a TODA línea monetaria pura (servicio,
                                          // combo, producto sin metal). Toma el PRIMER valor de
                                          // redondeo monetario disponible (cualquier fuente).
                                          const monetaryRedondeo = isMonetaryOnlyLine
                                            ? (() => {
                                                const cands = [
                                                  unitAdjustment != null ? unitAdjustment * previewQtyAnchor : null,
                                                  ownHechuraImpact,
                                                  hechuraImpactDoc,
                                                  lineSummary ? lineSummary.monetary?.roundingImpact : null,
                                                ];
                                                for (const c of cands) {
                                                  if (isAmountSignificantInBase(c, visibilityBaseFactor)) return c;
                                                }
                                                return null;
                                              })()
                                            : null;
                                          // Descomposición SSOT (Y + Z = X). Display puro.
                                          const decomp = resolveLineMonetaryRoundingDecomposition({
                                            // Línea monetaria pura → pieza UNIFICADA: el detalle se
                                            // muestra igual en lista desglosada o unificada.
                                            isLineDesglosada: isLineDesglosada && !isMonetaryOnlyLine,
                                            monetarioFinal:   cardMonetario,         // X (autónomo en Desglosada)
                                            unificadoImpact:  isMonetaryOnlyLine ? monetaryRedondeo : unificadoImpact, // Z
                                            desglosadoImpact,                        // Z DESGLOSADA (autónomo)
                                            // Umbral de visibilidad invariante a la moneda (ver
                                            // `visibilityBaseFactor`): la descomposición del redondeo
                                            // aparece/desaparece igual en base y en moneda no-base.
                                            baseFactor:       visibilityBaseFactor,
                                          });
                                          if (!decomp) return null;
                                          return (
                                            <>
                                              {/* Valor comercial monetario (pre-redondeo) — Y. */}
                                              <div className="grid grid-cols-[1fr_auto] items-baseline gap-2" data-tp-hechura-base>
                                                <span className="text-[10px] leading-tight text-muted/65">Valor comercial</span>
                                                <span className="not-italic tabular-nums text-[11px] font-semibold leading-tight text-muted/80">
                                                  {mFmt(decomp.valorComercial)}
                                                </span>
                                              </div>
                                              {/* Redondeo comercial monetario (con signo) — Z. */}
                                              <div className="grid grid-cols-[1fr_auto] items-baseline gap-2" data-tp-hechura-rounding-delta>
                                                <span className="text-[10px] italic leading-tight text-muted/65">Redondeo comercial</span>
                                                <span className="not-italic tabular-nums text-[11px] font-semibold leading-tight text-muted/65">
                                                  {decomp.redondeo > 0 ? "+" : ""}{mFmt(decomp.redondeo)}
                                                </span>
                                              </div>
                                              {/* Valor redondeado (= MONETARIO final) — X. Cierra
                                                  Y + Z = X explícitamente. En UNIFICADA siempre; en
                                                  DESGLOSADA el MONETARIO principal ya ES el valor
                                                  redondeado (fila redundante, oculta). EXCEPCIÓN COMBO:
                                                  el combo es saldo monetario puro y NO muestra metales,
                                                  así que cierra su detalle comercial como una pieza
                                                  unificada (Valor comercial → Redondeo → Valor
                                                  redondeado), igual que en saldo UNIFICADO. */}
                                              {(!isLineDesglosada || isMonetaryOnlyLine) && (
                                                <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 mt-0.5 pt-1 border-t border-border/15" data-tp-hechura-rounded>
                                                  <span className="text-[10px] font-medium leading-tight text-muted/70">Valor redondeado</span>
                                                  <span className="not-italic tabular-nums text-[11px] font-semibold leading-tight text-foreground/80">
                                                    {mFmt(decomp.valorRedondeado)}
                                                  </span>
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })()}

                                  {/* ── Ver detalle/composición · Ver menos ───────
                                      DESGLOSADA → "Ver detalle" (revela metal padre +
                                      redondeo; colapsado ya muestra METALES+MONETARIO).
                                      UNIFICADA → "Ver composición" (revela el desglose;
                                      colapsado muestra solo el Total). Solo estado UI. */}
                                  {(metalParents.length > 0 || hasHechura || isMonetaryOnlyLine) && (
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleCompositionDetailOpen(l.id)}
                                        className="flex items-center gap-1 text-[10px] leading-tight text-muted/70 hover:text-muted cursor-pointer"
                                        data-tp-composition-detail-toggle
                                      >
                                        <HelpCircle size={11} />
                                        {compositionDetailOpen
                                          ? "Ver menos"
                                          : (isMonetaryOnlyLine
                                              ? "Ver detalle comercial"
                                              : (isLineDesglosada ? "Ver detalle" : "Ver composición"))}
                                        <ChevronDown
                                          size={11}
                                          className={cn("transition-transform", compositionDetailOpen && "rotate-180")}
                                        />
                                      </button>
                                      {/* El "Total línea c/imp." colapsado se movió DEBAJO
                                          del título del bloque (no junto al toggle). El
                                          toggle queda limpio: solo "Ver detalle". */}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* T28 — Label "Base: Precio de lista/manual · Cliente
                          exento" eliminado: era redundante con el chip de
                          origen del Precio (celda hermana) y con el label
                          "Exento cliente" del card de Impuestos. */}

                      {/* T36 — Sección financiera ELIMINADA. Los detalles
                          de Bonificación e Impuestos ahora se consultan vía
                          ícono ⓘ + popover contextual al lado del toggle %/$
                          en cada celda. El Total línea c/imp. vuelve a ser
                          un resumen financiero limpio (total + mini desglose
                          + Precio Unitario). "Financial details on demand". */}

                      {/* Indicador sutil de recálculo: solo aparece mientras
                          hay preview en vuelo para esta línea. No bloquea la
                          pantalla — los importes ya bajan opacidad arriba. */}
                      {isCalculating && (
                        <div className="text-[9px] italic leading-tight text-muted/70 text-right">
                          Recalculando…
                        </div>
                      )}
                      </div>{/* /UX WARNING wrapper — cierre movido por R6 Etapa 2 */}
                    </>
                  );
                })() : (
                  <>
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">Total línea</div>
                    <div className="text-lg font-bold tabular-nums text-primary leading-tight">
                      {mFmt(
                        typeof l.lineTotal === "number" && Number.isFinite(l.lineTotal)
                          ? l.lineTotal
                          : totalLine,
                      )}
                    </div>
                  </>
                );
                  // En CLASSIC envolvemos en flex-col para que el cell-flex
                  // ROW (label + monto + sub-líneas) sea un único hijo del
                  // row, con la toolbar como hermano. En el resto de presets
                  // pasamos el fragment directo (los hijos siguen el
                  // flex-col original del cell wrapper).
                  // `min-w-0 w-full` en AMBOS modos: el bloque Total/Resumen se
                  // acomoda DENTRO de la columna fija (`minmax(240px,1fr)`) en vez
                  // de forzar su crecimiento — así las columnas quedan alineadas
                  // entre líneas y el Resumen no pisa el borde. `items-end`
                  // preserva el alineado a la derecha. No toca sticky/shadow.
                  return isClassicInline ? (
                    <div className="flex flex-col items-end min-w-0 w-full">{totalContent}</div>
                  ) : (
                    <div className="flex flex-col items-end min-w-0 w-full">{totalContent}</div>
                  );
                })()}

                {/* Mini-toolbar contextual (Colapsar/Restablecer/Eliminar/Menú).
                    · CLASSIC → se renderea como TRAILING ACTIONS a la derecha
                      del bloque del total (cell wrapper es flex-row).
                    · Resto de presets → vive al pie del bloque del total
                      (cell wrapper es flex-col, comportamiento UX.12 original).
                    En ambos casos: una sola instancia, sin overlap, mismos
                    handlers y mismo orden de iconos. */}
                {renderLineActionsToolbar(isClassicInline)}
              </div>

              {/* (Descripción + Stock/Almacén/Canal ahora viven dentro
                  del cell ARTÍCULO de arriba, apilados como flex column,
                  para que su altura no dependa de las otras columnas.) */}
            </div>
          );
        })()}

        {/* T35 — Zona expandida común eliminada. Triggers y paneles
            ahora viven dentro de la celda "Total línea c/imp." debajo
            del Precio Unitario (ver más arriba en el grid del row). */}

        {/* ── Panel "Ajustes avanzados" (overrides controlados) ───────────
            Permite al operador fijar precio manual, bonificación manual o
            impuestos manuales. Cada cambio se manda al backend como
            override y el motor recalcula. Frontend NO calcula nada. */}
        {onApplyLineOverrides && advancedOpenIds.has(l.id) && !isEmptyLineLocal(l) && l.articleId && (
          <div
            className={cn(
              "-mx-3 -mb-3 mt-1 border-t border-border/40 bg-surface2/30 pt-1.5 pb-2",
              // Alineación con la línea principal: en lg+ el contenido
              // arranca después del drag handle (14px + gap 4px = 18px) y
              // termina con el padding derecho normal del card.
              "px-3 lg:pl-[22px] lg:pr-3",
            )}
          >
            {/* Fase 2 — switch del panel de composición:
                 · `view === "sale"` (Factura) → grilla editable nueva.
                 · resto (Compras/Presupuestos/Órdenes) → panel legacy
                   read-mostly. Sin tocar el comportamiento existente. */}
            {compositionView === "sale" ? (
              <SaleCompositionEditableGrid
                line={l}
                currency={currency}
                onApply={(patch) => onApplyLineOverrides(l.id, patch)}
                onClear={onClearLineOverrides ? () => onClearLineOverrides(l.id) : undefined}
                onClose={() => toggleAdvancedOpen(l.id)}
                unitNameByCode={unitNameByCode}
                currencyById={currencyById}
                globalAdjustments={saleGlobalAdjustments}
                previewLoading={saleCompositionLoading}
                documentFxRate={documentFxRate}
              />
            ) : (
              <LineAdvancedOverridesPanel
                line={l}
                currency={currency}
                onApply={(patch) => onApplyLineOverrides(l.id, patch)}
                onClear={onClearLineOverrides ? () => onClearLineOverrides(l.id) : undefined}
                onClose={() => toggleAdvancedOpen(l.id)}
                view={compositionView}
              />
            )}
          </div>
        )}
        {/* Slot abierto al caller. El editor lo invoca para cada fila con
            artículo cargado; el caller decide si mostrar contenido (devolviendo
            null cuando no corresponde). Se usa hoy en Factura para mostrar la
            composición Metal/Hechura cuando el operador expande la línea
            con su propio toggle. El editor no asume qué se va a renderizar —
            solo provee el espacio y deja al caller controlar visibilidad. */}
        {!isEmptyLineLocal(l) && l.articleId && renderLineExtras && (() => {
          const extras = renderLineExtras(l, idx);
          if (!extras) return null;
          return (
            <div
              className={cn(
                "-mx-3 mt-1 border-t border-border/40 bg-surface2/20 pt-1.5 pb-2",
                "px-3 lg:pl-[22px] lg:pr-3",
              )}
            >
              {extras}
            </div>
          );
        })()}
        {/* (TPLinePriceBreakdown eliminado: el simulador local fue removido
             del flujo de facturación. La edición avanzada vive en el panel
             "Composición y ajustes" con backend authoritative.) */}

        {/* (Chip comercial al pie de la fila eliminado — la alerta ahora
             vive INTEGRADA en el bloque "Total línea c/imp." más arriba,
             reusando el foco visual natural del operador en vez de armar
             un chip aparte que duplicaba información.) */}
      </div>
    );
  }

  // ── Particionar líneas: reorderables vs. fijas (placeholder al final) ────
  const reorderable = reorderLines
    ? lines.filter((l, i) => isReorderable ? isReorderable(l, i) : true)
    : [];
  const fixed = reorderLines
    ? lines.filter((l, i) => isReorderable ? !isReorderable(l, i) : false)
    : lines;

  function onDragEnd(e: DragEndEvent) {
    if (!reorderLines) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    reorderLines(String(active.id), String(over.id));
  }

  return (
    // Wrapper con overflow-x:auto en lg+: scroll horizontal interno
    // controlado (no del body) si el ancho no alcanza, en vez de comprimir
    // inputs o desbordar el card.
    //
    // FIX contención — el min-width interno DEBE cubrir el ancho real del
    // row para que el borde del card contenga TODAS las columnas (incl. la
    // de acciones/total a la derecha).
    //
    // UX.11/12 — proporciones recalibradas + acciones MOVIDAS dentro del
    // bloque "Total línea" (UX.12). Antes el editor tenía 8 columnas con
    // la última (acciones 160px) al extremo derecho del grid, que con el
    // layout 2-cols (UX.9) quedaba cortada por scroll horizontal. Ahora
    // 7 columnas (sin la 8 de acciones), con la columna Total ampliada
    // a 200px para acomodar 4 íconos h-9 (= 4×36=144px) como toolbar
    // contextual debajo del monto. Nuevo total:
    //   columnas: 14 + 420 + 110 + 200 + 130 + 130 + 200    = 1204
    //   gaps (gap-x-2 = 8px × 6)                            =   48
    //   padding del card (px-2 = 8px × 2) + borde (1px × 2) =   18
    //   total ≈ 1270  → usamos 1280 con holgura para gutter scroll.
    // El min-w bajó ~60px; combinado con la columna izquierda del modal
    // ahora ~120px más ancha (aside angostado de 460→400), la fila entra
    // sin scroll en la mayoría de viewports desktop. En viewports más
    // chicos el overflow-x-auto sigue activo como red de seguridad → el
    // contenido nunca se comprime ni desborda el card.
    //
    // R2 (UX densidad) — `space-y-2` entre líneas (antes `space-y-4`).
    // El operador alto-volumen ve más líneas por pantalla sin perder
    // la separación visual; el borde lateral comercial + el radius del
    // card siguen marcando el ritmo entre filas.
    <div className="space-y-2 lg:overflow-x-auto">
      <div className="space-y-2 lg:min-w-[1280px]">
      {reorderLines ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={reorderable.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            {reorderable.map((l, i) => (
              <SortableLineRow key={l.id} line={l} idx={i} renderContent={renderLineContent} />
            ))}
          </SortableContext>
          {fixed.map((l, i) => (
            <React.Fragment key={l.id}>
              {renderLineContent(l, reorderable.length + i)}
            </React.Fragment>
          ))}
        </DndContext>
      ) : (
        <>
          {lines.map((l, i) => (
            <React.Fragment key={l.id}>{renderLineContent(l, i)}</React.Fragment>
          ))}
        </>
      )}

      {lines.length === 0 && (
        // UX.10 — `min-h-[280px]` + flex center: cuando la factura está
        // vacía, el editor mantiene una altura visual razonable. La
        // columna izquierda (Header + Líneas + Observaciones) gana
        // densidad y queda más balanceada respecto al aside lateral
        // derecho (6 cards apilados) → menos sensación de "izquierda
        // colapsada vs derecha llena". Cuando hay líneas, este bloque NO
        // se renderiza → cero impacto en facturas con artículos.
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted">
          Sin líneas todavía. Agregá la primera desde el botón «Agregar línea» del parent.
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted">
            <Plus size={11} /> Buscá el artículo por código o nombre
          </div>
        </div>
      )}
      </div>

      {/* Lightbox de imágenes (compartido por todas las filas) */}
      <TPImageLightbox
        open={lightbox !== null}
        images={lightbox?.images ?? []}
        alt={lightbox?.alt}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

// ── Sub-componente sortable que envuelve el render de la fila ──────────────
function SortableLineRow({
  line,
  idx,
  renderContent,
}: {
  line: DocumentLine;
  idx: number;
  renderContent: (l: DocumentLine, idx: number, dnd: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners: any;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex:  isDragging ? 10  : undefined,
  };
  return <>{renderContent(line, idx, { setNodeRef, style, attributes, listeners })}</>;
}

export default TPDocumentLineAdvancedEditor;
