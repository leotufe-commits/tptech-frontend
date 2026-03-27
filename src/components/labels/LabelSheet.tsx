// src/components/labels/LabelSheet.tsx
// Renderiza múltiples páginas de etiquetas distribuidas en grilla (columnas × filas).
// Usa LabelRenderer para cada etiqueta individual.
// Sirve para preview en pantalla (con scale) y como base para impresión.
import React from "react";

import { mmToPx }             from "../../utils/units";
import LabelRenderer          from "./LabelRenderer";
import type { LabelItemData } from "../../utils/labelResolver";
import type { LabelPage }     from "../../utils/labelLayout";
import type { LabelTemplateRow } from "../../services/label-templates";

// ─── Props ────────────────────────────────────────────────────────────────────

type LabelSheetProps = {
  template:   LabelTemplateRow;
  /** Array de páginas. Cada página = array de filas. Cada fila = array de items. */
  pages:      LabelPage[];
  columns:    number;
  /** Gap horizontal entre etiquetas, en mm. */
  gapXMm?:   number;
  /** Gap vertical entre etiquetas, en mm. */
  gapYMm?:   number;
  /** Offset horizontal desde el borde de la hoja, en mm. */
  offsetXMm?: number;
  /** Offset vertical desde el borde de la hoja, en mm. */
  offsetYMm?: number;
  /** DPI de conversión. 96 para pantalla, 203 para térmicas. */
  dpi?:       number;
  /** Factor de escala adicional para preview reducido. */
  scale?:     number;
  /** Muestra bordes de debug en cada etiqueta y página. */
  debug?:     boolean;
  /** Clase CSS extra en cada .label-page */
  pageClassName?: string;
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function LabelSheet({
  template,
  pages,
  columns,
  gapXMm   = 0,
  gapYMm   = 0,
  offsetXMm = 0,
  offsetYMm = 0,
  dpi      = 96,
  scale    = 1,
  debug    = false,
  pageClassName = "",
}: LabelSheetProps) {
  const px = (mm: number) => mmToPx(mm, dpi) * scale;

  const labelWpx = px(parseFloat(template.widthMm));
  const labelHpx = px(parseFloat(template.heightMm));
  const gapXpx   = px(gapXMm);
  const gapYpx   = px(gapYMm);
  const offXpx   = px(offsetXMm);
  const offYpx   = px(offsetYMm);

  return (
    <>
      {pages.map((page, pageIdx) => {
        const rowCount = page.length;

        // Dimensiones de la hoja para esta página
        // Ancho: offset + N cols × (label + gap) − último gap
        // Alto:  offset + N rows × (label + gap) − último gap
        const pageWpx = offXpx + columns * (labelWpx + gapXpx) - gapXpx;
        const pageHpx = offYpx + rowCount  * (labelHpx + gapYpx) - gapYpx;

        return (
          <div
            key={pageIdx}
            className={`label-page ${pageClassName}`}
            style={{
              position:    "relative",
              width:       pageWpx,
              height:      pageHpx,
              background:  debug ? "#eef2ff" : "white",
              marginBottom: 12,
              flexShrink:  0,
            }}
          >
            {page.map((row, rowIdx) =>
              row.map((item, colIdx) => {
                const left = offXpx + colIdx * (labelWpx + gapXpx);
                const top  = offYpx + rowIdx * (labelHpx + gapYpx);

                return (
                  <div
                    key={`${pageIdx}-${rowIdx}-${colIdx}`}
                    style={{ position: "absolute", left, top }}
                  >
                    <LabelRenderer
                      template={template}
                      item={item}
                      dpi={dpi}
                      scale={scale}
                      debug={debug}
                    />
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </>
  );
}
