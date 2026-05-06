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
import { Plus, Copy, Trash2, ChevronRight, Warehouse, GripVertical, Package, Settings2, RotateCcw, ChevronDown, Check, Loader2, ChevronsUpDown, ChevronsDownUp, X } from "lucide-react";

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
import { TPBadge } from "./TPBadges";
import { TPIconButton } from "./TPIconButton";
import TPNumberInput from "./TPNumberInput";
import TPQuantityField from "./TPQuantityField";
import {
  TPArticleVariantSearchSelect,
  MOCK_ARTICLES,
  type TPArticleLite,
  type TPArticleStockByWarehouse,
} from "./TPArticleVariantSearchSelect";
import { LineAdvancedOverridesPanel } from "./LineAdvancedOverridesPanel";
import { TPImageLightbox } from "./TPImageLightbox";
import { TPActionsMenu } from "./TPActionsMenu";
import { TPPopover } from "./TPPopover";

import { type DocumentLine } from "../../lib/document-types";
import { fmtMoney, fmtQty } from "../../lib/document-helpers";
import {
  resolveQuantityConstraints,
  applyQuantityChange,
  type QuantityConstraints,
} from "../../lib/commercial-line-engine";

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
   * Aplica un patch de overrides a la línea. Cada key es opcional; `null`
   * limpia ese override puntual. Backend recalcula y devuelve.
   */
  onApplyLineOverrides?: (
    lineId: string,
    patch: {
      taxOverride?:    { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null;
      manualPrice?:    number | null;
      manualDiscount?: { mode: "PERCENT" | "AMOUNT"; value: number; appliesTo?: AppliesToScope } | null;
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
  const [open, setOpen] = useState(false);

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
        <div className="py-1.5">
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Lista de precios — esta línea
          </div>
          <div className="px-3 pb-1 text-[10px] italic text-muted/70">
            La lista global se cambia desde el header.
          </div>
          {/* Clearable: "Usar lista global" → onSelect(null) limpia el override. */}
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={cn(
              "flex w-full items-start gap-2 px-3 py-1.5 text-left transition hover:bg-surface2/60",
              !hasOverride && "bg-primary/10",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className={cn(
                "text-[12px]",
                !hasOverride ? "text-primary font-semibold" : "text-muted",
              )}>
                Usar lista global
              </div>
              {globalListName && (
                <div className="text-[10px] text-muted">{globalListName}</div>
              )}
            </div>
            {!hasOverride && <Check size={12} className="mt-0.5 text-primary" />}
          </button>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted">Sin listas disponibles.</div>
          ) : (
            options.map((o) => {
              const isSel = hasOverride && overrideId === o.id;
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
        subtitle: meta.appliedPromotionName ? `Promo: ${meta.appliedPromotionName}` : undefined,
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
type AppliesToScope = "METAL" | "HECHURA" | "PRODUCT" | "SERVICE" | "TOTAL";
const APPLIES_TO_LABELS: Record<AppliesToScope, string> = {
  METAL:    "Metal",
  HECHURA:  "Hechura",
  PRODUCT:  "Producto",
  SERVICE:  "Servicio",
  TOTAL:    "Total",
};

/**
 * Devuelve los scopes disponibles para una línea según su composición.
 * TOTAL siempre está; los demás solo si el motor expuso ese componente
 * en `pricingMeta.composition`. Evita listar opciones vacías que no
 * aplican a la línea.
 */
function getAvailableScopes(line: DocumentLine): AppliesToScope[] {
  const comp = line.pricingMeta?.composition;
  const out: AppliesToScope[] = ["TOTAL"];
  if (comp?.metal)   out.push("METAL");
  if (comp?.hechura) out.push("HECHURA");
  // product / service: cuando el motor los exponga en composition se
  // sumarán acá automáticamente. Por ahora no se listan.
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
      return ["TOTAL", "METAL", "HECHURA", "PRODUCT", "SERVICE"];
    }
    const set = new Set<AppliesToScope>(["TOTAL", ...scopes]);
    return (["TOTAL", "METAL", "HECHURA", "PRODUCT", "SERVICE"] as AppliesToScope[])
      .filter((k) => set.has(k));
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
  onApplyLineOverrides,
  onClearLineOverrides,
  enableLineSimulator = false,
  renderLineExtras,
  renderLineExtraToggle,
  showLineTotalWithTax = false,
  onChangeLinePriceList,
}: TPDocumentLineAdvancedEditorProps) {
  /** fmtMoney con conversión visual aplicada.
   *  `displayRate` = unidades de moneda base por 1 unidad de la moneda
   *  elegida (ARS por USD). Se DIVIDE para expresar el amount en base
   *  como amount en la moneda del documento. */
  const mFmt = (amount: number) => fmtMoney((amount ?? 0) / displayRate, currency);

  // Mantiene en memoria el artículo seleccionado por línea (para chip de
  // origen y stock por almacén). No se persiste en DocumentLine.
  const [pickedById, setPickedById] = useState<Map<string, TPArticleLite>>(() => new Map());

  // Panel "Ajustes avanzados" abierto por línea. Estado local — no
  // persiste. Se cierra automáticamente cuando se limpian los overrides.
  const [advancedOpenIds, setAdvancedOpenIds] = useState<Set<string>>(() => new Set());
  function toggleAdvancedOpen(id: string) {
    setAdvancedOpenIds((prev) => {
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

    // Refs (no disparan render) — limpiar in-place.
    for (const k of Array.from(lastTaxRateByLine.current.keys())) {
      if (!validIds.has(k)) lastTaxRateByLine.current.delete(k);
    }
    for (const k of Array.from(lastDiscountByLine.current.keys())) {
      if (!validIds.has(k)) lastDiscountByLine.current.delete(k);
    }
  }, [lines]);

  function getDiscountAppliesTo(id: string): AppliesToScope {
    const fromMeta = lines.find((l) => l.id === id)?.pricingMeta?.manualDiscount?.appliesTo;
    return discountAppliesToById.get(id) ?? (fromMeta as AppliesToScope | undefined) ?? "TOTAL";
  }
  function getTaxAppliesTo(id: string): AppliesToScope {
    const fromMeta = lines.find((l) => l.id === id)?.pricingMeta?.taxOverride?.appliesTo;
    return taxAppliesToById.get(id) ?? (fromMeta as AppliesToScope | undefined) ?? "TOTAL";
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
    const subtotalPreview = Math.max(0, l.quantity * l.unitPrice - (l.discountAmount || 0));

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

    return (
      <div
        ref={dnd?.setNodeRef}
        style={dnd?.style}
        className={cn(
          "rounded-lg border border-border p-3 transition-colors duration-150",
          // Alternance sutil + tenue para placeholders vacíos.
          isEmptyRow
            ? "bg-card/30 opacity-75"
            : (idx % 2 === 0 ? "bg-card/60" : "bg-card/40"),
          // Línea activa (foco interno) con borde primario sutil — sin halo
          // invasivo que ya está suprimido en los inputs.
          "focus-within:border-primary/40",
        )}
      >
        {/* ── FILA PRINCIPAL — Img · Artículo · Cantidad · Precio · Desc · IVA · Total ── */}
        {(() => {
          const qty   = Number.isFinite(l.quantity) ? l.quantity : 0;
          const unit  = Number.isFinite(l.unitPrice) ? l.unitPrice : 0;
          const disc  = Number.isFinite(l.discountAmount) ? l.discountAmount : 0;
          const tax   = Number.isFinite(l.taxAmount ?? 0) ? (l.taxAmount ?? 0) : 0;
          const gross = qty * unit;
          const round1 = (n: number) => Math.round(n * 10) / 10;
          const discPct = gross > 0 ? round1((disc / gross) * 100) : 0;
          const net     = Math.max(0, gross - disc);
          const taxPct  = net > 0 ? round1((tax / net) * 100) : 0;
          const totalLine = net + (showTax ? tax : 0);
          return (
            <div className={cn(
              "grid grid-cols-1 items-start gap-y-0 gap-x-2",
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
              // Combo Artículo +5%: min 400→420 px, fr 1.5→1.575.
              // Acciones: ancho fijo 160px (cabe los 4 icons h-9 + 3
              // gaps de 4px = 156px) para que NUNCA desborden el card.
              "lg:grid-cols-[14px_minmax(420px,1.575fr)_minmax(110px,0.45fr)_minmax(220px,0.85fr)_minmax(130px,0.5fr)_minmax(130px,0.5fr)_minmax(180px,auto)_160px]",
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
                      return (
                        <span
                          className="inline-flex h-4 min-w-[1.6rem] items-center justify-center rounded border border-border bg-surface2/60 px-1 text-[10px] font-semibold tabular-nums text-muted/90"
                          title="Orden de línea en el comprobante"
                        >
                          Ítem {num}
                        </span>
                      );
                    })()}
                    <span>{l.isManual ? "Descripción" : "Artículo"}</span>
                    {l.isManual && (
                      <span
                        className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold tracking-wide text-amber-600 dark:text-amber-400"
                        title="Línea manual: texto libre, sin pricing-engine."
                      >
                        Manual
                      </span>
                    )}
                    {l.isManual && (displayRate ?? 1) !== 1 && (
                      <span
                        className="inline-flex items-center rounded-full border border-border bg-surface2/60 px-1.5 py-0 text-[9px] font-medium normal-case tracking-normal text-muted"
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
                {!isEmptyRow && !l.isManual ? (
                  <LineDescriptionTextarea
                    value={l.description ?? ""}
                    onChange={(v) => updateLine(l.id, { description: v })}
                  />
                ) : (
                  <div aria-hidden="true" className="min-h-[34px]" />
                )}

                {/* Stock / Almacén / Canal — se muestra solo cuando la línea
                    administra stock y el artículo está cargado. Cuando NO
                    se muestra (línea vacía o servicio/combo sin stock),
                    reservamos la altura con un placeholder invisible
                    para que la celda Artículo tenga el mismo alto en
                    TODAS las líneas — alineación columna por columna. */}
                {!(picked && lineManagesStock) && (
                  <div aria-hidden="true" className="min-h-[28px]" />
                )}
                {picked && lineManagesStock && (() => {
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
                  return (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-surface2/30 px-2 py-1 text-[11px]">
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
                      <span className="text-border">|</span>
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
                      {/* Lista de precios — comportamiento:
                          · onChangeLinePriceList provisto → picker per-línea
                            (override de esta línea; "Usar lista global"
                            limpia el override).
                          · onChangePriceList provisto sin onChangeLinePriceList
                            → picker document-scope (cambia toda la factura).
                          · Sin callbacks → solo display. */}
                      <span className="text-border">|</span>
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
                return (
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">Cantidad</div>
                <TPQuantityField
                  value={l.quantity}
                  onChange={(v) => {
                    // El componente ya hace fallback a default; acá sólo
                    // cuantizamos al step y respetamos el piso del editor.
                    const raw = v == null || !Number.isFinite(v) ? enforcedMin : v;
                    const { quantity } = applyQuantityChange(raw, {
                      ...qtyConstraints,
                      min: enforcedMin,
                      default: enforcedMin,
                    });
                    const safeQty = Number.isFinite(quantity) && quantity >= enforcedMin
                      ? quantity
                      : enforcedMin;
                    if (safeQty === l.quantity) return;
                    updateLine(l.id, { quantity: safeQty });
                  }}
                  constraints={{ ...qtyConstraints, min: enforcedMin, default: enforcedMin }}
                  unit={picked?.unitOfMeasure ?? null}
                  totalStock={lineManagesStock ? totalStock : null}
                  hasPromotion={!!l.pricingMeta?.appliedPromotionId}
                  hasQuantityDiscount={(l.pricingMeta?.quantityDiscountAmount ?? 0) > 0}
                  partial={!!l.pricingMeta?.partial}
                  size="sm"
                />
              </div>
                );
              })()}

              {/* Cell PRECIO LISTA — `pricingMeta.basePrice` (unitario, antes
                  de descuentos por cantidad/promo). Mismo dato que muestra el
                  Simulador en su línea "Precio lista". Si no hay meta cae al
                  unitPrice como fallback. Si el usuario edita: trata el valor
                  como precio manual final → seteo unitPrice (override). */}
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">Precio lista</div>
                <div className="relative">
                  <TPNumberInput
                    // Mostrar el override manual cuando exista. Si no, el
                    // basePrice del backend (precio de lista). El `unitPrice`
                    // como último fallback (líneas legacy sin pricingMeta).
                    value={
                      l.pricingMeta?.manualPrice != null
                        ? l.pricingMeta.manualPrice
                        : l.pricingMeta?.manualOverride
                          ? l.unitPrice
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
                    compact
                    className={cn(isCalculating && "opacity-60")}
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
                  ) : priceChip ? (
                    <>
                      <TPBadge tone={priceChip.tone === "danger" || priceChip.tone === "neutral" ? "info" : priceChip.tone} size="sm">
                        <span title={priceChip.tooltip}>{priceChip.label}</span>
                      </TPBadge>
                      {priceChip.subtitle && (
                        <span
                          className="truncate text-[10px] text-muted"
                          title={priceChip.subtitle}
                        >
                          {priceChip.subtitle}
                        </span>
                      )}
                    </>
                  ) : null}
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
                const hasQty        = qtyDiscUnit > 0;
                const hasPromo      = promoDiscUnit > 0;
                const qty           = Number.isFinite(l.quantity) ? l.quantity : 0;
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
                const fmtPct = (n: number) => {
                  const r = Math.round(n * 100) / 100;
                  return Number.isInteger(r) ? `${r}%` : `${r.toFixed(2).replace(/\.?0+$/, "")}%`;
                };
                const discAppliesTo = getDiscountAppliesTo(l.id);

                // ── Helper: resuelve qué valor mostrar ──────────────
                // Prioridad:
                //   1) MANUAL  — override del usuario (md.value)
                //   2) PROMO/QTY/MIXED — descuento automático del backend
                //   3) Cache  — último valor estable (anti-flicker entre
                //               previews que devolvieron breakdown vacío)
                //   4) NONE   — 0 (sin info)
                type DiscSource =
                  | "MANUAL" | "PROMOTION" | "QUANTITY_DISCOUNT" | "MIXED"
                  | "BACKEND_CACHE" | "NONE";
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
                  source = hasQty && hasPromo ? "MIXED" : hasQty ? "QUANTITY_DISCOUNT" : "PROMOTION";
                  autoUnit = qtyDiscUnit + promoDiscUnit;
                  unitEff  = autoUnit;
                  pctEff   = basePriceForPct > 0
                    ? Math.round((autoUnit / basePriceForPct) * 10000) / 100
                    : 0;
                  valueFromBackend = true;
                }

                // Cache de fallback — solo se consulta si no hay info nueva.
                if (!valueFromBackend) {
                  const cached = lastDiscountByLine.current.get(l.id);
                  if (cached && cached.articleId === l.articleId && (cached.pct > 0 || cached.unit > 0)) {
                    source  = "BACKEND_CACHE";
                    pctEff  = cached.pct;
                    unitEff = cached.unit;
                  }
                } else {
                  // Cache solo cuando el valor es legítimo (positivo).
                  if (pctEff > 0 || unitEff > 0) {
                    lastDiscountByLine.current.set(l.id, {
                      articleId: l.articleId,
                      pct:  pctEff,
                      unit: unitEff,
                    });
                  }
                }

                const bonifLineTotal = unitEff * qty;
                const isManualBonif  = source === "MANUAL";

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
                        mode:      isPct ? "PERCENT" : "AMOUNT",
                        value:     rawValue,
                        appliesTo: discAppliesTo,
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

                const displayValue = isPct ? pctEff : unitEff;

                // Fase 2 — Opción A: el input de bonificación es siempre
                // editable mientras el caller proporcione `onApplyLineOverrides`
                // (Factura). Cuando el usuario edita, automáticamente pasa a
                // manual y reemplaza la promo/desc cantidad del motor en esa
                // línea. Solo en pantallas legacy sin handler de overrides
                // se mantiene el bloqueo histórico.
                const canManualBonif  = !!onApplyLineOverrides && (!!l.articleId || l.isManual === true);
                const lockedByBackend = !canManualBonif && !isManualBonif && (hasPromo || hasQty);
                // Aviso visual cuando hay descuento auto y el usuario aún no
                // fijó manual: dejar claro qué pasaría si edita.
                void bonifNotice;

                return (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">Bonificación</div>

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
                            decimals={2}
                            min={0}
                            compact
                            readOnly
                            disabled
                            wrapClassName="flex-1 min-w-0"
                          />
                          <span
                            className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted/60"
                            title="Bonificación gobernada por el backend"
                          >
                            {isPct ? "%" : "$"}
                          </span>
                        </div>
                      <div className="mt-1 flex flex-col gap-1 rounded-md border border-border/60 bg-surface2/30 px-2 py-1.5">
                        {hasPromo && (
                          <div className="flex items-center justify-between gap-2">
                            <TPBadge
                              tone="success"
                              size="sm"
                              title={l.pricingMeta?.appliedPromotionName ?? "Promoción aplicada"}
                            >
                              Promo
                            </TPBadge>
                            <span className="text-[11px] font-semibold tabular-nums text-emerald-500">
                              −{mFmt(promoDiscUnit * qty)}
                            </span>
                          </div>
                        )}
                        {hasQty && (
                          <div className="flex items-center justify-between gap-2">
                            <TPBadge tone="success" size="sm" title="Descuento por cantidad">
                              Desc. cantidad
                            </TPBadge>
                            <span className="text-[11px] font-semibold tabular-nums text-emerald-500">
                              −{mFmt(qtyDiscUnit * qty)}
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] leading-tight text-muted">
                          Bonificación gobernada por el backend. Para sobreescribir, abrí «Ajustes avanzados».
                        </div>
                      </div>
                      </>
                    ) : (
                      // ── Modo editable: input + toggle %/$ + badge "Manual" si aplica.
                      <>
                        <div className="flex items-stretch gap-1">
                          <TPNumberInput
                            value={displayValue}
                            onChange={(v) => commitBonifChange(Math.max(0, v ?? 0))}
                            decimals={2}
                            min={0}
                            compact
                            wrapClassName="flex-1 min-w-0"
                            // X interna: limpia el valor a 0 manteniendo la
                            // línea en modo manual (override con value=0). NO
                            // restaura el valor automático/backend — eso lo
                            // hace "Restablecer línea". Aparece cuando hay
                            // valor visible (> 0) y el contexto permite
                            // override.
                            onClear={
                              // canManualBonif ya implica !!onApplyLineOverrides.
                              canManualBonif && (displayValue ?? 0) > 0
                                ? () => onApplyLineOverrides!(l.id, {
                                    manualDiscount: {
                                      mode:      isPct ? "PERCENT" : "AMOUNT",
                                      value:     0,
                                      appliesTo: discAppliesTo,
                                    },
                                  })
                                : undefined
                            }
                          />
                          <button
                            type="button"
                            data-tp-enter="ignore"
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const nextIsPct = !isPct;
                              setDiscountType(l.id, nextIsPct ? "percent" : "amount");
                              if (md && md.value > 0 && l.articleId && onApplyLineOverrides) {
                                let newValue = md.value;
                                if (md.mode === "PERCENT" && !nextIsPct) {
                                  newValue = (basePriceForPct * md.value) / 100;
                                } else if (md.mode === "AMOUNT" && nextIsPct) {
                                  newValue = basePriceForPct > 0 ? (md.value / basePriceForPct) * 100 : 0;
                                }
                                onApplyLineOverrides(l.id, {
                                  manualDiscount: {
                                    mode:      nextIsPct ? "PERCENT" : "AMOUNT",
                                    value:     Math.max(0, Math.round(newValue * 100) / 100),
                                    appliesTo: discAppliesTo,
                                  },
                                });
                              }
                            }}
                            title={`Cambiar a ${isPct ? "importe" : "porcentaje"}`}
                            aria-label="Cambiar tipo de bonificación"
                            className={cn(
                              "inline-flex h-[42px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted transition hover:bg-surface2/60 hover:text-text",
                              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card disabled:hover:text-muted",
                            )}
                          >
                            {isPct ? "%" : "$"}
                          </button>
                        </div>
                        {/* Aplica a (si hay handler de overrides) + badge "Manual" + importe efectivo. */}
                        {onApplyLineOverrides && (
                          <div className="mt-0.5">
                            <AppliesToLink
                              value={discAppliesTo}
                              scopes={getAvailableScopes(l)}
                              onChange={(next) => {
                                setDiscountAppliesTo(l.id, next);
                                const md2 = l.pricingMeta?.manualDiscount;
                                if (md2 && md2.value > 0 && l.articleId) {
                                  onApplyLineOverrides(l.id, {
                                    manualDiscount: { ...md2, appliesTo: next },
                                  });
                                }
                              }}
                            />
                          </div>
                        )}
                        {isManualBonif && (
                          <div className="mt-0.5">
                            <TPBadge tone="warning" size="sm">Bonificación manual</TPBadge>
                          </div>
                        )}
                        {bonifLineTotal > 0 && (
                          <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-500">
                            −{mFmt(bonifLineTotal)}
                          </div>
                        )}
                        {/* Si hay promo/desc cantidad automáticos y el usuario
                            todavía NO fijó manual, mostramos los conceptos
                            del backend como referencia + advertencia: si edita,
                            su valor reemplaza ambos en esa línea (Opción A). */}
                        {!isManualBonif && (hasPromo || hasQty) && (
                          <div className="mt-1 flex flex-col gap-0.5 rounded-md border border-border/40 bg-surface2/20 px-2 py-1">
                            {hasPromo && (
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span
                                  className="truncate text-muted"
                                  title={l.pricingMeta?.appliedPromotionName ?? "Promoción"}
                                >
                                  Promo
                                </span>
                                <span className="shrink-0 tabular-nums text-emerald-500">
                                  −{mFmt(promoDiscUnit * qty)}
                                </span>
                              </div>
                            )}
                            {hasQty && (
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="text-muted">Desc. cantidad</span>
                                <span className="shrink-0 tabular-nums text-emerald-500">
                                  −{mFmt(qtyDiscUnit * qty)}
                                </span>
                              </div>
                            )}
                            <div className="text-[9px] italic leading-tight text-muted/70">
                              Si editás, tu bonificación reemplaza{" "}
                              {hasQty && hasPromo
                                ? "promo + desc. cantidad"
                                : hasPromo
                                  ? "la promoción"
                                  : "el desc. por cantidad"}{" "}
                              en esta línea.
                            </div>
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
                const breakdown = meta?.taxBreakdown ?? [];
                const items     = exempt ? [] : breakdown;
                const qty       = Number.isFinite(l.quantity) ? l.quantity : 0;
                // line.taxAmount es TOTAL de línea (qty × unitTax). NO se
                // usa para derivar el % — sería STALE entre el cambio de
                // qty y la respuesta del preview backend (causaría flicker).
                const taxLineTotal = exempt ? 0 : (l.taxAmount ?? 0);
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
                  const cached = lastTaxRateByLine.current.get(l.id);
                  if (cached && cached.articleId === l.articleId && cached.rate > 0) {
                    taxRateStable = cached.rate;
                  }
                } else {
                  // Cacheamos el rate confiable + articleId actual.
                  lastTaxRateByLine.current.set(l.id, { articleId: l.articleId, rate: taxRateStable });
                }

                // Unit tax derivado del rate estable (NO de taxAmount/qty).
                // Para AMOUNT mode el motor backend sería más fiable, pero
                // mientras llega, este derivado es estable bajo qty.
                const taxUnitStable = override?.mode === "AMOUNT"
                  ? override.value
                  : (taxBaseUnit * taxRateStable) / 100;
                // Total efectivo del impuesto en la línea = unit estable × qty.
                // Bug fix: usamos esto en el label en lugar de `l.taxAmount`,
                // que queda STALE entre edit y respuesta del preview. Con
                // override manual=0, taxUnitStable=0 → taxLineEffective=0 → label $0.
                const taxLineEffective = Math.max(0, taxUnitStable * qty);

                const fmtPct = (n: number) => {
                  const r = Math.round(n * 100) / 100;
                  return Number.isInteger(r) ? `${r}%` : `${r.toFixed(2).replace(/\.?0+$/, "")}%`;
                };
                const hasMany = items.length > 1;
                // Modo del selector %/$ — toggle persistido localmente igual
                // que en Bonificación (`getTaxType`).
                const isPct = getTaxType(l.id) === "percent";
                // Si hay override → mostramos el value del override; sino →
                // mostramos el rate estable (PERCENT) o el unit estable (AMOUNT).
                const displayValue = override
                  ? override.value
                  : (isPct ? taxRateStable : taxUnitStable);
                const canEdit = !exempt && (!!l.articleId || l.isManual === true) && !!onSetLineTaxOverride;

                return (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">Impuestos</div>
                    {/* TPNumber + selector %/$ — siempre editables si la
                        línea no es exenta. */}
                    <div className="flex items-stretch gap-1">
                      <TPNumberInput
                        value={displayValue}
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
                        // X interna: limpia el valor a 0 manteniendo el
                        // override manual (value=0). NO restaura el impuesto
                        // automático del motor — eso lo hace "Restablecer
                        // línea". Aparece cuando hay valor visible (> 0).
                        onClear={
                          // El bloque editable ya solo se renderiza cuando
                          // hay onSetLineTaxOverride definido (mismo guard
                          // que el onChange de arriba con `!`).
                          canEdit && (displayValue ?? 0) > 0
                            ? () => onSetLineTaxOverride!(l.id, {
                                mode:      isPct ? "PERCENT" : "AMOUNT",
                                value:     0,
                                appliesTo: getTaxAppliesTo(l.id),
                              })
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
                        className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[11px] font-semibold text-muted transition hover:bg-surface2/60 hover:text-text"
                      >
                        {isPct ? "%" : "$"}
                      </button>
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

                      // Badge corto y único:
                      //   Exento | Manual | "IVA 21% (sobre metal)" (1)
                      // Cuando hay >1 impuesto NO usamos badge — se muestra
                      // un desglose detallado (nombre + monto) en su lugar.
                      const taxBadge: string | null =
                        exempt          ? "Exento"
                        : override      ? "Impuesto manual"
                        : displayItems.length === 1
                          ? `${displayItems[0].name}${displayItems[0].rate != null ? ` ${fmtPct(displayItems[0].rate)}` : ""}${labelForApplyOn(displayItems[0].applyOn)}`
                          : null;
                      const taxBadgeTone: "warning" | "info" =
                        exempt || override ? "warning" : "info";

                      // Tooltip: lista completa con applyOn cuando hay >1.
                      const taxTooltip = hasManyDisplay
                        ? displayItems
                            .map((t) =>
                              `${t.name}${t.rate != null ? ` ${fmtPct(t.rate)}` : ""}${labelForApplyOn(t.applyOn)}`,
                            )
                            .join(" · ")
                        : undefined;
                      void hasMany; // ya no se usa: reemplazado por hasManyDisplay.

                      return (
                        <>
                          {/* Línea 1: Aplica a (link compacto) */}
                          {canEdit && (
                            <div className="mt-0.5">
                              <AppliesToLink
                                value={getTaxAppliesTo(l.id)}
                                scopes={getAvailableScopes(l)}
                                onChange={(next) => {
                                  setTaxAppliesTo(l.id, next);
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
                          {/* Línea 2: badge único corto (solo cuando hay 0 o 1 impuesto). */}
                          {taxBadge && (
                            <div className="mt-0.5">
                              <TPBadge tone={taxBadgeTone} size="sm" title={taxTooltip}>
                                {taxBadge}
                              </TPBadge>
                            </div>
                          )}
                          {/* Desglose visible cuando hay más de un impuesto.
                              Si no hay rates ni amounts (fallback), mostramos
                              "Impuestos varios". */}
                          {!exempt && !override && hasManyDisplay && (
                            <div className="mt-0.5 flex flex-col gap-0.5 rounded-md border border-border/40 bg-surface2/20 px-1.5 py-1">
                              {displayItems.every((t) => t.rate == null && t.amount == null) ? (
                                <div className="text-[10px] italic text-muted">Impuestos varios</div>
                              ) : (
                                displayItems.map((t, i) => (
                                  <div key={`${t.name}-${i}`} className="flex items-center justify-between gap-2 text-[10px] leading-tight">
                                    <span className="min-w-0 truncate text-muted">
                                      <span className="text-text/80">{t.name}</span>
                                      {t.rate != null && (
                                        <span className="ml-1 text-muted">{fmtPct(t.rate)}</span>
                                      )}
                                      {labelForApplyOn(t.applyOn) && (
                                        <span className="ml-1 text-muted/70">{labelForApplyOn(t.applyOn)}</span>
                                      )}
                                    </span>
                                    {t.amount != null && (
                                      <span className="shrink-0 tabular-nums font-semibold text-amber-500">
                                        {mFmt(t.amount)}
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                          {/* Línea 3: importe total impuestos (ámbar).
                              Bug fix: el label debe derivar del estado
                              EFECTIVO (taxUnitStable × qty), no de
                              `l.taxAmount` que puede quedar stale entre el
                              edit y la respuesta del preview. Si hay
                              override manual (incluso 0), mostramos el
                              importe efectivo del override (puede ser $0).
                              Sin override y monto 0 → ocultamos el label. */}
                          {!exempt && (override != null || taxLineEffective > 0) && (
                            <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-amber-500">
                              +{mFmt(taxLineEffective)}
                            </div>
                          )}
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
                    valores vienen ya del backend (`sales/preview`). */}
              <div className="text-right">
                {showLineTotalWithTax ? (() => {
                  // Todos los valores vienen del backend (vía
                  // `selectInvoiceLineView`); el editor no recalcula nada.
                  const lineExempt  = l.pricingMeta?.taxExemptByEntity === true;
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
                  const lineTax = !lineExempt && typeof l.taxAmount === "number" && Number.isFinite(l.taxAmount)
                    ? l.taxAmount
                    : 0;
                  // Preferir el `lineTotalWithTax` provisto por el backend
                  // (preserva redondeo del motor). Fallback: subtotal + tax
                  // cuando el backend aún no lo expuso.
                  const totalWithTax = typeof l.lineTotalWithTax === "number" && Number.isFinite(l.lineTotalWithTax)
                    ? l.lineTotalWithTax
                    : subtotalNet + lineTax;
                  // ── Etiquetas explicativas (passthrough del backend, no
                  // recalculamos nada) ─────────────────────────────────────
                  // Tasa del impuesto: si el `taxBreakdown` trae un único
                  // ítem con rate, mostramos esa tasa; si hay varios, "varios";
                  // si no hay rate explícita, no anexamos % al label.
                  const taxItems = l.pricingMeta?.taxBreakdown ?? [];
                  let taxRateLabel: string | null = null;
                  if (lineTax > 0 && taxItems.length > 0) {
                    const ratesArr = taxItems
                      .map((t: any) => (typeof t?.rate === "number" ? Number(t.rate) : null))
                      .filter((r): r is number => r != null);
                    if (taxItems.length === 1 && ratesArr.length === 1) {
                      const r = ratesArr[0];
                      taxRateLabel = ` (${Number.isInteger(r) ? r : r.toFixed(2).replace(/\.?0+$/, "")}%)`;
                    } else if (ratesArr.length > 0) {
                      taxRateLabel = " (varios)";
                    }
                  }
                  // Origen del precio: lo dice el motor en `priceSource`.
                  // MANUAL_* → manual; PRICE_LIST/PROMO/QTY_DISCOUNT/etc → automático.
                  const priceSource = l.pricingMeta?.priceSource ?? "";
                  const isManualPrice =
                    priceSource === "MANUAL_OVERRIDE" ||
                    priceSource === "MANUAL_FALLBACK" ||
                    priceSource === "MANUAL";
                  return (
                    <>
                      <div
                        className={cn(
                          "text-[9px] font-semibold uppercase tracking-wide text-muted",
                          isCalculating && "opacity-50",
                        )}
                        title="Incluye impuestos. Si hay redondeo por comprobante, se aplica al total del documento (no a cada línea)."
                      >
                        Total línea c/ imp.
                      </div>
                      <div className={cn(
                        "text-lg font-bold tabular-nums text-primary leading-tight transition-opacity",
                        isCalculating && "opacity-40",
                      )}>
                        {mFmt(totalWithTax)}
                      </div>
                      {/* Desglose: base imponible + impuestos con tasa.
                          Renombrado "Subtotal" → "Base imponible" para
                          alinear con vocabulario fiscal y dejar claro al
                          operador cuál es la base sobre la que el motor
                          aplicó el IVA. */}
                      <div className={cn(
                        "mt-0.5 text-[10px] leading-tight text-muted tabular-nums transition-opacity",
                        isCalculating && "opacity-50",
                      )}>
                        Base imponible: {mFmt(subtotalNet)}
                        {lineTax > 0 && (
                          <>
                            {" · "}
                            Impuestos{taxRateLabel ?? ""}: {mFmt(lineTax)}
                          </>
                        )}
                      </div>
                      {/* Origen del precio (manual vs lista) — ayuda
                          al operador a entender por qué un precio no se
                          mueve cuando cambia la lista global. */}
                      {!isCalculating && (
                        <div className="mt-0.5 text-[9px] italic leading-tight text-muted/70">
                          Base: {isManualPrice ? "Precio manual" : "Precio de lista"}
                          {lineExempt && " · Cliente exento"}
                        </div>
                      )}
                      {/* Indicador sutil de recálculo: solo aparece mientras
                          hay preview en vuelo para esta línea. No bloquea la
                          pantalla — los importes ya bajan opacidad arriba. */}
                      {isCalculating && (
                        <div className="mt-0.5 text-[9px] italic leading-tight text-muted/70">
                          Recalculando…
                        </div>
                      )}
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
                )}
              </div>

              {/* Acciones — agrupamos icons rápidos + menú "...".
                  Layout: [Colapsar] [Restablecer] [Eliminar X] [Menú ...]
                  Tamaños h-9 w-9 (igual que el trigger del menú).
                  Para líneas vacías, los icons que aplican solo con
                  artículo se reemplazan por placeholder invisible para
                  preservar la alineación X del menú entre todas las filas. */}
              <div className="flex w-full min-w-0 items-center justify-end gap-1">
                {/* 1) Colapsar / Expandir — usa `toggleAdvancedOpen` que
                       toggle-ea el panel `LineAdvancedOverridesPanel` debajo
                       de la fila. Es el ÚNICO control de expansión por
                       línea. (El antiguo `toggleExpanded` no controlaba
                       nada visible y se removió.) */}
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

                {/* 1.b) Slot del caller para toggle extra (ej: "Ver detalle
                       de pricing" en Factura). El editor solo reserva el
                       espacio; el caller construye el botón. Filas vacías
                       lo omiten para mantener alineación. */}
                {renderLineExtraToggle && !isEmptyRow && l.articleId
                  ? renderLineExtraToggle(l, idx)
                  : (renderLineExtraToggle ? <div aria-hidden="true" className="h-9 w-9" /> : null)}

                {/* 2) Restablecer artículo — limpia overrides y vuelve al
                       cálculo automático del backend. Solo aplica si la
                       línea tiene artículo cargado; si no, placeholder. */}
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

                {/* 3) Eliminar línea (X) — SIEMPRE visible (incluido líneas
                       vacías). Hover en rojo para señalar acción destructiva. */}
                <TPIconButton
                  onClick={() => removeLine(l.id)}
                  className="h-9 w-9 hover:text-red-500 hover:border-red-500/40"
                  title="Eliminar línea"
                  aria-label="Eliminar línea"
                >
                  <X size={14} />
                </TPIconButton>

                {/* Menú "..." solo para acciones secundarias
                    (Editar artículo base, Duplicar línea). Restablecer y
                    Eliminar se sacaron de acá y pasaron a icons visibles. */}
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

              {/* (Descripción + Stock/Almacén/Canal ahora viven dentro
                  del cell ARTÍCULO de arriba, apilados como flex column,
                  para que su altura no dependa de las otras columnas.) */}
            </div>
          );
        })()}


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
            <LineAdvancedOverridesPanel
              line={l}
              currency={currency}
              onApply={(patch) => onApplyLineOverrides(l.id, patch)}
              onClear={onClearLineOverrides ? () => onClearLineOverrides(l.id) : undefined}
              onClose={() => toggleAdvancedOpen(l.id)}
            />
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
    // Wrapper con overflow-x:auto en lg+ para preservar los min-widths de
    // las columnas. Si el ancho disponible no alcanza, aparece scroll
    // horizontal en lugar de comprimir los inputs. min-width interno
    // calculado como suma de columnas + gaps + padding.
    <div className="space-y-3 lg:overflow-x-auto">
      <div className="space-y-3 lg:min-w-[1320px]">
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
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted">
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
