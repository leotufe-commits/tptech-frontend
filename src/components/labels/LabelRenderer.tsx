// src/components/labels/LabelRenderer.tsx
// Renderiza una etiqueta individual a partir de una plantilla y datos de artículo.
// Usa posicionamiento absoluto en px convertidos desde mm.
// Válido tanto para preview en pantalla como referencia visual del layout.
import React, { CSSProperties } from "react";

import { mmToPx }              from "../../utils/units";
import { resolveField }        from "../../utils/labelResolver";
import type { LabelItemData }  from "../../utils/labelResolver";
import type {
  LabelTemplateRow,
  LabelElementRow,
  LabelElementType,
} from "../../services/label-templates";
import BarcodeElement          from "./BarcodeElement";

// ─── Props ────────────────────────────────────────────────────────────────────

type LabelRendererProps = {
  template: LabelTemplateRow;
  item:     LabelItemData;
  /** DPI para conversión mm→px. Default 96 (pantalla). */
  dpi?:     number;
  /** Factor de escala adicional para miniaturas. Default 1. */
  scale?:   number;
  /** Muestra bordes punteados en cada elemento. */
  debug?:   boolean;
};

// ─── Helpers de elemento ─────────────────────────────────────────────────────

function parseConfig(configJson: string): Record<string, unknown> {
  try { return JSON.parse(configJson || "{}"); } catch { return {}; }
}

function parseNum(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v);
}

// ─── Sub-renderers por tipo ───────────────────────────────────────────────────

type ElemProps = {
  el:    LabelElementRow;
  item:  LabelItemData;
  wpx:   number; // ancho del elemento en px
  hpx:   number; // alto del elemento en px
  debug: boolean;
};

// -- TEXT -----------------------------------------------------------------------
function TextElement({ el, item, wpx, hpx, debug }: ElemProps) {
  const staticText = el.label || "";
  const value      = el.fieldKey === "static"
    ? staticText
    : (el.label ? el.label + resolveField(item, el.fieldKey) : resolveField(item, el.fieldKey));

  if (!value) return null; // autoHideIfEmpty

  const align   = (el.align || "left") as CSSProperties["textAlign"];
  const justify = el.align === "right" ? "flex-end" : el.align === "center" ? "center" : "flex-start";

  return (
    <div
      style={{
        width:       "100%",
        height:      "100%",
        display:     "flex",
        alignItems:  "center",
        justifyContent: justify,
        fontSize:    el.fontSize,
        fontWeight:  el.fontWeight as CSSProperties["fontWeight"],
        textAlign:   align,
        overflow:    "hidden",
        whiteSpace:  "nowrap",
        lineHeight:  1.2,
        outline:     debug ? "1px dashed #3b82f6" : undefined,
      }}
    >
      {value}
    </div>
  );
}

// -- LINE / SEPARATOR -----------------------------------------------------------
function LineElement({ hpx, debug }: Pick<ElemProps, "hpx" | "debug">) {
  return (
    <div
      style={{
        width:      "100%",
        height:     Math.max(hpx, 1),
        background: "#333",
        outline:    debug ? "1px dashed #ef4444" : undefined,
      }}
    />
  );
}

// -- BARCODE -------------------------------------------------------------------
function BarcodeElementWrapper({ el, item, wpx, hpx, debug }: ElemProps) {
  const value = resolveField(item, el.fieldKey);
  let cfg: Record<string, unknown> = {};
  try { cfg = JSON.parse(el.configJson || "{}"); } catch { /* ok */ }

  const format = (cfg["barcodeType"] as string) || "CODE128";
  const displayValue = cfg["displayValue"] !== false;

  return (
    <BarcodeElement
      value={value}
      format={format as any}
      containerWpx={wpx}
      containerHpx={hpx}
      displayValue={displayValue}
      fontSize={el.fontSize || 8}
      editorMode={true}
      debug={debug}
    />
  );
}

// -- QR (placeholder — QRCode real requeriría otra librería) -------------------
const QR_PATTERN = "repeating-linear-gradient(0deg, #111 0, #111 3px, transparent 3px, transparent 6px), repeating-linear-gradient(90deg, #111 0, #111 3px, transparent 3px, transparent 6px)";

function QRElement({ el, item, wpx, hpx, debug }: ElemProps) {
  const value = resolveField(item, el.fieldKey);
  const side  = Math.min(wpx, hpx) * 0.85;

  return (
    <div
      style={{
        width:   "100%",
        height:  "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: debug ? "1px dashed #8b5cf6" : undefined,
      }}
    >
      <div
        style={{
          width:      side,
          height:     side,
          background: QR_PATTERN,
          opacity:    value ? 1 : 0.25,
          border:     "1px solid #333",
        }}
      />
    </div>
  );
}

// -- IMAGE (placeholder) -------------------------------------------------------
function ImageElement({ el, item, wpx, hpx, debug }: ElemProps) {
  const cfg   = parseConfig(el.configJson);
  const src   = typeof cfg.src === "string" ? cfg.src : "";
  const value = src || resolveField(item, el.fieldKey);

  return (
    <div
      style={{
        width:   "100%",
        height:  "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        outline: debug ? "1px dashed #f59e0b" : undefined,
      }}
    >
      {value ? (
        <img src={value} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        <div
          style={{
            width: "100%", height: "100%",
            background: "#e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.max(el.fontSize * 0.8, 6),
            color: "#9ca3af",
          }}
        >
          IMG
        </div>
      )}
    </div>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

function ElementSwitch(props: ElemProps) {
  switch (props.el.type as LabelElementType) {
    case "TEXT":    return <TextElement    {...props} />;
    case "BARCODE": return <BarcodeElementWrapper {...props} />;
    case "QR":      return <QRElement      {...props} />;
    case "IMAGE":   return <ImageElement   {...props} />;
    case "LINE":    return <LineElement hpx={props.hpx} debug={props.debug} />;
    default:        return null;
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function LabelRenderer({
  template,
  item,
  dpi   = 96,
  scale = 1,
  debug = false,
}: LabelRendererProps) {
  const px = (mm: number | string) => mmToPx(parseNum(mm), dpi) * scale;

  const labelW = px(template.widthMm);
  const labelH = px(template.heightMm);

  const elements = template.elements.filter((el) => el.visible !== false);

  return (
    <div
      style={{
        position:  "relative",
        width:     labelW,
        height:    labelH,
        overflow:  "hidden",
        background: template.bgColor || "#ffffff",
        flexShrink: 0,
        outline:   debug ? "1px solid #6b7280" : undefined,
      }}
    >
      {elements.map((el) => {
        const elX = px(el.x);
        const elY = px(el.y);
        const elW = px(el.width);
        const elH = px(el.height);

        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left:     elX,
              top:      elY,
              width:    elW,
              height:   Math.max(elH, 1),
            }}
          >
            <ElementSwitch
              el={el}
              item={item}
              wpx={elW}
              hpx={elH}
              debug={debug}
            />
          </div>
        );
      })}
    </div>
  );
}
