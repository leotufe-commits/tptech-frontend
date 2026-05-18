// src/pages/ventas-facturas/InvoiceEditorModal/LinesEditorSection.tsx
// ============================================================================
// Sección "Líneas" del modal de Factura.
//
// Wrapper presentacional del `TPDocumentLineAdvancedEditor`:
//   - Empty state cuando `lines.length === 0`.
//   - Editor full (composición de costo embebida en cada línea expandida via
//     `<SaleCompositionEditableGrid>` interno del editor).
//   - Scope ref para el hook Enter-Tab navigation (Fase 4.5).
//
// Read-only — toda la lógica de líneas (patch, picker, overrides) la inyecta
// el padre como callbacks. Este wrapper NO contiene lógica comercial; sólo
// compone el editor con sus props y delega.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2.2.
// FASE 12.8 — eliminado el render del `SaleLinePricingPanel` ("Ver composición
// y flujo de precio") debajo de cada línea expandida. La data que mostraba
// (componentes, costo, ajustes, costo línea) ahora vive consolidada en la
// `SaleCompositionEditableGrid` interna del editor avanzado — repetirla acá
// era duplicación visual + altura innecesaria. El componente
// `SaleLinePricingPanel` sigue existiendo en `components/sales/` por si se
// reactiva en otra pantalla; cero pérdida funcional.
// ============================================================================

import React from "react";
import { FileText } from "lucide-react";
import { cn } from "../../../components/ui/tp";
import { toast } from "../../../lib/toast";
import { TPDocumentLineAdvancedEditor } from "../../../components/ui/TPDocumentLineAdvancedEditor";
import type { DocumentLine } from "../../../lib/document-types";

/** Props del wrapper. Agrupadas semánticamente pero flat para que el caller
 *  pueda ver de un vistazo qué se le exige. */
export type LinesEditorSectionProps = {
  // ── Data ───────────────────────────────────────────────────────────────
  /** Líneas para render (matched con preview, sortedKeyHeaders, etc.). */
  lines: DocumentLine[];
  /** Total de líneas en el draft — usado solo para decidir empty state. */
  totalLinesInDraft: number;

  // ── Display ────────────────────────────────────────────────────────────
  currency:     string;
  displayRate:  number;
  viewMode:     React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["viewMode"];
  headerSubtotals: React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["headerSubtotals"];

  // ── Catálogos ──────────────────────────────────────────────────────────
  priceLists:    Array<{ id: string; name: string }>;
  channels:      Array<{ id: string; name: string }>;
  warehouses:    Array<{ id: string; name: string }>;
  unitNameByCode?: React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["unitNameByCode"];
  currencyById?:   React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["currencyById"];
  saleGlobalAdjustments?: React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["saleGlobalAdjustments"];
  articleStockBreakdown?: React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["articleStockBreakdown"];
  pickedItemsByLineId?:   React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["pickedItemsByLineId"];

  // ── Lista/canal/almacén del documento ──────────────────────────────────
  currentPriceListId?:   string;
  currentPriceListLabel?: string;
  currentChannelId?:     string;
  currentChannelLabel?:  string;
  currentWarehouseId?:   string;

  // ── Expansión por línea ────────────────────────────────────────────────
  expandedLineIds:        Set<string>;
  advancedOpenLineIds:    Set<string>;
  onToggleExpand:         (lineId: string) => void;
  onToggleAdvancedOpen:   (lineId: string) => void;

  // ── Mutaciones de líneas ───────────────────────────────────────────────
  patchLine:        (lineId: string, p: Partial<DocumentLine>) => void;
  removeLine:       (lineId: string) => void;
  duplicateLine:    (lineId: string) => void;
  reorderLines:     (fromId: string, toId: string) => void;
  resetLine:        (lineId: string) => void;
  isReorderable:    (line: DocumentLine, idx: number) => boolean;
  /** Click en empty state → agregar línea vacía. */
  onAddLine:        () => void;

  // ── Overrides de línea ─────────────────────────────────────────────────
  setLineTaxOverride:   React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["onSetLineTaxOverride"];
  applyLineOverrides:   React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["onApplyLineOverrides"];
  clearLineOverrides:   React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["onClearLineOverrides"];

  // ── Lista por línea / canal / cambio de header ─────────────────────────
  onChangePriceList:      (id: string | null) => void;
  onChangeLinePriceList:  (lineId: string, priceListId: string | null) => void;
  onChangeChannel:        (id: string | null) => void;

  // ── Artículos ──────────────────────────────────────────────────────────
  handleEditArticle:        (articleId: string) => void;
  handleLineArticlePick:    React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["onArticlePicked"];
  handleCreateManualLine:   React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["onCreateManualLine"];
  searchArticles:           React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["articleSearch"];
  exactLookupArticle:       React.ComponentProps<typeof TPDocumentLineAdvancedEditor>["articleExactLookup"];

  // ── Foco y flujo ───────────────────────────────────────────────────────
  focusedLineId:    string | null;
  focusSignal:      number;
  editorScopeRef:   React.RefObject<HTMLDivElement | null>;

  // ── Preview status (para feedback "Recalculando…") ─────────────────────
  previewLoading:   boolean;
};

