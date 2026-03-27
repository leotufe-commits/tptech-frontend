// src/components/labels/BarcodeElement.tsx
// Renderiza un código de barras real usando JsBarcode sobre un <svg>.
// Reutilizable en LabelRenderer (preview/editor) y en impresión.
import React, { useRef, useEffect, CSSProperties } from "react";
import JsBarcode from "jsbarcode";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type BarcodeFormat =
  | "CODE128"
  | "CODE128A"
  | "CODE128B"
  | "CODE128C"
  | "EAN13"
  | "EAN8"
  | "UPC"
  | "CODE39"
  | "ITF14"
  | "MSI"
  | "pharmacode"
  | "codabar";

export type BarcodeElementProps = {
  /** Valor a codificar. Si está vacío se muestra un placeholder. */
  value:          string;
  /** Formato JsBarcode. Default CODE128. */
  format?:        BarcodeFormat;
  /** Ancho total del contenedor en px. */
  containerWpx:   number;
  /** Alto total del contenedor en px. */
  containerHpx:   number;
  /** Mostrar texto bajo las barras. Default true. */
  displayValue?:  boolean;
  /** Tamaño de fuente del texto inferior en px. */
  fontSize?:      number;
  /** Modo editor: muestra un placeholder si value está vacío. */
  editorMode?:    boolean;
  className?:     string;
  style?:         CSSProperties;
  debug?:         boolean;
};

// ─── Mínimos para evitar render ilegible ─────────────────────────────────────

const MIN_W = 30;
const MIN_H = 12;

// ─── Componente ──────────────────────────────────────────────────────────────

export default function BarcodeElement({
  value,
  format        = "CODE128",
  containerWpx,
  containerHpx,
  displayValue  = true,
  fontSize      = 8,
  editorMode    = false,
  className,
  style,
  debug         = false,
}: BarcodeElementProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const wpx = Math.max(containerWpx, MIN_W);
  const hpx = Math.max(containerHpx, MIN_H);

  // Alto reservado para texto inferior: ~1.4 × fontSize px
  const textReserve = displayValue ? Math.ceil(fontSize * 1.4) : 0;
  const barsH       = Math.max(hpx - textReserve - 2, MIN_H);

  useEffect(() => {
    if (!svgRef.current) return;

    const v = value?.trim();
    if (!v) {
      // Sin valor: limpiar SVG
      svgRef.current.innerHTML = "";
      return;
    }

    try {
      JsBarcode(svgRef.current, v, {
        format,
        width:        1,           // ancho de barra unitaria; el SVG se escala via CSS
        height:       barsH,
        displayValue,
        fontSize,
        margin:       0,
        background:   "#ffffff",
        lineColor:    "#000000",
        textMargin:   2,
        font:         "Arial",
      });
    } catch {
      // Valor inválido para el formato (ej. EAN13 con longitud incorrecta)
      if (svgRef.current) svgRef.current.innerHTML = "";
    }
  }, [value, format, barsH, displayValue, fontSize]);

  const showPlaceholder = !value?.trim();

  return (
    <div
      className={className}
      style={{
        width:          "100%",
        height:         "100%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        overflow:       "hidden",
        outline:        debug ? "1px dashed #10b981" : undefined,
        ...style,
      }}
    >
      {showPlaceholder ? (
        /* Placeholder solo en modo editor cuando no hay valor */
        editorMode ? (
          <div
            style={{
              width:          "90%",
              height:         "80%",
              background:     "repeating-linear-gradient(90deg,#bbb 0,#bbb 2px,#fff 2px,#fff 5px)",
              opacity:        0.5,
              display:        "flex",
              alignItems:     "flex-end",
              justifyContent: "center",
              paddingBottom:  2,
            }}
          >
            <span style={{ fontSize: Math.max(fontSize * 0.8, 6), color: "#666", fontFamily: "monospace" }}>
              BARCODE
            </span>
          </div>
        ) : null
      ) : (
        <svg
          ref={svgRef}
          style={{
            maxWidth:  "100%",
            maxHeight: "100%",
            display:   "block",
          }}
        />
      )}
    </div>
  );
}
