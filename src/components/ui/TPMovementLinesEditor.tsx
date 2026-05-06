// src/components/ui/TPMovementLinesEditor.tsx
// ============================================================================
// TPMovementLinesEditor — grid editable de líneas de movimiento.
//
// Extracción del `LinesEditor` que estaba duplicado literalmente en
// ComprasRecepciones (dirección IN) y VentasEntregas (dirección OUT). Los dos
// tenían estructura idéntica y solo diferían en:
//   · nombres de campo (alreadyReceivedQty/receivingQty vs alreadyDeliveredQty/
//     deliveringQty)
//   · labels de dos columnas ("Ya recibido / A recibir" vs "Ya entregado / A
//     entregar")
//
// Ahora ambos dominios comparten el tipo canónico `MovementLine` (con campos
// `alreadyMovedQty` / `movingQty`) y este componente renderiza el grid
// adaptando los textos según la prop `direction: "IN" | "OUT"`.
//
// Alcance intencional:
//   · Renderiza SOLO el grid (encabezados + filas + aviso inline "⚠ excede
//     el pendiente" + hint inline "Pendiente antes / Quedará pendiente").
//   · El empty state y el botón "Agregar línea" quedan en la `TPCard` del
//     parent — moverlos adentro cambiaría la UI y la consigna de Fase C es
//     "UI idéntica".
//   · Incluye el cómputo y badge de estado por línea (PENDING/PARTIAL/
//     COMPLETE/OVER) — esa lógica era idéntica en ambas pantallas y no tiene
//     sentido mantenerla afuera del editor.
// ============================================================================

import React from "react";
import { Trash2 } from "lucide-react";

import { TPBadge } from "./TPBadges";
import { TPIconButton } from "./TPIconButton";
import TPInput from "./TPInput";
import TPNumberInput from "./TPNumberInput";

import {
  type MovementLine,
  type MovementDirection,
} from "../../lib/document-types";
import { fmtQty } from "../../lib/document-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Estado visual por línea (derivado de ordered / alreadyMoved / moving)
// ─────────────────────────────────────────────────────────────────────────────

type LineStatus = "PENDING" | "PARTIAL" | "COMPLETE" | "OVER";

function lineStatus(l: MovementLine): LineStatus {
  const after = l.alreadyMovedQty + l.movingQty;
  if (l.orderedQty <= 0) return after > 0 ? "COMPLETE" : "PENDING";
  if (after > l.orderedQty) return "OVER";
  if (after === l.orderedQty) return "COMPLETE";
  if (after > 0) return "PARTIAL";
  return "PENDING";
}

function lineStatusBadge(s: LineStatus) {
  switch (s) {
    case "COMPLETE": return <TPBadge tone="success" size="sm">Completa</TPBadge>;
    case "PARTIAL":  return <TPBadge tone="warning" size="sm">Parcial</TPBadge>;
    case "OVER":     return <TPBadge tone="danger"  size="sm">Excede pedido</TPBadge>;
    case "PENDING":  return <TPBadge tone="neutral" size="sm">Pendiente</TPBadge>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid
// ─────────────────────────────────────────────────────────────────────────────

const LINES_GRID =
  "grid grid-cols-[1fr_120px_90px_100px_100px_110px_32px] gap-2 items-center";

export type TPMovementLinesEditorProps = {
  lines: MovementLine[];
  /** IN → recepción de compra; OUT → entrega/remito de venta. */
  direction: MovementDirection;
  updateLine: (id: string, patch: Partial<MovementLine>) => void;
  removeLine: (id: string) => void;
};

export function TPMovementLinesEditor({
  lines,
  direction,
  updateLine,
  removeLine,
}: TPMovementLinesEditorProps) {
  const labelAlreadyMoved = direction === "IN" ? "Ya recibido" : "Ya entregado";
  const labelMoving       = direction === "IN" ? "A recibir"   : "A entregar";

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className={`${LINES_GRID} px-1 text-[11px] font-medium uppercase tracking-wide text-muted`}>
        <div>Artículo</div>
        <div>Variante</div>
        <div className="text-right">Pedido</div>
        <div className="text-right">{labelAlreadyMoved}</div>
        <div className="text-right">{labelMoving}</div>
        <div className="text-center">Estado</div>
        <div />
      </div>

      {lines.map((l) => {
        const pending = Math.max(0, l.orderedQty - l.alreadyMovedQty);
        const stat    = lineStatus(l);
        const overMax = l.orderedQty > 0 && l.movingQty > pending;

        return (
          <div key={l.id} className={LINES_GRID}>
            <TPInput
              value={l.article}
              onChange={(v: string) => updateLine(l.id, { article: v })}
              placeholder="Artículo / descripción"
            />
            <TPInput
              value={l.variant}
              onChange={(v: string) => updateLine(l.id, { variant: v })}
              placeholder="Variante (opc.)"
            />
            <TPNumberInput
              value={l.orderedQty}
              onChange={(v) => updateLine(l.id, { orderedQty: v ?? 0 })}
              decimals={2}
              min={0}
            />
            <TPNumberInput
              value={l.alreadyMovedQty}
              onChange={(v) => updateLine(l.id, { alreadyMovedQty: v ?? 0 })}
              decimals={2}
              min={0}
            />
            <TPNumberInput
              value={l.movingQty}
              onChange={(v) => updateLine(l.id, { movingQty: v ?? 0 })}
              decimals={2}
              min={0}
            />
            <div className="flex justify-center">
              {lineStatusBadge(stat)}
            </div>
            <TPIconButton
              onClick={() => removeLine(l.id)}
              className="h-8 w-8 hover:text-red-400 hover:border-red-400/40"
              title="Eliminar línea"
            >
              <Trash2 size={14} />
            </TPIconButton>

            {/* Hint inline por línea: pendiente antes/después */}
            {(l.orderedQty > 0 || l.movingQty > 0 || l.alreadyMovedQty > 0) && (
              <div className="col-span-7 -mt-1 pl-1 text-[10px] text-muted tabular-nums">
                Pendiente antes: {fmtQty(pending)} · Quedará pendiente: {fmtQty(Math.max(0, pending - l.movingQty))}
                {overMax && (
                  <span className="ml-2 text-red-400">
                    · ⚠ La cantidad excede el pendiente
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TPMovementLinesEditor;