export function LinesEditorSection(props: LinesEditorSectionProps): React.ReactElement {
  const {
    lines, totalLinesInDraft,
    currency, displayRate, viewMode, headerSubtotals,
    priceLists, channels, warehouses, unitNameByCode, currencyById, saleGlobalAdjustments,
    articleStockBreakdown, pickedItemsByLineId,
    currentPriceListId, currentPriceListLabel, currentChannelId, currentChannelLabel, currentWarehouseId,
    expandedLineIds, advancedOpenLineIds, onToggleExpand, onToggleAdvancedOpen,
    patchLine, removeLine, duplicateLine, reorderLines, resetLine, isReorderable, onAddLine,
    setLineTaxOverride, applyLineOverrides, clearLineOverrides,
    onChangePriceList, onChangeLinePriceList, onChangeChannel,
    handleEditArticle, handleLineArticlePick, handleCreateManualLine,
    searchArticles, exactLookupArticle,
    focusedLineId, focusSignal, editorScopeRef, previewLoading,
  } = props;

  return (
    <div ref={editorScopeRef}>
      {totalLinesInDraft === 0 ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Agregar línea vacía"
          onClick={onAddLine}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAddLine();
            }
          }}
          className={cn(
            "cursor-pointer rounded-lg border border-dashed border-border bg-surface2/20 px-4 py-8 text-center transition",
            "hover:bg-surface2/40 hover:border-primary/40",
            "focus:outline-none focus-visible:border-primary/60 focus-visible:bg-surface2/40",
          )}
        >
          <FileText size={24} className="mx-auto text-muted" />
          <div className="mt-2 text-sm font-semibold text-text">
            Todavía no hay líneas
          </div>
          <div className="mt-1 text-xs text-muted">
            Buscá arriba un artículo o hacé click acá para agregar una línea vacía.
          </div>
        </div>
      ) : (
        <TPDocumentLineAdvancedEditor
          lines={lines}
          currency={currency}
          displayRate={displayRate}
          showLineTotalWithTax
          updateLine={patchLine}
          removeLine={removeLine}
          duplicateLine={duplicateLine}
          priceListId={currentPriceListId}
          priceListName={currentPriceListId ? currentPriceListLabel : undefined}
          priceListOptions={priceLists}
          channelId={currentChannelId}
          channelName={currentChannelId ? currentChannelLabel : undefined}
          channelOptions={channels}
          onChangePriceList={onChangePriceList}
          onChangeLinePriceList={onChangeLinePriceList}
          onChangeChannel={onChangeChannel}
          warehouseId={currentWarehouseId || undefined}
          reorderLines={reorderLines}
          isReorderable={isReorderable}
          expandedIds={expandedLineIds}
          onToggleExpand={onToggleExpand}
          advancedOpenIds={advancedOpenLineIds}
          onToggleAdvancedOpen={onToggleAdvancedOpen}
          onEditArticle={handleEditArticle}
          onResetLine={resetLine}
          viewMode={viewMode}
          headerSubtotals={headerSubtotals}
          onArticlePicked={handleLineArticlePick}
          onCreateManualLine={handleCreateManualLine}
          focusedLineId={focusedLineId}
          focusSignal={focusSignal}
          articleSearch={searchArticles}
          pickedItemsByLineId={pickedItemsByLineId}
          articleExactLookup={exactLookupArticle}
          onArticleNoExactMatch={(q) => {
            toast.warning(`No se encontró código exacto: "${q}". Buscá manualmente y elegí de la lista.`);
          }}
          onArticleMultipleExactMatches={(q, matches) => {
            toast.warning(
              `Se encontraron ${matches.length} ítems con el código "${q}". Elegí uno desde la lista.`,
            );
          }}
          warehouses={warehouses}
          articleStockBreakdown={articleStockBreakdown}
          onSetLineTaxOverride={setLineTaxOverride}
          onApplyLineOverrides={applyLineOverrides}
          onClearLineOverrides={clearLineOverrides}
          compositionView="sale"
          unitNameByCode={unitNameByCode}
          currencyById={currencyById}
          saleGlobalAdjustments={saleGlobalAdjustments}
          // FASE 12.8 — `renderLineExtras` removido: ya no rendea
          // `<SaleLinePricingPanel>` debajo de cada línea expandida. La
          // composición del costo (componentes, costo unit, merma/ajuste,
          // costo total, margen, costo de venta) ya vive consolidada en la
          // `SaleCompositionEditableGrid` interna del editor avanzado.
          // Fase 4.3 — feedback de "Recalculando" en el header de
          // la grilla de composición durante un preview en vuelo.
          saleCompositionLoading={previewLoading}
        />
      )}
    </div>
  );
}

export default LinesEditorSection;
