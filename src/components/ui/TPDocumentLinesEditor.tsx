// src/components/ui/TPDocumentLinesEditor.tsx
// ============================================================================
// TPDocumentLinesEditor — grid editable de líneas comerciales (presupuestos,
// órdenes, facturas).
//
// Fase 6 — sin uso confirmado: ningún archivo del proyecto lo importa
// (verificado con grep). Se mantiene el archivo por si alguna pantalla de
// presupuestos/órdenes vuelve a usarlo. Candidato a borrado en Fase 7
// si el equipo confirma que no lo va a reusar.
//
// Primera iteración de Fase C para líneas comerciales. Se extrae la versión
// duplicada entre VentasPresupuestos (`QuoteLinesEditor`) y VentasOrdenes
// (`OrderLinesEditor`). Ambas eran idénticas salvo por el label de la primera
// columna ("Artículo / Combo" en presupuestos vs "Artículo" en órdenes).
//
// Usa el tipo canónico `DocumentLine` de `document-types.ts` con los campos
// `article / variant / quantity / unitPrice / discountAmount / subtotal`. El
// subtotal sigue siendo calculado por el parent en `calcLineSubtotal` +
// `recomputeTotals` (el editor solo lo muestra).
//
// Alcance intencional:
//   · Renderiza SOLO el grid (encabezados + filas con botón de eliminar).
//   · El empty state y el botón "Agregar línea" quedan en la `TPCard` del
//     parent — moverlos adentro cambiaría la UI y la consigna de Fase C es
//     "UI idéntica".
//   · No maneja `taxAmount` / `lineTotal` (opcionales en `DocumentLine`) —
//     los usarán pantallas de facturación en una iteración posterior.
// ============================================================================

import React from "react";
import { Trash2 } from "lucide-react";

import { TPIconButton } from "./TPIconButton";
import TPInput from "./TPInput";
import TPNumberInput from "./TPNumberInput";

import { type DocumentLine } from "../../lib/document-types";
import { fmtMoney } from "../../lib/document-helpers";

const LINES_GRID =
  "grid grid-cols-[1.2fr_1fr_90px_120px_110px_130px_32px] gap-2 items-center";

export type TPDocumentLinesEditorProps = {
  lines: DocumentLine[];
  /** Moneda del documento padre — se usa para formatear el subtotal por línea. */
  currency: string;
  updateLine: (id: string, patch: Partial<DocumentLine>) => void;
  removeLine: (id: string) => void;
  /**
   * Label de la primera columna. VentasPresupuestos usa "Artículo / Combo"
   * porque admite combos; VentasOrdenes (y el resto) usan "Artículo".
   * Default: "Artículo".
   */
  articleColumnLabel?: string;
  /** Placeholder del input de artículo. Default: "Artículo o combo". */
  articlePlaceholder?: string;
};

export function TPDocumentLinesEditor({
  lines,
  currency,
  updateLine,
  removeLine,
  articleColumnLabel = "Artículo",
  articlePlaceholder = "Artículo o combo",
}: TPDocumentLinesEditorProps) {
  return (
    <div className="space-y-2">
      <div className={`${LINES_GRID} px-1 text-[11px] font-medium uppercase tracking-wide text-muted`}>
        <div>{articleColumnLabel}</div>
        <div>Variante</div>
        <div className="text-right">Cantidad</div>
        <div className="text-right">Precio unit.</div>
        <div className="text-right">Descuento</div>
        <div className="text-right">Subtotal</div>
        <div />
      </div>

      {lines.map((l) => (
        <div key={l.id} className={LINES_GRID}>
          <TPInput
            value={l.article}
            onChange={(v: string) => updateLine(l.id, { article: v })}
            placeholder={articlePlaceholder}
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
          <div className="text-right tabular-nums font-semibold text-text pr-2">
            {fmtMoney(l.subtotal, currency)}
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

export default TPDocumentLinesEditor;
