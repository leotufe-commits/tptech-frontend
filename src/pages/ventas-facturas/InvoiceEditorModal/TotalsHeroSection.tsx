// src/pages/ventas-facturas/InvoiceEditorModal/TotalsHeroSection.tsx
// ============================================================================
// Sección "Total a facturar" del aside derecho del modal de Factura.
//
// Wrapper trivial sobre `TPDocumentTotalsHero`:
//   - composition: passthrough de `pricingDetail` (computado en el padre).
//   - indicador discreto durante el PRIMER fetch (loading sin response previo).
//
// Read-only — el componente NO recalcula valores. Toda la matemática del
// `composition` vive en el motor backend.
//
// Extraído de VentasFacturas.tsx durante FASE 8.2.2.
// ============================================================================

import React from "react";
import { AlertTriangle } from "lucide-react";
import TPDocumentTotalsHero from "../../../components/ui/TPDocumentTotalsHero";
import { TPTechPricingLoader } from "../../../components/ui/TPTechPricingLoader";

/** Status del fetch de preview. Solo el caller lo conoce; acá solo decide
 *  visibilidad del loader. Tipo "string" amplio para no acoplarse al enum
 *  específico del caller — solo nos importa el discriminante "loading". */
export type TotalsHeroPreviewStatus = string;

export type TotalsHeroSectionProps = {
  /** Composición pricing completa — passthrough al hero. Computada por el
   *  padre (`pricingDetail`). */
  composition: React.ComponentProps<typeof TPDocumentTotalsHero>["composition"];
  /** Símbolo de moneda actual. */
  currency: string;
  /** Tasa de display (moneda extranjera × rate). */
  displayRate: number;
  /** Modo de vista: "unified" | "detailed". */
  viewMode: React.ComponentProps<typeof TPDocumentTotalsHero>["viewMode"];
  /** Setter del modo. */
  onViewModeChange: React.ComponentProps<typeof TPDocumentTotalsHero>["onViewModeChange"];
  /** Etiqueta del total. Default "Total a facturar". */
  totalLabel?: string;
  /** Estado del fetch. Cuando es "loading" y `hasResponse=false`, muestra
   *  loader esquina superior derecha. */
  previewStatus: TotalsHeroPreviewStatus;
  /** ¿Hay respuesta previa? Cuando false + loading, mostramos loader; cuando
   *  true + loading, el hero ya atenúa internamente. */
  hasResponse: boolean;
  /** FASE 9 — I1: cuando el último preview falló y todavía mostramos la
   *  respuesta anterior cacheada, marcamos los totales como potencialmente
   *  desactualizados. Discreto: chip de advertencia en la esquina superior
   *  derecha. NO bloquea edición. */
  previewStale?: boolean;
};

export function TotalsHeroSection(props: TotalsHeroSectionProps): React.ReactElement {
  const {
    composition, currency, displayRate, viewMode, onViewModeChange,
    totalLabel = "Total a facturar", previewStatus, hasResponse,
    previewStale = false,
  } = props;
  return (
    <div className="relative">
      <TPDocumentTotalsHero
        composition={composition}
        currency={currency}
        displayRate={displayRate}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        totalLabel={totalLabel}
      />
      {previewStatus === "loading" && !hasResponse && (
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <TPTechPricingLoader active label="Calculando totales…" />
        </div>
      )}
      {/* FASE 9 — I1: chip discreto cuando el último preview falló. Si está
          loading-tras-error, esperamos al próximo resultado antes de quitar
          el chip — `previewStale` lo decide el caller. */}
      {previewStale && (
        <div
          role="status"
          aria-label="Totales potencialmente desactualizados"
          data-testid="totals-stale-chip"
          className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500"
        >
          <AlertTriangle size={11} />
          <span>Totales sin actualizar</span>
        </div>
      )}
    </div>
  );
}

export default TotalsHeroSection;
