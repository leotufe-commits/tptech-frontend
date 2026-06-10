// src/components/sales/TotalDelComprobanteCard/index.ts
// =============================================================================
// Etapa B — Barrel del card maestro "Total del comprobante".
// =============================================================================

export {
  TotalDelComprobanteCard,
  default,
} from "./TotalDelComprobanteCard";
export type {
  TotalDelComprobanteCardProps,
  BalanceMode,
} from "./types";

// Trazabilidad reutilizable (footer, auditorías, PDFs, cuenta corriente,
// reportes). El builder es PURO — proyecta el preview a `ComponentTrace`.
export {
  buildComponentTraces,
  aggregateTaxItemsFromLines,
  aggregatePromotionsFromLines,
} from "./traceability";
export type {
  ComponentTrace,
  TraceRule,
  TraceSourceType,
  BuildComponentTracesInput,
} from "./traceability";
