// src/components/ui/TPDocumentTimeline.tsx
// ============================================================================
// TPDocumentTimeline — timeline vertical de documentos derivados.
//
// Pensado para mostrar, dentro de una fila expandida de `TPTableKit`, los
// documentos que derivan del registro padre (una OV → remitos + facturas;
// una factura → cobros + notas de crédito; etc.). Cada item se renderiza
// como una fila con:
//
//   · círculo (dot) sobre la línea vertical que conecta todos los items
//   · chip del tipo opcional ("REM", "FV", "COB", "NC", …)
//   · número mono del documento
//   · cantidad (unidades) y/o monto formateado
//   · fecha
//   · badge de estado (usa `TPStatusBadge`, acepta status canónico o string
//     con override de label/tone)
//
// Componente 100% de presentación — la navegación al documento destino
// quedará para cuando la pantalla de detalle exista (no se implementa aún).
// ============================================================================

import React from "react";

import { cn } from "./tp";
import { TPStatusBadge } from "./TPStatusBadge";
import type { DocumentStatus, DocumentTone } from "../../lib/document-types";
import { fmtDate, fmtMoney } from "../../lib/document-helpers";

export type TPDocumentTimelineItem = {
  id: string;
  /** Prefijo del tipo de doc (ej: "REM", "FV", "COB"). Opcional — si se omite no se muestra el chip. */
  type?: string;
  /** Número completo del documento (ej: "REM-0003"). */
  number: string;
  /** Fecha ISO yyyy-mm-dd. */
  date: string;
  /** Cantidad opcional en unidades (ej. remitos, devoluciones). */
  quantity?: number;
  /** Monto opcional (ej. facturas, cobros). */
  amount?: number;
  /** Moneda para formatear el monto. */
  currency?: string;
  /** Estado del documento — acepta canónico o string arbitrario. */
  status: DocumentStatus | string;
  /** Override opcional del label del badge. */
  statusLabel?: string;
  /** Override opcional del tone del badge. */
  statusTone?: DocumentTone;
};

export type TPDocumentTimelineProps = {
  items: TPDocumentTimelineItem[];
  emptyText?: string;
  title?: string;
  className?: string;
};

export function TPDocumentTimeline({
  items,
  emptyText = "Sin documentos derivados todavía.",
  title,
  className,
}: TPDocumentTimelineProps) {
  if (items.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        {title && (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {title}
          </div>
        )}
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {title && (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {title}
        </div>
      )}
      <ol className="relative space-y-3 pl-5">
        {/* Línea vertical de la timeline */}
        <span
          className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
          aria-hidden
        />
        {items.map((it) => (
          <li key={it.id} className="relative flex items-center gap-3">
            {/* Dot sobre la línea */}
            <span
              className="absolute -left-[1.125rem] top-1.5 h-3 w-3 rounded-full border-2 border-border bg-card"
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {it.type && (
                <span className="inline-flex items-center rounded bg-surface2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                  {it.type}
                </span>
              )}
              <span className="font-mono font-semibold text-text">{it.number}</span>
              {typeof it.quantity === "number" && (
                <span className="text-muted">
                  · {it.quantity} {it.quantity === 1 ? "u" : "u"}
                </span>
              )}
              {typeof it.amount === "number" && (
                <span className="text-muted">· {fmtMoney(it.amount, it.currency)}</span>
              )}
              <span className="text-muted">· {fmtDate(it.date)}</span>
            </div>
            <TPStatusBadge
              status={it.status}
              label={it.statusLabel}
              tone={it.statusTone}
              size="sm"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

export default TPDocumentTimeline;
