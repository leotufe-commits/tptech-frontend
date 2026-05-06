// src/components/ui/TPInvoiceLinesEditor.tsx
// ============================================================================
// TPInvoiceLinesEditor — grid editable de líneas de facturas (compra y venta).
//
// Extracción del `InvoiceLinesEditor` duplicado entre VentasFacturas y
// ComprasFacturasProveedor. Las dos versiones eran casi idénticas; difieren en:
//
//   · Label de la columna de precio:
//       · Ventas  → "Precio unit."
//       · Compras → "Costo unit."
//   · Columna de impuesto:
//       · Ventas  → label "IVA %", NO editable (muestra "—" porque el IVA se
//                   calcula a nivel documento con `taxPercent`)
//       · Compras → label "Impuesto", editable vía `taxAmount` por línea
//
// Usa el tipo canónico `DocumentLine` de `document-types.ts`. Los parents
// siguen encargándose de calcular `lineTotal` y `subtotal` en sus helpers
// (`calcLineTotal` + `recomputeTotals`); el editor solo muestra.
//
// Alcance intencional:
//   · Renderiza SOLO el grid (encabezados + filas + botón de eliminar).
//   · El empty state y el botón "Agregar línea" quedan en la `TPCard` del
//     parent — moverlos adentro cambiaría la UI.
// ============================================================================

import React from "react";
import { Trash2 } from "lucide-react";

import { TPIconButton } from "./TPIconButton";
import TPInput from "./TPInput";
import TPNumberInput from "./TPNumberInput";

import { type DocumentLine } from "../../lib/document-types";
import { fmtMoney } from "../../lib/document-helpers";

const LINES_GRID =
  "grid grid-cols-[1.2fr_1fr_90px_110px_100px_100px_120px_32px] gap-2 items-center";

export type TPInvoiceLinesEditorProps = {
  lines: DocumentLine[];
  /** Moneda del documento padre — se usa para formatear el total por línea. */
  currency: string;
  updateLine: (id: string, patch: Partial<DocumentLine>) => void;
  removeLine: (id: string) => void;
  /** Label de la columna de precio. Default: "Precio unit.". */
  priceColumnLabel?: string;
  /** Label de la columna de impuesto. Default: "Impuesto". */
  taxColumnLabel?: string;
  /**
   * Si true (default), la columna de impuesto es un TPNumberInput que edita
   * `taxAmount`. Si false, se muestra "—" (útil cuando el IVA se calcula a
   * nivel documento y no por línea — caso VentasFacturas).
   */
  taxEditable?: boolean;
};

export function TPInvoiceLinesEditor({
  lines,
  currency,
  updateLine,
  removeLine,
  priceColumnLabel = "Precio unit.",
  taxColumnLabel = "Impuesto",
  taxEditable = true,
}: TPInvoiceLinesEditorProps) {
  return (
    <div className="space-y-2">
      <div className={`${LINES_GRID} px-1 text-[11px] font-medium uppercase tracking-wide text-muted`}>
        <div>Artículo</div>
        <div>Variante</div>
        <div className="text-right">Cantidad</div>
        <div className="text-right">{priceColumnLabel}</div>
        <div className="text-right">Descuento</div>
        <div className="text-right">{taxColumnLabel}</div>
        <div className="text-right">Total línea</div>
        <div />
      </div>

      {lines.map((l) => (
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
            value={l.quantity}
            onChange={(v) => updateLine(l.id, { quantity: v ?? 0 })}
            decimals={2}
            min={0}
          />
          <TPNumberInput
            value={l.unitPrice}
            onChange={(v) => updateLine(l.id, { unitPrice: v ?? 0 })}
            decimals={2}
            min={0}
          />
          <TPNumberInput
            value={l.discountAmount}
            onChange={(v) => updateLine(l.id, { discountAmount: v ?? 0 })}
            decimals={2}
            min={0}
          />
          {taxEditable ? (
            <TPNumberInput
              value={l.taxAmount ?? 0}
              onChange={(v) => updateLine(l.id, { taxAmount: v ?? 0 })}
              decimals={2}
              min={0}
            />
          ) : (
            <div className="text-right text-[11px] text-muted pr-2 tabular-nums">—</div>
          )}
          <div className="text-right tabular-nums font-semibold text-text pr-2">
            {fmtMoney(l.lineTotal ?? 0, currency)}
          </div>
          <TPIconButton
            onClick={() => removeLine(l.id)}
            className="h-8 w-8 hover:text-red-400 hover:border-red-400/40"
            title="Eliminar línea"
          >
            <Trash2 size={14} />
          </TPIconButton>
        </div>
      ))}
    </div>
  );
}

export default TPInvoiceLinesEditor;
