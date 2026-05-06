// src/pages/configuracion-sistema/ConfiguracionSistemaEtiquetas.tsx
// Editor visual de plantillas de etiquetas.
// Drag + resize + snap + bounds clamping, sin librerías externas de canvas.
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft,
  Check, ChevronDown, ChevronUp, Columns2, Copy, Eye, EyeOff,
  Grid, LayoutGrid, Layers, Maximize2, Minimize2,
  Pencil, Plus, Printer, QrCode, Save, Sparkles,
  ScanLine, Tag, Trash2, Type, X, ZoomIn, ZoomOut,
} from "lucide-react";

import { cn }              from "../../components/ui/tp";
import { TPSectionShell }  from "../../components/ui/TPSectionShell";
import { TPButton }        from "../../components/ui/TPButton";
import { TPTabs }          from "../../components/ui/TPTabs";
import { TPField }         from "../../components/ui/TPField";
import TPInput             from "../../components/ui/TPInput";
import { Modal }           from "../../components/ui/Modal";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { TPCard }          from "../../components/ui/TPCard";
import TPComboFixed        from "../../components/ui/TPComboFixed";
import TPNumberInput       from "../../components/ui/TPNumberInput";
import { TPCheckbox }      from "../../components/ui/TPCheckbox";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { toast }           from "../../lib/toast";

import {
  labelTemplatesApi,
  PRESET_TEMPLATES, FIELD_KEY_OPTIONS,
  type LabelTemplateRow, type LabelElementRow, type LabelElementType,
} from "../../services/label-templates";
import {
  printerProfilesApi, PRESET_PRINTERS, PRINTER_TYPE_LABELS,
  type PrinterProfileRow, type PrinterType,
} from "../../services/printer-profiles";

import LabelRenderer          from "../../components/labels/LabelRenderer";
import { buildCalibrationHtml } from "../article-detail/LabelPrintModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const MM_TO_PX = 3.7795; // 96dpi / 25.4

function mm(v: number | string, zoom = 1): number {
  return parseFloat(String(v)) * MM_TO_PX * zoom;
}

function snapVal(v: number, snapMm: number): number {
  return Math.round(v / snapMm) * snapMm;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const ELEMENT_TYPE_LABELS: Record<LabelElementType, string> = {
  TEXT:    "Texto",
  BARCODE: "Código de barras",
  QR:      "QR",
  IMAGE:   "Imagen",
  LINE:    "Línea",
};

const ELEMENT_TYPE_COLORS: Record<LabelElementType, string> = {
  TEXT:    "bg-blue-500/15 text-blue-600 border-blue-300/40",
  BARCODE: "bg-violet-500/15 text-violet-600 border-violet-300/40",
  QR:      "bg-green-500/15 text-green-600 border-green-300/40",
  IMAGE:   "bg-amber-500/15 text-amber-600 border-amber-300/40",
  LINE:    "bg-gray-500/15 text-gray-600 border-gray-300/40",
};

const SNAP_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5mm" },
  { value: 1,   label: "1mm"   },
  { value: 2,   label: "2mm"   },
  { value: 5,   label: "5mm"   },
];

const GRID_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1mm" },
  { value: 2, label: "2mm" },
  { value: 5, label: "5mm" },
];

const SAFE_MARGIN_MM = 2; // área segura de impresión

const RULER_SIZE = 16;  // grosor de regla en px
const SNAP_GUIDE = 0.8; // mm — proximidad para activar guía de snap a elemento

type SnapLine = { axis: "x" | "y"; posMm: number };

// Datos de muestra para preview en el editor
const SAMPLE_MAP: Record<string, string> = {
  // Identificación
  "article.name":          "Anillo Solitario Oro",
  "article.code":          "ANI-0042",
  "article.sku":           "JW-042",
  "article.resolvedSku":   "T15-042",
  "resolvedSku":           "T15-042",
  "article.barcode":       "7790001234567",
  "article.qrCode":        "7790001234567",
  "qrCode":                "7790001234567",
  "article.rfid":          "E200342890B90012",
  "rfidCode":              "E200342890B90012",
  "manufacturer":          "Taller Propio",
  "supplierName":          "Metales del Sur",
  // Variante
  "variant.name":          "Talle 15",
  "variant.code":          "T15",
  "variant.sku":           "T15-042",
  "size":                  "15",
  // Precios y costos
  "article.salePrice":     "$28.500",
  "article.costPrice":     "$14.200",
  "article.brand":         "Vera",
  "hechura":               "$2.500",
  // Pesos y composición
  "article.totalWeight":   "3,25 g",
  "totalWeight":           "3,25 g",
  "article.metalWeights":  "Oro 18k: 2,85 g\nPlata 925: 0,40 g",
  "metalVariantWeights":   "Oro 18k: 2,85 g\nPlata 925: 0,40 g",
  "mainMetal":             "Oro 18k",
  "purityOrLey":           "750",
  "resolvedMerma":         "5,00%",
  "mermaPercent":          "5,00%",
  "metalMermaSummary":     "Oro 18k: 5,00%\nPlata 925: 3,00%",
  // Clasificación
  "categoryName":          "Anillos",
  "groupName":             "Colección Oro",
  "articleType":           "Producto",
  "articleStatus":         "Activo",
  // Atributos
  "attributesSummary":          "Talle: 15 · Color: Dorado",
  "resolvedAttributesSummary":  "Talle: 15 · Color: Dorado",
  "attr.Talle":            "15",
  "attr.Color":            "Dorado",
  "attr.Piedra":           "Zircón",
  // Inventario
  "stockTotal":            "12",
  "reorderPoint":          "3",
  "defaultQuantity":       "1",
  // Descriptivos
  "description":           "Anillo solitario con zircón, plata 925",
  "notes":                 "Exhibición especial",
  "unitOfMeasure":         "unidad",
  "dimensions":            "15×10×3 mm",
  // Estático
  "static":                "",
};

const SAMPLE_ITEM = {
  id:                 "_sample",
  name:               "Anillo Solitario Oro",
  code:               "ANI-0042",
  sku:                "JW-042",
  variantSku:         "T15-042",
  barcode:            "7790001234567",
  barcodeType:        "CODE128" as const,
  salePrice:          "28500",
  costPrice:          "14200",
  brand:              "Vera",
  variantName:        "Talle 15",
  variantCode:        "T15",
  weight:             "3.25",
  weightUnit:         "g",
  metalWeights:       "Oro 18k: 2,85 g\nPlata 925: 0,40 g",
  attrs:              { "RFID": "E200342890B90012", "Talle": "15", "Color": "Dorado", "Piedra": "Zircón" },
  // Descriptivos
  description:        "Anillo solitario con zircón, plata 925",
  notes:              "Exhibición especial",
  unitOfMeasure:      "unidad",
  dimensions:         "15×10×3 mm",
  // Clasificación
  categoryName:       "Anillos",
  articleType:        "PRODUCT",
  articleStatus:      "ACTIVE",
  groupName:          "Colección Oro",
  // Comerciales
  manufacturer:       "Taller Propio",
  supplierName:       "Metales del Sur",
  hechuraPrice:       "2500",
  mermaPercent:       "5.00",
  // Metales
  mainMetal:          "Oro 18k",
  purityOrLey:        "750",
  // Inventario
  stockTotal:         "12",
  reorderPoint:       "3",
  defaultQuantity:    "1",
  // Atributos
  attributesSummary:         "Talle: 15 · Color: Dorado",
  resolvedAttributesSummary: "Talle: 15 · Color: Dorado",
  metalMermaSummary:         "Oro 18k: 5,00%\nPlata 925: 3,00%",
};

// ─── LocalElement type ────────────────────────────────────────────────────────

type LocalElement = {
  id:              string;
  type:            LabelElementType;
  label:           string;
  fieldKey:        string;
  x:               number;
  y:               number;
  width:           number;
  height:          number;
  fontSize:        number;
  fontWeight:      string;
  align:           string;
  visible:         boolean;
  sortOrder:       number;
  // Extended props (stored in configJson)
  autoHideIfEmpty: boolean;
  lineClamp:       number;   // 0 = sin límite
  suffix:          string;
  rotation:        number;   // grados, 0 = sin rotación
  configJson:      Record<string, unknown>;
  _new?:           boolean;
};

function rowToLocal(el: LabelElementRow): LocalElement {
  let cfg: Record<string, unknown> = {};
  try { cfg = JSON.parse(el.configJson || "{}"); } catch { /* ok */ }
  return {
    id:              el.id,
    type:            el.type,
    label:           el.label,
    fieldKey:        el.fieldKey,
    x:               parseFloat(el.x),
    y:               parseFloat(el.y),
    width:           parseFloat(el.width),
    height:          parseFloat(el.height),
    fontSize:        el.fontSize,
    fontWeight:      el.fontWeight,
    align:           el.align,
    visible:         el.visible,
    sortOrder:       el.sortOrder,
    autoHideIfEmpty: Boolean(cfg.autoHideIfEmpty),
    lineClamp:       typeof cfg.lineClamp === "number" ? cfg.lineClamp : 0,
    suffix:          typeof cfg.suffix    === "string"  ? cfg.suffix    : "",
    rotation:        typeof cfg.rotation  === "number"  ? cfg.rotation  : 0,
    configJson:      cfg,
  };
}

function localToRowPayload(el: LocalElement, i: number) {
  const { autoHideIfEmpty, lineClamp, suffix, rotation, configJson } = el;
  return {
    type:       el.type,
    label:      el.label,
    fieldKey:   el.fieldKey,
    x:          el.x,
    y:          el.y,
    width:      el.width,
    height:     el.height,
    fontSize:   el.fontSize,
    fontWeight: el.fontWeight,
    align:      el.align,
    visible:    el.visible,
    sortOrder:  i,
    configJson: { ...configJson, autoHideIfEmpty, lineClamp, suffix, rotation },
  };
}

// Convert LocalElement to LabelElementRow for LabelRenderer
function localToElementRow(el: LocalElement): LabelElementRow {
  return {
    id:         el.id,
    type:       el.type,
    label:      el.label,
    fieldKey:   el.fieldKey,
    x:          String(el.x),
    y:          String(el.y),
    width:      String(el.width),
    height:     String(el.height),
    fontSize:   el.fontSize,
    fontWeight: el.fontWeight,
    align:      el.align,
    visible:    el.visible,
    sortOrder:  el.sortOrder,
    configJson: JSON.stringify({ ...el.configJson, rotation: el.rotation }),
  };
}

// ─── Element content renderer (canvas) ───────────────────────────────────────

function ElementContent({ el, zoom }: { el: LocalElement; zoom: number }) {
  // Para "static": el label ES el texto a mostrar. Para campos dinámicos: prefijo + muestra.
  const isStatic = el.fieldKey === "static";
  const sample   = isStatic ? "" : (SAMPLE_MAP[el.fieldKey] ?? "");
  const text     = isStatic
    ? `${el.label}${el.suffix}`
    : `${el.label}${sample}${el.suffix}`;
  const isLine = el.type === "LINE";

  if (isLine) return (
    <div style={{ width: "100%", height: "1px", backgroundColor: "#333", marginTop: "auto", marginBottom: "auto" }} />
  );

  if (el.type === "BARCODE") return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <div style={{ fontSize: `${6 * zoom * 0.75}px`, color: "#666", lineHeight: 1 }}>{sample || "BARCODE"}</div>
      <div style={{ width: "90%", height: "55%", backgroundImage: "repeating-linear-gradient(90deg,#222 0,#222 2px,transparent 2px,transparent 5px)" }} />
    </div>
  );

  if (el.type === "QR") return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: "70%", height: "70%", minWidth: 8, minHeight: 8,
        backgroundImage:
          "repeating-linear-gradient(to bottom,#222 0,#222 3px,transparent 3px,transparent 6px)," +
          "repeating-linear-gradient(to right,#222 0,#222 3px,transparent 3px,transparent 6px)",
        border: "1px solid #222",
      }} />
    </div>
  );

  if (el.type === "IMAGE") return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", fontSize: `${Math.max(5, 7 * zoom * 0.75)}px`, color: "#9ca3af" }}>
      IMG
    </div>
  );

  // TEXT
  const justifyMap: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };
  const hasNewline = text.includes("\n");
  const fallback   = isStatic ? "← doble clic para escribir" : (el.fieldKey || "Texto");
  return (
    <div style={{
      width:          "100%",
      height:         "100%",
      fontSize:       `${el.fontSize * zoom * 0.75}px`,
      fontWeight:     el.fontWeight,
      display:        "flex",
      alignItems:     hasNewline ? "flex-start" : "center",
      justifyContent: justifyMap[el.align] ?? "flex-start",
      overflow:       "hidden",
      whiteSpace:     hasNewline ? "pre-line" : "nowrap",
      padding:        "0 1px",
      lineHeight:     1.2,
      color:          text ? "#111" : "#aaa",
    }}>
      {text || fallback}
    </div>
  );
}

// ─── Ruler ───────────────────────────────────────────────────────────────────

function Ruler({
  axis, lengthMm, zoom, cursorMm,
}: {
  axis:      "x" | "y";
  lengthMm:  number;
  zoom:      number;
  cursorMm:  number | null;
}) {
  const scale = MM_TO_PX * zoom;
  const px    = lengthMm * scale;

  // Adaptar intervalo al zoom para no saturar de ticks
  const rawInterval = lengthMm / 60;
  const interval   = rawInterval <= 1 ? 1 : rawInterval <= 2 ? 2 : rawInterval <= 5 ? 5 : 10;
  const labelEvery = interval <= 2 ? 5 : 10;

  const ticks: number[] = [];
  for (let v = 0; v <= lengthMm + 0.001; v = Math.round((v + interval) * 100) / 100) ticks.push(v);

  const isX = axis === "x";
  const w   = isX ? px : RULER_SIZE;
  const h   = isX ? RULER_SIZE : px;

  return (
    <svg
      width={w} height={h}
      style={{
        display: "block", flexShrink: 0, background: "#f8fafc",
        borderBottom: isX ? "1px solid #e2e8f0" : undefined,
        borderRight:  isX ? undefined : "1px solid #e2e8f0",
        overflow: "visible", userSelect: "none",
      }}
    >
      {ticks.map(v => {
        const pos    = v * scale;
        const isLong = v % labelEvery === 0;
        const tick   = isLong ? 8 : 4;
        return (
          <g key={v}>
            {isX ? (
              <>
                <line x1={pos} y1={RULER_SIZE - tick} x2={pos} y2={RULER_SIZE} stroke="#94a3b8" strokeWidth={0.5} />
                {isLong && v > 0 && (
                  <text x={pos + 1.5} y={RULER_SIZE - tick - 1} fontSize={6.5} fill="#94a3b8" fontFamily="ui-monospace,monospace">{v}</text>
                )}
              </>
            ) : (
              <>
                <line x1={RULER_SIZE - tick} y1={pos} x2={RULER_SIZE} y2={pos} stroke="#94a3b8" strokeWidth={0.5} />
                {isLong && v > 0 && (
                  <text x={RULER_SIZE - tick - 1} y={pos} fontSize={6.5} fill="#94a3b8" fontFamily="ui-monospace,monospace" textAnchor="end" dominantBaseline="middle">{v}</text>
                )}
              </>
            )}
          </g>
        );
      })}
      {/* Marcador de cursor */}
      {cursorMm != null && (
        isX
          ? <line x1={cursorMm * scale} y1={0} x2={cursorMm * scale} y2={RULER_SIZE} stroke="#3b82f6" strokeWidth={1} />
          : <line x1={0} y1={cursorMm * scale} x2={RULER_SIZE} y2={cursorMm * scale} stroke="#3b82f6" strokeWidth={1} />
      )}
    </svg>
  );
}

// ─── snap-to-element+canvas helper (fuera del componente = sin re-creación) ───

type SnapCandidate = { delta: number; pos: number };

function computeSnapLines(
  el: LocalElement, nx: number, ny: number,
  others: LocalElement[],
  canvasW = 0, canvasH = 0,
): { snappedX: number; snappedY: number; lines: SnapLine[] } {
  const elR = nx + el.width,  elCX = nx + el.width  / 2;
  const elB = ny + el.height, elCY = ny + el.height / 2;

  // Usar objeto para que TypeScript rastree las asignaciones de closures correctamente
  const best: { x: SnapCandidate | null; y: SnapCandidate | null } = { x: null, y: null };

  function tryX(myEdge: number, target: number) {
    const d = Math.abs(myEdge - target);
    if (d < SNAP_GUIDE && (!best.x || d < Math.abs(best.x.delta)))
      best.x = { delta: target - myEdge, pos: target };
  }
  function tryY(myEdge: number, target: number) {
    const d = Math.abs(myEdge - target);
    if (d < SNAP_GUIDE && (!best.y || d < Math.abs(best.y.delta)))
      best.y = { delta: target - myEdge, pos: target };
  }

  // Bordes y centro del canvas
  if (canvasW > 0) for (const m of [nx, elR, elCX]) for (const t of [0, canvasW, canvasW / 2]) tryX(m, t);
  if (canvasH > 0) for (const m of [ny, elB, elCY]) for (const t of [0, canvasH, canvasH / 2]) tryY(m, t);

  // Otros elementos
  for (const o of others) {
    if (o.id === el.id) continue;
    const [oL, oR, oCX] = [o.x, o.x + o.width,  o.x + o.width  / 2];
    const [oT, oB, oCY] = [o.y, o.y + o.height, o.y + o.height / 2];
    for (const m of [nx, elR, elCX]) for (const t of [oL, oR, oCX]) tryX(m, t);
    for (const m of [ny, elB, elCY]) for (const t of [oT, oB, oCY]) tryY(m, t);
  }

  const lines: SnapLine[] = [];
  if (best.x) lines.push({ axis: "y", posMm: best.x.pos });
  if (best.y) lines.push({ axis: "x", posMm: best.y.pos });

  return {
    snappedX: best.x ? nx + best.x.delta : nx,
    snappedY: best.y ? ny + best.y.delta : ny,
    lines,
  };
}

// ─── LabelCanvas ─────────────────────────────────────────────────────────────

type DragState = {
  elementId:    string;
  startX:       number;
  startY:       number;
  origX:        number;
  origY:        number;
  currentX:     number;
  currentY:     number;
  isAlt:        boolean;
  groupOrigPos: Record<string, { x: number; y: number }>;
};

type ResizeState = {
  elementId: string;
  handle:    "se" | "e" | "s";
  startX:    number;
  startY:    number;
  origW:     number;
  origH:     number;
};

type RotateState = {
  elementId:    string;
  startAngle:   number;   // ángulo mouse→centro al inicio (grados)
  origRotation: number;   // rotation original del elemento
  centerX:      number;   // centro del elemento en px de pantalla
  centerY:      number;
};

/** Ángulo en grados desde el centro (cx,cy) al punto (mx,my). 0° = arriba. */
function getAngleDeg(cx: number, cy: number, mx: number, my: number): number {
  return Math.atan2(my - cy, mx - cx) * (180 / Math.PI) + 90;
}

function LabelCanvas({
  template, elements, selectedIds, zoom, snapMm, gridMm, showGrid,
  showSafeArea, previewMode,
  onSelect, onUpdate, onAltDuplicate, onCursorMove,
}: {
  template:       { widthMm: number; heightMm: number; bgColor: string };
  elements:       LocalElement[];
  selectedIds:    string[];
  zoom:           number;
  snapMm:         number;
  gridMm:         number;
  showGrid:       boolean;
  showSafeArea:   boolean;
  previewMode:    boolean;
  onSelect:       (ids: string[]) => void;
  onUpdate:       (id: string, patch: Partial<LocalElement>) => void;
  onAltDuplicate: (id: string, x: number, y: number) => void;
  onCursorMove:   (x: number | null, y: number | null) => void;
}) {
  const drag      = useRef<DragState    | null>(null);
  const resize    = useRef<ResizeState  | null>(null);
  const rotate    = useRef<RotateState  | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editRef   = useRef<HTMLInputElement | null>(null);
  const [snapLines,      setSnapLines]      = useState<SnapLine[]>([]);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editValue,      setEditValue]      = useState("");
  const [rotatingAngle,  setRotatingAngle]  = useState<number | null>(null);
  const scale   = MM_TO_PX * zoom;

  function startEdit(el: LocalElement) {
    setEditingId(el.id);
    setEditValue(el.label);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 30);
  }

  function commitEdit() {
    if (editingId) {
      onUpdate(editingId, { label: editValue });
      setEditingId(null);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function startRotate(e: React.MouseEvent, el: LocalElement) {
    e.stopPropagation();
    e.preventDefault();
    if (editingId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Centro del elemento en coordenadas de pantalla
    const cx = rect.left + mm(el.x + el.width  / 2, zoom);
    const cy = rect.top  + mm(el.y + el.height / 2, zoom);
    rotate.current = {
      elementId:    el.id,
      startAngle:   getAngleDeg(cx, cy, e.clientX, e.clientY),
      origRotation: el.rotation ?? 0,
      centerX:      cx,
      centerY:      cy,
    };
    setRotatingAngle(Math.round(el.rotation ?? 0));
  }

  function startDrag(e: React.MouseEvent, el: LocalElement) {
    if (editingId) return; // no arrastrar mientras se edita
    e.stopPropagation();
    e.preventDefault();

    // Shift+click → toggle selection sin iniciar drag
    if (e.shiftKey) {
      const already = selectedIds.includes(el.id);
      onSelect(already ? selectedIds.filter(id => id !== el.id) : [...selectedIds, el.id]);
      return;
    }

    // Si no está en la selección, seleccionarlo primero
    if (!selectedIds.includes(el.id)) onSelect([el.id]);

    // Posiciones originales de todos los elementos seleccionados (grupo)
    const group = selectedIds.includes(el.id) ? selectedIds : [el.id];
    const groupOrigPos: Record<string, { x: number; y: number }> = {};
    for (const id of group) {
      const m = elements.find(e => e.id === id);
      if (m) groupOrigPos[id] = { x: m.x, y: m.y };
    }

    drag.current = {
      elementId: el.id,
      startX:    e.clientX,
      startY:    e.clientY,
      origX:     el.x,
      origY:     el.y,
      currentX:  el.x,
      currentY:  el.y,
      isAlt:     e.altKey,
      groupOrigPos,
    };
  }

  function startResize(e: React.MouseEvent, el: LocalElement, handle: "se" | "e" | "s") {
    e.stopPropagation();
    e.preventDefault();
    resize.current = {
      elementId: el.id, handle,
      startX: e.clientX, startY: e.clientY,
      origW: el.width,   origH: el.height,
    };
  }

  function onMouseMove(e: React.MouseEvent) {
    // Cursor tracking para reglas
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    onCursorMove(
      (e.clientX - rect.left) / scale,
      (e.clientY - rect.top)  / scale,
    );

    if (drag.current) {
      const rawDx = (e.clientX - drag.current.startX) / scale;
      const rawDy = (e.clientY - drag.current.startY) / scale;
      const primaryEl = elements.find(el => el.id === drag.current!.elementId);
      if (!primaryEl) return;

      let nx = clamp(snapVal(drag.current.origX + rawDx, snapMm), 0, template.widthMm  - primaryEl.width);
      let ny = clamp(snapVal(drag.current.origY + rawDy, snapMm), 0, template.heightMm - primaryEl.height);

      // Snap a otros elementos (solo selección individual)
      const groupIds = Object.keys(drag.current.groupOrigPos);
      if (groupIds.length === 1) {
        const others = elements.filter(el => !groupIds.includes(el.id));
        const { snappedX, snappedY, lines } = computeSnapLines(
          { ...primaryEl, x: nx, y: ny }, nx, ny, others,
          template.widthMm, template.heightMm,
        );
        nx = clamp(snappedX, 0, template.widthMm  - primaryEl.width);
        ny = clamp(snappedY, 0, template.heightMm - primaryEl.height);
        setSnapLines(lines);
      } else {
        setSnapLines([]);
      }

      drag.current.currentX = nx;
      drag.current.currentY = ny;
      const dx = nx - drag.current.origX;
      const dy = ny - drag.current.origY;

      // Mover todos los elementos del grupo con el mismo delta
      for (const id of groupIds) {
        const orig   = drag.current.groupOrigPos[id];
        const member = elements.find(el => el.id === id);
        if (!member || !orig) continue;
        onUpdate(id, {
          x: clamp(orig.x + dx, 0, template.widthMm  - member.width),
          y: clamp(orig.y + dy, 0, template.heightMm - member.height),
        });
      }
    }

    if (resize.current) {
      const dx = (e.clientX - resize.current.startX) / scale;
      const dy = (e.clientY - resize.current.startY) / scale;
      const el = elements.find(el => el.id === resize.current!.elementId);
      if (!el) return;
      const patch: Partial<LocalElement> = {};
      if (resize.current.handle === "se" || resize.current.handle === "e")
        patch.width  = clamp(snapVal(resize.current.origW + dx, snapMm), 1,   template.widthMm  - el.x);
      if (resize.current.handle === "se" || resize.current.handle === "s")
        patch.height = clamp(snapVal(resize.current.origH + dy, snapMm), 0.5, template.heightMm - el.y);
      onUpdate(resize.current.elementId, patch);
    }

    if (rotate.current) {
      const { elementId, startAngle, origRotation, centerX, centerY } = rotate.current;
      const currentAngle = getAngleDeg(centerX, centerY, e.clientX, e.clientY);
      let newRot = origRotation + (currentAngle - startAngle);
      // Normalizar a [0, 360)
      newRot = ((newRot % 360) + 360) % 360;
      // Snap a 15° con Shift, a 45° con Ctrl
      if (e.shiftKey)      newRot = Math.round(newRot / 45) * 45;
      else if (e.ctrlKey)  newRot = Math.round(newRot / 15) * 15;
      const rounded = Math.round(newRot);
      onUpdate(elementId, { rotation: rounded });
      setRotatingAngle(rounded);
    }
  }

  function onMouseUp() {
    // Rotación: simplemente limpiar
    if (rotate.current) {
      setRotatingAngle(null);
      rotate.current = null;
      return;
    }
    // Alt+drag → el original vuelve a su posición; se crea una copia donde se soltó
    if (drag.current?.isAlt) {
      const { elementId, origX, origY, currentX, currentY } = drag.current;
      onUpdate(elementId, { x: origX, y: origY });
      onAltDuplicate(elementId, currentX, currentY);
    }
    setSnapLines([]);
    drag.current   = null;
    resize.current = null;
  }

  const canvasW   = mm(template.widthMm,  zoom);
  const canvasH   = mm(template.heightMm, zoom);
  const gridSizePx = mm(gridMm, zoom);
  const sorted    = [...elements].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div
      ref={canvasRef}
      data-canvas="1"
      style={{
        position:        "relative",
        width:           canvasW,
        height:          canvasH,
        backgroundColor: template.bgColor || "#ffffff",
        border:          "1px solid #cbd5e1",
        boxShadow:       "0 4px 24px rgba(0,0,0,0.12)",
        flexShrink:      0,
        overflow:        "visible",
        cursor:          rotatingAngle !== null ? "alias" : drag.current ? "grabbing" : "default",
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { onMouseUp(); onCursorMove(null, null); }}
      onClick={() => { if (!drag.current && !rotate.current) onSelect([]); }}
    >
      {/* ── Clip region: grid + área segura + hint ── */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>

        {/* Grid */}
        {showGrid && !previewMode && gridSizePx > 3 && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
            `,
            backgroundSize: `${gridSizePx}px ${gridSizePx}px`,
          }} />
        )}

        {/* Área segura de impresión */}
        {showSafeArea && !previewMode && (
          <div style={{
            position: "absolute",
            top:    mm(SAFE_MARGIN_MM, zoom),
            left:   mm(SAFE_MARGIN_MM, zoom),
            right:  mm(SAFE_MARGIN_MM, zoom),
            bottom: mm(SAFE_MARGIN_MM, zoom),
            border: "1.5px dashed rgba(239,68,68,0.45)",
            borderRadius: 1,
            pointerEvents: "none",
          }} />
        )}

        {/* Hint canvas vacío */}
        {elements.length === 0 && !previewMode && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>Canvas vacío</div>
            <div style={{ fontSize: 8.5, color: "#cbd5e1", textAlign: "center", lineHeight: 1.4, maxWidth: "80%" }}>
              Usá los botones de la barra para agregar texto, códigos o líneas
            </div>
          </div>
        )}
      </div>

      {/* ── Elementos ── */}
      {sorted.map(el => {
        if (!el.visible) return null;
        const elW  = mm(el.width, zoom);
        const elH  = mm(el.type === "LINE" ? Math.max(0.3, el.height) : el.height, zoom);
        const elX  = mm(el.x, zoom);
        const elY  = mm(el.y, zoom);
        const isPrimary  = selectedIds.length === 1 && selectedIds[0] === el.id;
        const isSelected = selectedIds.includes(el.id);

        return (
          <div
            key={el.id}
            style={{
              position:        "absolute",
              left:            elX,
              top:             elY,
              width:           elW,
              height:          el.type === "LINE" ? Math.max(1, elH) : elH,
              outline:         previewMode ? "none"
                              : isPrimary  ? "2px solid #3b82f6"
                              : isSelected ? "1.5px solid #93c5fd"
                              : "1px dashed rgba(0,0,0,0.12)",
              outlineOffset:   isPrimary ? "0px" : "-1px",
              backgroundColor: !previewMode && isSelected ? "rgba(59,130,246,0.04)" : "transparent",
              cursor:          previewMode ? "default" : "move",
              zIndex:          el.sortOrder + (isSelected ? 100 : 1),
              boxSizing:       "border-box",
              transform:       el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              transformOrigin: "center center",
            }}
            onMouseDown={previewMode ? undefined : (e) => startDrag(e, el)}
            onClick={previewMode ? undefined : (e) => e.stopPropagation()}
            onDoubleClick={(!previewMode && el.type === "TEXT") ? (e) => { e.stopPropagation(); startEdit(el); } : undefined}
            title={!previewMode && el.type === "TEXT" ? "Doble clic para editar texto" : undefined}
          >
            <ElementContent el={el} zoom={zoom} />

            {/* Edición inline por doble clic (edita el label/texto del elemento) */}
            {editingId === el.id && (
              <input
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                }}
                onBlur={commitEdit}
                placeholder={el.fieldKey === "static" ? "Texto estático…" : "Prefijo / etiqueta…"}
                title={el.fieldKey === "static" ? "Texto estático — Enter para confirmar, Esc para cancelar" : "Prefijo visible antes del valor del campo — Enter para confirmar, Esc para cancelar"}
                style={{
                  position:    "absolute",
                  inset:       0,
                  width:       "100%",
                  height:      "100%",
                  border:      "2px solid #3b82f6",
                  borderRadius: 2,
                  padding:     "1px 3px",
                  fontSize:    Math.max(9, el.fontSize * zoom * 0.85),
                  fontWeight:  el.fontWeight,
                  textAlign:   el.align as React.CSSProperties["textAlign"],
                  background:  "rgba(255,255,255,0.97)",
                  color:       "#111",
                  outline:     "none",
                  zIndex:      500,
                  boxSizing:   "border-box",
                }}
              />
            )}

            {/* Handles de resize — solo para el primario, no en preview */}
            {!previewMode && isPrimary && (
              <>
                <div style={{ position:"absolute", right:-5, bottom:-5, width:10, height:10, background:"#3b82f6", border:"2px solid #fff", borderRadius:2, cursor:"se-resize", zIndex:200 }}
                  onMouseDown={(e) => startResize(e, el, "se")} />
                <div style={{ position:"absolute", right:-4, top:"50%", marginTop:-4, width:8, height:8, background:"#3b82f6", border:"2px solid #fff", borderRadius:"50%", cursor:"e-resize", zIndex:200 }}
                  onMouseDown={(e) => startResize(e, el, "e")} />
                <div style={{ position:"absolute", left:"50%", marginLeft:-4, bottom:-4, width:8, height:8, background:"#3b82f6", border:"2px solid #fff", borderRadius:"50%", cursor:"s-resize", zIndex:200 }}
                  onMouseDown={(e) => startResize(e, el, "s")} />
              </>
            )}

            {/* Handle de rotación — solo primario, no en preview */}
            {!previewMode && isPrimary && (
              <div
                style={{
                  position:       "absolute",
                  top:            -30,
                  left:           "50%",
                  transform:      "translateX(-50%)",
                  display:        "flex",
                  flexDirection:  "column",
                  alignItems:     "center",
                  pointerEvents:  "none",
                  zIndex:         250,
                  userSelect:     "none",
                }}
              >
                {/* Tooltip de ángulo — solo mientras se rota */}
                {rotatingAngle !== null && (
                  <div style={{
                    marginBottom: 2,
                    background:   "rgba(0,0,0,0.72)",
                    color:        "#fff",
                    fontSize:     9,
                    fontFamily:   "monospace",
                    padding:      "2px 5px",
                    borderRadius: 3,
                    whiteSpace:   "nowrap",
                    pointerEvents:"none",
                    lineHeight:   1.4,
                  }}>
                    {rotatingAngle}°
                  </div>
                )}
                {/* Línea de conexión handle→elemento */}
                <div style={{ width:1, height:14, background:"#3b82f6", opacity:0.55 }} />
                {/* Handle circular */}
                <div
                  style={{
                    width:        14,
                    height:       14,
                    borderRadius: "50%",
                    background:   rotatingAngle !== null ? "#1d4ed8" : "#3b82f6",
                    border:       "2px solid #fff",
                    cursor:       "alias",
                    pointerEvents:"all",
                    boxShadow:    "0 1px 5px rgba(0,0,0,0.28)",
                    transition:   "background 0.1s",
                  }}
                  onMouseDown={(e) => startRotate(e, el)}
                  title={`Rotar (arrastrá) — Shift: snap 45° · Ctrl: snap 15°\nÁngulo actual: ${Math.round(el.rotation ?? 0)}°`}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* ── Guías de snap (SVG overlay) ── */}
      {!previewMode && snapLines.length > 0 && (
        <svg style={{ position:"absolute", inset:0, width:canvasW, height:canvasH, pointerEvents:"none", zIndex:300, overflow:"visible" }}>
          {snapLines.map((line, i) =>
            line.axis === "y"
              ? <line key={i} x1={line.posMm * scale} y1={-999} x2={line.posMm * scale} y2={canvasH + 999} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 3" opacity={0.85} />
              : <line key={i} x1={-999} y1={line.posMm * scale} x2={canvasW + 999} y2={line.posMm * scale} stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 3" opacity={0.85} />
          )}
        </svg>
      )}

      {/* Dimensión */}
      {!previewMode && (
        <div style={{ position:"absolute", bottom:-18, left:0, fontSize:9, color:"#94a3b8", whiteSpace:"nowrap", pointerEvents:"none" }}>
          {template.widthMm}×{template.heightMm}mm
        </div>
      )}
    </div>
  );
}

// ─── Panel section helper ─────────────────────────────────────────────────────

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-0.5 h-3 rounded-full bg-primary opacity-60 flex-shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text opacity-40 leading-none select-none">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

// ─── Element properties panel ─────────────────────────────────────────────────

function ElementPanel({
  el, onChange, onDelete, onDuplicate,
}: {
  el:          LocalElement;
  onChange:    (patch: Partial<LocalElement>) => void;
  onDelete:    () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="space-y-5">

      {/* ── Header: tipo + acciones ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
            el.type === "TEXT"    && "bg-blue-500",
            el.type === "BARCODE" && "bg-violet-500",
            el.type === "QR"      && "bg-green-500",
            el.type === "IMAGE"   && "bg-amber-500",
            el.type === "LINE"    && "bg-gray-400",
          )} />
          <span className="text-[12px] font-semibold text-text">
            {ELEMENT_TYPE_LABELS[el.type]}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <TPButton
            variant="ghost"
            onClick={onDuplicate}
            title="Duplicar elemento"
            className="h-7 w-7 p-0 text-muted hover:text-text rounded-md"
          >
            <Copy size={12} />
          </TPButton>
          <TPButton
            variant="ghost"
            onClick={onDelete}
            title="Eliminar elemento (Delete)"
            className="h-7 w-7 p-0 text-muted hover:bg-red-50 hover:text-red-500 rounded-md"
          >
            <Trash2 size={12} />
          </TPButton>
        </div>
      </div>

      {/* ── Contenido ── */}
      {(el.type === "TEXT" || el.type === "BARCODE" || el.type === "QR") && (
        <PanelSection title="Contenido">
          <div className="space-y-3">
            <TPField label="Campo">
              <TPComboFixed
                value={el.fieldKey}
                onChange={(v) => onChange({ fieldKey: v })}
                options={FIELD_KEY_OPTIONS}
                searchable
                searchPlaceholder="Buscar campo…"
              />
            </TPField>
            {el.type === "TEXT" && (
              <div className="grid grid-cols-2 gap-3">
                <TPField label="Prefijo">
                  <TPInput value={el.label} onChange={(v) => onChange({ label: v })} placeholder="Precio: " />
                </TPField>
                <TPField label="Sufijo">
                  <TPInput value={el.suffix} onChange={(v) => onChange({ suffix: v })} placeholder="kg" />
                </TPField>
              </div>
            )}
          </div>
        </PanelSection>
      )}

      {/* ── Tipografía (TEXT) ── */}
      {el.type === "TEXT" && (
        <PanelSection title="Tipografía">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <TPField label="Tamaño (pt)">
                <TPNumberInput
                  value={el.fontSize}
                  onChange={(v) => onChange({ fontSize: v ?? 8 })}
                  decimals={0} step={1} min={4} max={72}
                />
              </TPField>
              <TPField label="Peso">
                <TPComboFixed
                  value={el.fontWeight}
                  onChange={(v) => onChange({ fontWeight: v })}
                  options={[
                    { value: "normal", label: "Normal"  },
                    { value: "bold",   label: "Negrita" },
                  ]}
                />
              </TPField>
            </div>
            <TPField label="Alineación">
              <div className="flex gap-1.5">
                {(["left", "center", "right"] as const).map((a) => (
                  <TPButton
                    key={a}
                    variant="ghost"
                    onClick={() => onChange({ align: a })}
                    className={cn(
                      "flex-1 h-8 p-0 border justify-center rounded-md",
                      el.align === a
                        ? "bg-primary text-white border-primary hover:bg-primary"
                        : "border-border text-muted hover:bg-surface2 hover:text-text"
                    )}
                  >
                    {a === "left"   && <AlignLeft   size={14} />}
                    {a === "center" && <AlignCenter size={14} />}
                    {a === "right"  && <AlignRight  size={14} />}
                  </TPButton>
                ))}
              </div>
            </TPField>
            <TPField label="Máx. líneas">
              <TPNumberInput
                value={el.lineClamp}
                onChange={(v) => onChange({ lineClamp: v ?? 0 })}
                decimals={0} step={1} min={0} max={10}
              />
            </TPField>
          </div>
        </PanelSection>
      )}

      {/* ── Posición y tamaño ── */}
      <PanelSection title="Posición y tamaño">
        <div className="grid grid-cols-2 gap-3">
          <TPField label="X (mm)">
            <TPNumberInput value={el.x} onChange={(v) => onChange({ x: v ?? 0 })} decimals={1} step={0.5} min={0} />
          </TPField>
          <TPField label="Y (mm)">
            <TPNumberInput value={el.y} onChange={(v) => onChange({ y: v ?? 0 })} decimals={1} step={0.5} min={0} />
          </TPField>
          <TPField label="Ancho (mm)">
            <TPNumberInput value={el.width} onChange={(v) => onChange({ width: v ?? 5 })} decimals={1} step={0.5} min={1} />
          </TPField>
          <TPField label="Alto (mm)">
            <TPNumberInput value={el.height} onChange={(v) => onChange({ height: v ?? 1 })} decimals={1} step={0.5} min={0.3} />
          </TPField>
        </div>
      </PanelSection>

      {/* ── Rotación ── */}
      <PanelSection title="Rotación">
        <div className="space-y-3">
          <TPField label="Ángulo (°)">
            <TPNumberInput
              value={el.rotation}
              onChange={(v) => onChange({ rotation: v ?? 0 })}
              decimals={0} step={1} min={-360} max={360}
            />
          </TPField>
          <div className="grid grid-cols-4 gap-1.5">
            {([0, 90, 180, 270] as const).map(deg => (
              <TPButton
                key={deg}
                variant="ghost"
                title={`Rotar ${deg}°`}
                onClick={() => onChange({ rotation: deg })}
                className={cn(
                  "h-8 text-[11px] font-semibold border rounded-md",
                  el.rotation === deg
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border text-muted hover:bg-surface2 hover:text-text"
                )}
              >
                {deg}°
              </TPButton>
            ))}
          </div>
        </div>
      </PanelSection>

      {/* ── Comportamiento ── */}
      <PanelSection title="Comportamiento">
        <div className="space-y-2">
          <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-surface2 cursor-pointer select-none transition-colors">
            <TPCheckbox
              checked={el.visible}
              onChange={(v) => onChange({ visible: v })}
              label=""
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-text leading-tight">Visible</p>
              <p className="text-[10px] text-text opacity-40 leading-tight mt-0.5">
                Mostrar en el canvas y al imprimir
              </p>
            </div>
          </label>
          {el.type === "TEXT" && (
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-surface2 cursor-pointer select-none transition-colors">
              <TPCheckbox
                checked={el.autoHideIfEmpty}
                onChange={(v) => onChange({ autoHideIfEmpty: v })}
                label=""
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-text leading-tight">Ocultar si vacío</p>
                <p className="text-[10px] text-text opacity-40 leading-tight mt-0.5">
                  No imprime si el campo no tiene valor
                </p>
              </div>
            </label>
          )}
        </div>
      </PanelSection>

    </div>
  );
}

// ─── Add element quick buttons ─────────────────────────────────────────────────

const ELEMENT_DEFAULTS: Record<LabelElementType, Partial<LocalElement>> = {
  TEXT:    { width: 30, height: 6,   fontSize: 8,  fontWeight: "normal", align: "left"   },
  BARCODE: { width: 40, height: 14,  fontSize: 6,  fontWeight: "normal", align: "center" },
  QR:      { width: 14, height: 14,  fontSize: 6,  fontWeight: "normal", align: "center" },
  LINE:    { width: 50, height: 0.5, fontSize: 6,  fontWeight: "normal", align: "left"   },
  IMAGE:   { width: 16, height: 10,  fontSize: 8,  fontWeight: "normal", align: "left"   },
};

function makeElement(type: LabelElementType, count: number): LocalElement {
  const defs = ELEMENT_DEFAULTS[type] ?? {};
  return {
    id:              `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    label:           "",
    fieldKey:        type === "BARCODE" || type === "QR"
                       ? "article.barcode"
                       : type === "TEXT" ? "article.name" : "",
    x:               2, y: 2,
    width:           defs.width  ?? 20,
    height:          defs.height ?? 6,
    fontSize:        defs.fontSize   ?? 8,
    fontWeight:      defs.fontWeight ?? "normal",
    align:           defs.align      ?? "left",
    visible:         true,
    sortOrder:       count,
    autoHideIfEmpty: false,
    lineClamp:       0,
    suffix:          "",
    rotation:        0,
    configJson:      {},
    _new:            true,
  };
}

// ─── Preview modal ─────────────────────────────────────────────────────────────

const MM_TO_PX_96 = 96 / 25.4; // 1mm en px a 96dpi

/** Calcula el zoom para que la etiqueta quepa cómodamente en el área de preview */
function calcPreviewFit(labelWMm: number, labelHMm: number): number {
  // Modal: maxWidth="7xl" ~1280px, height="92vh". Restamos header+toolbar+footer (~140px) y padding.
  const availW = Math.min(window.innerWidth  * 0.86, 1200) - 80;
  const availH = Math.min(window.innerHeight * 0.86, 900)  - 160;
  const fw = availW / (labelWMm * MM_TO_PX_96);
  const fh = availH / (labelHMm * MM_TO_PX_96);
  const fit = Math.min(fw, fh, 10);
  return Math.max(0.5, Math.round(fit * 4) / 4); // snap a 0.25
}

function PreviewModal({
  open,
  onClose,
  template,
  elements,
}: {
  open:     boolean;
  onClose:  () => void;
  template: LabelTemplateRow;
  elements: LocalElement[];
}) {
  const fakeTemplate: LabelTemplateRow = {
    ...template,
    elements: elements.map(localToElementRow),
  };

  const labelWMm = parseFloat(String(template.widthMm));
  const labelHMm = parseFloat(String(template.heightMm));

  const [zoom, setZoom] = useState(3);
  const previewRef = useRef<HTMLDivElement>(null);

  // Ajustar al abrir
  useEffect(() => {
    if (open) setZoom(calcPreviewFit(labelWMm, labelHMm));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ctrl/⌘ + scroll para zoom — se adjunta al documento para evitar problemas de timing con el portal
  useEffect(() => {
    if (!open) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      // Solo actuar si el evento viene del área de preview
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) return;
      e.preventDefault();
      setZoom(z => {
        const delta = e.deltaY > 0 ? -0.25 : 0.25;
        return Math.max(0.25, Math.min(10, Math.round((z + delta) * 4) / 4));
      });
    }
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, [open]);

  function bumpZoom(delta: number) {
    setZoom(z => Math.max(0.25, Math.min(10, Math.round((z + delta) * 4) / 4)));
  }

  const pct = Math.round(zoom * 100);

  return (
    <Modal
      open={open}
      title={`Vista previa — ${template.name}`}
      onClose={onClose}
      maxWidth="7xl"
      className="h-[92vh]"
      bodyClassName="p-0 flex flex-col overflow-hidden"
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface flex-shrink-0">

        {/* Info etiqueta */}
        <span className="text-xs font-mono tabular-nums" style={{ color: "var(--muted)" }}>
          {template.widthMm}×{template.heightMm}mm
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>·</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {elements.length} elemento{elements.length !== 1 ? "s" : ""}
        </span>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Zoom − % + */}
        <TPButton
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Reducir zoom (Ctrl+scroll)"
          onClick={() => bumpZoom(-0.25)}
        >
          <ZoomOut size={13} />
        </TPButton>
        <span className="text-xs font-mono tabular-nums w-12 text-center" style={{ color: "var(--muted)" }}>
          {pct}%
        </span>
        <TPButton
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Aumentar zoom (Ctrl+scroll)"
          onClick={() => bumpZoom(0.25)}
        >
          <ZoomIn size={13} />
        </TPButton>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Zoom presets */}
        {([50, 100, 200, 400] as const).map(p => (
          <TPButton
            key={p}
            variant="ghost"
            onClick={() => setZoom(p / 100)}
            className={cn(
              "h-7 px-2 text-[11px]",
              pct === p
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted"
            )}
          >
            {p}%
          </TPButton>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Ajustar a pantalla */}
        <TPButton
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          title="Ajustar a la ventana"
          onClick={() => setZoom(calcPreviewFit(labelWMm, labelHMm))}
        >
          <Maximize2 size={12} />
          <span className="hidden sm:inline">Ajustar</span>
        </TPButton>

        <span className="ml-auto text-[10px] hidden md:inline" style={{ color: "var(--muted)", opacity: 0.7 }}>
          Ctrl+scroll para zoom
        </span>
      </div>

      {/* ── Área de preview ── */}
      <div
        ref={previewRef}
        className="flex-1 min-h-0 overflow-auto"
        style={{
          background: "#e2e8f0",
          backgroundImage: "radial-gradient(circle,#00000014 1px,transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        {/* Centrado: min-h-full hace que el flex container sea al menos tan alto como el área */}
        <div className="flex items-center justify-center min-h-full p-10">
          <div style={{ boxShadow: "0 6px 40px rgba(0,0,0,0.20)", borderRadius: 1, flexShrink: 0 }}>
            <LabelRenderer
              template={fakeTemplate}
              item={SAMPLE_ITEM}
              dpi={96}
              scale={zoom}
              debug={false}
            />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-border bg-surface">
        <p className="text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
          <span className="font-semibold" style={{ color: "#2563eb" }}>Datos de muestra.</span>{" "}
          La impresión real usará los datos del artículo seleccionado.
          Márgenes, columnas y gaps de impresora no se aplican aquí — se aplican al imprimir según el perfil configurado.
        </p>
      </div>
    </Modal>
  );
}

// ─── TemplateEditor ───────────────────────────────────────────────────────────

function TemplateEditor({
  template: initialTemplate,
  onBack,
  onSaved,
  printers = [],
}: {
  template: LabelTemplateRow;
  onBack:   () => void;
  onSaved:  (t: LabelTemplateRow) => void;
  printers?: PrinterProfileRow[];
}) {
  const [template,    setTemplate]    = useState(initialTemplate);
  const [elements,    setElements]    = useState<LocalElement[]>(() => initialTemplate.elements.map(rowToLocal));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom,        setZoom]        = useState(2.5);
  const [snapMm,      setSnapMm]      = useState(1);
  const [gridMm,      setGridMm]      = useState(5);
  const [showGrid,    setShowGrid]    = useState(true);
  const [showSafeArea,setShowSafeArea]= useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cursorMm,    setCursorMm]    = useState<{ x: number; y: number } | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const zoomRef       = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Derived
  const selectedId  = selectedIds[0] ?? null;
  const selectedEl  = elements.find(e => e.id === selectedId) ?? null;
  const multiSelect = selectedIds.length > 1;

  // ── Element CRUD ────────────────────────────────────────────────────────────

  const updateEl = useCallback((id: string, patch: Partial<LocalElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    setDirty(true);
  }, []);

  function addElement(type: LabelElementType) {
    const el = makeElement(type, elements.length);
    setElements(prev => [...prev, el]);
    setSelectedIds([el.id]);
    setDirty(true);
  }

  function duplicateElement(id: string) {
    const src = elements.find(e => e.id === id);
    if (!src) return;
    const dup: LocalElement = {
      ...src,
      id:        `temp-${Date.now()}`,
      x:         src.x + 2,
      y:         src.y + 2,
      sortOrder: elements.length,
      _new:      true,
    };
    setElements(prev => [...prev, dup]);
    setSelectedIds([dup.id]);
    setDirty(true);
  }

  function deleteElement(id: string) {
    setElements(prev => prev.filter(e => e.id !== id));
    setSelectedIds(prev => prev.filter(sid => sid !== id));
    setDirty(true);
  }

  // Alt+drag: el original vuelve a su posición y se crea una copia donde se soltó
  function altDuplicateElement(id: string, x: number, y: number) {
    const src = elements.find(e => e.id === id);
    if (!src) return;
    const dup: LocalElement = { ...src, id: `temp-${Date.now()}`, x, y, sortOrder: elements.length, _new: true };
    setElements(prev => [...prev, dup]);
    setSelectedIds([dup.id]);
    setDirty(true);
  }


  // ── Zoom centrado en cursor — listener nativo non-passive (React no soporta preventDefault en onWheel) ──
  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    // Alias no-null para que TypeScript lo acepte dentro del closure
    const areaEl: HTMLDivElement = area;
    function onWheelNative(e: WheelEvent) {
      e.preventDefault();
      const wrap = canvasWrapRef.current;
      if (!wrap) return;
      const z       = zoomRef.current;
      const delta   = e.deltaY < 0 ? 0.5 : -0.5;
      const newZoom = Math.max(0.5, Math.min(6, +(z + delta).toFixed(1)));
      if (newZoom === z) return;
      zoomRef.current = newZoom; // actualización inmediata para scroll rápido
      const areaRect = areaEl.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const cmx = (e.clientX - wrapRect.left) / (MM_TO_PX * z);
      const cmy = (e.clientY - wrapRect.top)  / (MM_TO_PX * z);
      const wrapLeft = wrapRect.left - areaRect.left + areaEl.scrollLeft;
      const wrapTop  = wrapRect.top  - areaRect.top  + areaEl.scrollTop;
      setZoom(newZoom);
      requestAnimationFrame(() => {
        areaEl.scrollLeft = Math.max(0, wrapLeft + cmx * MM_TO_PX * newZoom - (e.clientX - areaRect.left));
        areaEl.scrollTop  = Math.max(0, wrapTop  + cmy * MM_TO_PX * newZoom - (e.clientY - areaRect.top));
      });
    }
    areaEl.addEventListener("wheel", onWheelNative, { passive: false });
    return () => areaEl.removeEventListener("wheel", onWheelNative);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Ctrl/Cmd + = / + / - / 0 → zoom
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setZoom(z => +(Math.min(6, z + 0.5).toFixed(1)));
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          setZoom(z => +(Math.max(0.5, z - 0.5).toFixed(1)));
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          setZoom(2.5);
          return;
        }
      }

      // Escape → deseleccionar todo
      if (e.key === "Escape") { setSelectedIds([]); return; }

      // Delete / Backspace → eliminar todos los seleccionados
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
        setSelectedIds([]);
        setDirty(true);
        return;
      }

      // Flechas → mover seleccionados (0.5mm / 5mm con Shift)
      if (selectedIds.length > 0 && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        const dy = e.key === "ArrowDown"  ? step : e.key === "ArrowUp"   ? -step : 0;
        setElements(prev => prev.map(el => {
          if (!selectedIds.includes(el.id)) return el;
          return {
            ...el,
            x: clamp(el.x + dx, 0, parseFloat(String(template.widthMm))  - el.width),
            y: clamp(el.y + dy, 0, parseFloat(String(template.heightMm)) - el.height),
          };
        }));
        setDirty(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, template.widthMm, template.heightMm]);

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await labelTemplatesApi.replaceElements(
        template.id,
        elements.map(localToRowPayload)
      );
      if (updated) {
        setTemplate(updated);
        setElements(updated.elements.map(rowToLocal));
        onSaved(updated);
      }
      setDirty(false);
      toast.success("Plantilla guardada.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const canvasW = parseFloat(template.widthMm);
  const canvasH = parseFloat(template.heightMm);

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: "100dvh" }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-border bg-surface flex-shrink-0 overflow-x-auto" style={{ minHeight: 52 }}>

        {/* ── Grupo 1: Navegación ── */}
        <div className="flex items-center gap-2.5 px-3 self-stretch border-r border-border">
          <TPButton
            variant="ghost"
            onClick={onBack}
            className="h-8 w-8 p-0 flex-shrink-0"
            title="Volver"
          >
            <ArrowLeft size={15} />
          </TPButton>
          <div className="hidden md:flex flex-col min-w-0 max-w-[180px] gap-0.5">
            <span className="text-[13px] font-semibold text-text truncate leading-tight tracking-tight">{template.name}</span>
            <span className="text-[10px] tabular-nums leading-none opacity-50 text-text">
              {template.widthMm}×{template.heightMm} mm · {template.dpi} dpi
            </span>
            <button
              onClick={() => setPrinterModalOpen(true)}
              title="Configurar impresora predeterminada"
              className={cn(
                "flex items-center gap-1 rounded px-1 -mx-1 text-left transition",
                template.defaultPrinterProfile
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted hover:text-text"
              )}
            >
              <Printer size={9} className="shrink-0" />
              <span className="text-[10px] truncate leading-none">
                {template.defaultPrinterProfile
                  ? template.defaultPrinterProfile.name
                  : "Sin impresora"}
              </span>
            </button>
          </div>
        </div>

        {/* ── Grupo 2: Insertar elementos ── */}
        <div className="flex items-center gap-1 px-3 border-r border-border" style={{ background: "var(--surface2)" }}>
          {(["TEXT", "BARCODE", "QR", "LINE"] as LabelElementType[]).map(type => (
            <TPButton
              key={type}
              variant="ghost"
              title={`Agregar ${ELEMENT_TYPE_LABELS[type]}`}
              onClick={() => addElement(type)}
              className={cn(
                "h-8 gap-1.5 px-2.5 border text-[11px] font-medium flex-shrink-0 rounded-md",
                ELEMENT_TYPE_COLORS[type]
              )}
            >
              {type === "TEXT"    && <Type      size={12} />}
              {type === "BARCODE" && <ScanLine  size={12} />}
              {type === "QR"      && <QrCode    size={12} />}
              {type === "LINE"    && <Minimize2 size={12} />}
              <span className="hidden xl:inline">{ELEMENT_TYPE_LABELS[type]}</span>
            </TPButton>
          ))}
        </div>

        {/* ── Grupo 3: Canvas — Grid + Snap ── */}
        <div className="flex items-center gap-2 px-3 flex-shrink-0">

          {/* ─ Grid ─ */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text opacity-35 select-none leading-none">
              Grid
            </span>
            <TPButton
              variant="ghost"
              title={showGrid ? "Ocultar grilla de referencia" : "Mostrar grilla de referencia"}
              onClick={() => setShowGrid(g => !g)}
              className={cn(
                "h-7 w-7 p-0 rounded-md border flex-shrink-0",
                showGrid
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border text-muted hover:text-text"
              )}
            >
              <Grid size={13} />
            </TPButton>
            <div
              className={cn(
                "flex rounded-md border border-border overflow-hidden flex-shrink-0 transition-opacity duration-150",
                !showGrid && "opacity-40 pointer-events-none"
              )}
            >
              {GRID_OPTIONS.map(o => (
                <TPButton
                  key={o.value}
                  variant="ghost"
                  onClick={() => setGridMm(o.value)}
                  title={`Grilla de ${o.label}`}
                  className={cn(
                    "h-7 px-2 text-[10px] font-medium rounded-none border-0 border-r border-border last:border-r-0",
                    showGrid && gridMm === o.value
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted hover:text-text"
                  )}
                >
                  {o.label}
                </TPButton>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-border flex-shrink-0" />

          {/* ─ Snap ─ */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text opacity-35 select-none leading-none">
              Snap
            </span>
            <div className="flex rounded-md border border-border overflow-hidden flex-shrink-0">
              {SNAP_OPTIONS.map(o => (
                <TPButton
                  key={o.value}
                  variant="ghost"
                  onClick={() => setSnapMm(o.value)}
                  title={`Ajustar automáticamente a ${o.label}`}
                  className={cn(
                    "h-7 px-2 text-[10px] font-medium rounded-none border-0 border-r border-border last:border-r-0",
                    snapMm === o.value ? "bg-primary/10 text-primary font-semibold" : "text-muted hover:text-text"
                  )}
                >
                  {o.label}
                </TPButton>
              ))}
            </div>
          </div>

          <div className="w-px h-5 bg-border flex-shrink-0" />

          {/* ─ Área segura ─ */}
          <TPButton
            variant="ghost"
            title={showSafeArea ? "Ocultar área segura de impresión" : `Mostrar área segura (${SAFE_MARGIN_MM}mm)`}
            onClick={() => setShowSafeArea(s => !s)}
            className={cn(
              "h-7 w-7 p-0 rounded-md border flex-shrink-0",
              showSafeArea
                ? "bg-red-50 text-red-500 border-red-200"
                : "border-border text-muted hover:text-text"
            )}
          >
            <Maximize2 size={13} />
          </TPButton>

        </div>

        {/* ── Separador flexible — empuja el bloque derecho al extremo ── */}
        <div className="flex-1 min-w-0" />

        {/* ── Grupo 4: Zoom + Vista + Guardar (bloque derecho fijo, nunca se encima) ── */}
        <div className="flex items-center flex-shrink-0 border-l border-border divide-x divide-border">

          {/* A — Zoom */}
          <div className="flex items-center px-3 py-0">
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <TPButton
                variant="ghost"
                className="h-7 w-7 p-0 rounded-none border-r border-border text-muted hover:text-text"
                title="Reducir zoom (Ctrl+scroll)"
                onClick={() => setZoom(z => +(Math.max(0.5, z - 0.5).toFixed(1)))}
              >
                <ZoomOut size={12} />
              </TPButton>
              <span className="text-[11px] w-12 text-center tabular-nums font-semibold select-none text-text opacity-55 font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <TPButton
                variant="ghost"
                className="h-7 w-7 p-0 rounded-none border-l border-border text-muted hover:text-text"
                title="Aumentar zoom (Ctrl+scroll)"
                onClick={() => setZoom(z => +(Math.min(6, z + 0.5).toFixed(1)))}
              >
                <ZoomIn size={12} />
              </TPButton>
            </div>
          </div>

          {/* B — Preview + Muestra */}
          <div className="flex items-center gap-2 px-3">
            <TPButton
              variant="ghost"
              onClick={() => setPreviewMode(m => !m)}
              className={cn(
                "h-8 px-2.5 text-[11px] font-medium rounded-md flex-shrink-0 border",
                previewMode
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border text-muted hover:bg-surface2 hover:text-text"
              )}
              title={previewMode ? "Salir del preview" : "Ver sin overlays de edición"}
            >
              <Layers size={13} />
              <span className="hidden lg:inline">{previewMode ? "Editar" : "Preview"}</span>
            </TPButton>

            <TPButton
              variant="ghost"
              onClick={() => setPreviewOpen(true)}
              className="h-8 px-2.5 text-[11px] font-medium rounded-md border border-border flex-shrink-0 text-muted hover:bg-surface2 hover:text-text"
              title="Vista previa con datos de muestra"
            >
              <Eye size={13} />
              <span className="hidden lg:inline">Muestra</span>
            </TPButton>
          </div>

          {/* C — Guardar */}
          <div className="flex items-center gap-3 px-3">
            {dirty && (
              <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-amber-600 whitespace-nowrap leading-none">Sin guardar</span>
              </div>
            )}
            <TPButton
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!dirty}
              iconLeft={<Save size={13} />}
              className="h-8 px-4 text-[12px] font-semibold"
              title="Guardar cambios (Ctrl+S)"
            >
              Guardar
            </TPButton>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Canvas area ──────────────────────────────────────────────────── */}
        <div
          ref={canvasAreaRef}
          className="flex-1 overflow-auto"
          style={{
            background: "#e2e8f0",
            backgroundImage: "radial-gradient(circle,#00000014 1px,transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          {/* Padding interior + centrado */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", padding:"40px", minWidth:"max-content" }}>

            {/* Fila 1: esquina + regla X — sticky top (se queda visible al hacer scroll vertical) */}
            <div style={{ display:"flex", flexShrink:0, position:"sticky", top:0, zIndex:10, background:"#e2e8f0" }}>
              {/* Esquina — sticky left también para que el cuadrado siempre esté en la intersección */}
              <div style={{ width:RULER_SIZE, height:RULER_SIZE, flexShrink:0, background:"#f1f5f9", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0", position:"sticky", left:0, zIndex:11 }} />
              <Ruler axis="x" lengthMm={canvasW} zoom={zoom} cursorMm={cursorMm?.x ?? null} />
            </div>

            {/* Fila 2: regla Y + canvas */}
            <div style={{ display:"flex", flexShrink:0 }}>
              {/* Regla Y — sticky left (se queda visible al hacer scroll horizontal) */}
              <div style={{ position:"sticky", left:0, zIndex:9, flexShrink:0 }}>
                <Ruler axis="y" lengthMm={canvasH} zoom={zoom} cursorMm={cursorMm?.y ?? null} />
              </div>
              <div ref={canvasWrapRef}>
                <LabelCanvas
                  template={{
                    widthMm:  parseFloat(template.widthMm),
                    heightMm: parseFloat(template.heightMm),
                    bgColor:  template.bgColor || "#ffffff",
                  }}
                  elements={elements}
                  selectedIds={selectedIds}
                  zoom={zoom}
                  snapMm={snapMm}
                  gridMm={gridMm}
                  showGrid={showGrid}
                  showSafeArea={showSafeArea}
                  previewMode={previewMode}
                  onSelect={setSelectedIds}
                  onUpdate={updateEl}
                  onAltDuplicate={altDuplicateElement}
                  onCursorMove={(x, y) => setCursorMm(x != null && y != null ? { x, y } : null)}
                />
              </div>
            </div>

          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div className="w-[320px] flex-shrink-0 border-l border-border bg-surface flex flex-col min-h-0">

          {/* Element list or properties */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {multiSelect ? (
              /* ── Multi-selección ── */
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text opacity-40">
                  {selectedIds.length} elementos seleccionados
                </p>
                <div className="space-y-1">
                  {selectedIds.map(id => {
                    const el = elements.find(e => e.id === id);
                    if (!el) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-xs">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                          el.type === "TEXT"    && "bg-blue-500",
                          el.type === "BARCODE" && "bg-violet-500",
                          el.type === "QR"      && "bg-green-500",
                          el.type === "IMAGE"   && "bg-amber-500",
                          el.type === "LINE"    && "bg-gray-400",
                        )} />
                        <span className="flex-1 truncate font-medium text-text">{ELEMENT_TYPE_LABELS[el.type]}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text opacity-40 leading-snug">
                  Usá flechas para mover el grupo. Shift+click para agregar/quitar.
                </p>
                <TPButton
                  variant="ghost"
                  className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 text-xs gap-1.5 border border-red-200 rounded-lg"
                  onClick={() => {
                    setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
                    setSelectedIds([]);
                    setDirty(true);
                  }}
                >
                  <Trash2 size={12} /> Eliminar seleccionados
                </TPButton>
              </div>
            ) : selectedEl ? (
              /* ── Selección simple ── */
              <>
                <PanelSection title="Alinear">
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ["←", "Alinear borde izquierdo",  { x: 0 }],
                      ["⇔", "Centrar horizontalmente",  { x: Math.max(0, (canvasW - selectedEl.width) / 2) }],
                      ["→", "Alinear borde derecho",     { x: Math.max(0, canvasW - selectedEl.width) }],
                      ["↑", "Alinear borde superior",    { y: 0 }],
                      ["⇕", "Centrar verticalmente",     { y: Math.max(0, (canvasH - selectedEl.height) / 2) }],
                      ["↓", "Alinear borde inferior",    { y: Math.max(0, canvasH - selectedEl.height) }],
                    ] as [string, string, Partial<LocalElement>][]).map(([icon, tip, patch]) => (
                      <TPButton
                        key={tip}
                        variant="ghost"
                        title={tip}
                        onClick={() => updateEl(selectedEl.id, patch)}
                        className="h-8 p-0 text-base font-mono text-muted border border-border rounded-md hover:bg-surface2 hover:text-text"
                      >
                        {icon}
                      </TPButton>
                    ))}
                  </div>
                </PanelSection>

                <ElementPanel
                  el={selectedEl}
                  onChange={(patch) => updateEl(selectedEl.id, patch)}
                  onDelete={() => deleteElement(selectedEl.id)}
                  onDuplicate={() => duplicateElement(selectedEl.id)}
                />
              </>
            ) : (
              /* ── Sin selección ── */
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text opacity-40">
                    Capas ({elements.length})
                  </p>
                </div>
                {elements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <div className="w-10 h-10 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                      <Type size={18} className="text-muted opacity-40" />
                    </div>
                    <p className="text-[11px] text-text opacity-35 leading-snug max-w-[150px]">
                      Sin elementos. Usá los botones de la barra para agregar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...elements]
                      .sort((a, b) => b.sortOrder - a.sortOrder)
                      .map(el => (
                        <button
                          key={el.id}
                          onClick={(e) => {
                            if (e.shiftKey) {
                              setSelectedIds(prev => prev.includes(el.id) ? prev.filter(id => id !== el.id) : [...prev, el.id]);
                            } else {
                              setSelectedIds([el.id]);
                            }
                          }}
                          className={cn(
                            "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-colors",
                            selectedIds.includes(el.id)
                              ? "border-primary/40 bg-primary/8 text-text"
                              : "border-transparent hover:border-border hover:bg-surface2"
                          )}
                        >
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                            el.type === "TEXT"    && "bg-blue-500",
                            el.type === "BARCODE" && "bg-violet-500",
                            el.type === "QR"      && "bg-green-500",
                            el.type === "IMAGE"   && "bg-amber-500",
                            el.type === "LINE"    && "bg-gray-400",
                          )} />
                          <span className="flex-1 truncate font-semibold text-[11px] text-text">{ELEMENT_TYPE_LABELS[el.type]}</span>
                          <span className="truncate max-w-[56px] text-[10px] text-text opacity-35 font-mono">{el.fieldKey || el.label || "—"}</span>
                          {!el.visible && <EyeOff size={10} className="flex-shrink-0 text-muted opacity-50" />}
                        </button>
                      ))
                    }
                  </div>
                )}
                <p className="text-[10px] leading-snug text-text opacity-30 text-center">
                  Shift+click para seleccionar múltiples
                </p>
              </>
            )}
          </div>

          {/* Footer info */}
          <div className="px-4 py-3 border-t border-border flex-shrink-0" style={{ background: "var(--surface2)" }}>
            {selectedEl ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between col-span-2">
                  <span className="text-[10px] text-text opacity-35 font-medium">Posición</span>
                  <span className="text-[10px] font-mono font-semibold text-text opacity-60">{selectedEl.x.toFixed(1)}, {selectedEl.y.toFixed(1)} mm</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-[10px] text-text opacity-35 font-medium">Tamaño</span>
                  <span className="text-[10px] font-mono font-semibold text-text opacity-60">{selectedEl.width.toFixed(1)} × {selectedEl.height.toFixed(1)} mm</span>
                </div>
                {selectedEl.rotation !== 0 && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-[10px] text-text opacity-35 font-medium">Rotación</span>
                    <span className="text-[10px] font-mono font-semibold text-text opacity-60">{selectedEl.rotation}°</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[10px] text-text opacity-35 font-medium">Etiqueta</span>
                  <span className="text-[10px] font-mono font-semibold text-text opacity-60">{template.widthMm}×{template.heightMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-text opacity-35 font-medium">DPI / Capas</span>
                  <span className="text-[10px] font-mono font-semibold text-text opacity-60">{template.dpi} dpi · {elements.length}</span>
                </div>
                {cursorMm && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-text opacity-35 font-medium">Cursor</span>
                    <span className="text-[10px] font-mono font-semibold text-text opacity-60">{cursorMm.x.toFixed(1)}, {cursorMm.y.toFixed(1)} mm</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nota: separación plantilla / impresora */}
          <div className="px-3 pb-3 text-[10px] text-blue-600/80 leading-snug border-t border-blue-100 bg-blue-50/60 flex-shrink-0 pt-2">
            <span className="font-semibold">Este editor diseña la etiqueta.</span><br />
            Márgenes, columnas, offset y gaps de impresora se configuran en la pestaña{" "}
            <span className="font-medium">Impresoras</span> y se aplican al imprimir.
          </div>
        </div>
      </div>

      {/* Preview modal */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        template={template}
        elements={elements}
      />

      {/* Assign printer modal */}
      <AssignPrinterModal
        open={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        template={template}
        printers={printers}
        onSave={(updated) => {
          setTemplate(updated);
          onSaved(updated);
        }}
      />
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ t, onEdit, onDelete, onDuplicate, onAssignPrinter }: {
  t: LabelTemplateRow;
  onEdit:           () => void;
  onDelete:         () => void;
  onDuplicate:      () => void;
  onAssignPrinter:  () => void;
}) {
  const elCount = t.elements?.length ?? 0;
  const zoom    = 1;
  const printer = t.defaultPrinterProfile;

  return (
    <div className={cn(
      "group relative rounded-xl border border-border bg-surface hover:border-primary/40 transition overflow-hidden",
      !t.isActive && "opacity-60"
    )}>
      {/* Mini preview canvas */}
      <div
        className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer flex items-center justify-center"
        style={{ height: 90 }}
        onClick={onEdit}
      >
        <div style={{
          position:        "relative",
          width:           `${mm(parseFloat(t.widthMm), zoom)}px`,
          height:          `${mm(parseFloat(t.heightMm), zoom)}px`,
          backgroundColor: t.bgColor || "#fff",
          border:          "1px solid #cbd5e180",
          boxShadow:       "0 1px 6px rgba(0,0,0,0.12)",
          overflow:        "hidden",
          maxWidth:        "95%",
        }}>
          {(t.elements ?? []).filter(e => e.visible).map(el => {
            const local = rowToLocal(el);
            return (
              <div
                key={el.id}
                style={{
                  position: "absolute",
                  left:     `${mm(local.x, zoom)}px`,
                  top:      `${mm(local.y, zoom)}px`,
                  width:    `${mm(local.width, zoom)}px`,
                  height:   `${mm(local.height, zoom)}px`,
                }}
              >
                <ElementContent el={local} zoom={zoom} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Info + actions */}
      <div className="px-3 pt-2 pb-2">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text truncate">{t.name}</p>
            <p className="text-[11px] text-muted tabular-nums">
              {t.widthMm}×{t.heightMm}mm · {elCount} elemento{elCount !== 1 ? "s" : ""}
            </p>
          </div>
          {t.isDefault && (
            <span className="shrink-0 text-[10px] bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded-full">
              Default
            </span>
          )}
        </div>

        {/* Printer badge — always visible */}
        <button
          onClick={(e) => { e.stopPropagation(); onAssignPrinter(); }}
          title="Configurar impresora predeterminada"
          className={cn(
            "w-full flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition",
            printer
              ? "border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-dashed border-border text-muted hover:border-primary/30 hover:text-text"
          )}
        >
          <Printer size={10} className="shrink-0" />
          <span className="truncate">{printer ? printer.name : "Sin impresora asignada"}</span>
          {!printer && <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide opacity-50 shrink-0">Asignar</span>}
        </button>

        {/* Hover actions */}
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
          <TPButton variant="ghost" onClick={onEdit} className="text-xs px-2 py-1 gap-1 flex-1 justify-center">
            <Pencil size={10} /> Editar
          </TPButton>
          <TPButton variant="ghost" onClick={onDuplicate} title="Duplicar plantilla" className="text-xs px-2 py-1">
            <Copy size={10} />
          </TPButton>
          <TPButton variant="ghost" onClick={onDelete} title="Eliminar plantilla" className="text-xs px-2 py-1 text-red-500 hover:text-red-600">
            <Trash2 size={10} />
          </TPButton>
        </div>
      </div>
    </div>
  );
}

// ─── AssignPrinterModal ───────────────────────────────────────────────────────

const PRINTER_TYPE_COLORS: Record<PrinterType, string> = {
  THERMAL: "bg-amber-500/15 text-amber-700 border-amber-300/50",
  ZEBRA:   "bg-violet-500/15 text-violet-700 border-violet-300/50",
  A4:      "bg-blue-500/15 text-blue-700 border-blue-300/50",
  INKJET:  "bg-cyan-500/15 text-cyan-700 border-cyan-300/50",
};

function AssignPrinterModal({
  open, onClose, template, printers, onSave, onCreatePrinter,
}: {
  open:              boolean;
  onClose:           () => void;
  template:          LabelTemplateRow;
  printers:          PrinterProfileRow[];
  onSave:            (updated: LabelTemplateRow) => void;
  onCreatePrinter?:  () => void;
}) {
  const [printerId, setPrinterId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

  // Sincronizar con la plantilla actual al abrir
  useEffect(() => {
    if (open) setPrinterId(template.defaultPrinterProfileId ?? null);
  }, [open, template.defaultPrinterProfileId]);

  const hasChange = printerId !== (template.defaultPrinterProfileId ?? null);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await labelTemplatesApi.update(template.id, {
        defaultPrinterProfileId: printerId,
      });
      onSave(updated);
      onClose();
      toast.success(printerId ? "Impresora asignada." : "Impresora quitada de la plantilla.");
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asignar impresora"
      maxWidth="sm"
    >
      <div className="space-y-4">

        {/* Plantilla info */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border" style={{ background: "var(--surface2)" }}>
          <Tag size={15} className="text-muted shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-text truncate">{template.name}</p>
            <p className="text-[11px] text-muted tabular-nums">{template.widthMm}×{template.heightMm} mm · {template.dpi} dpi</p>
          </div>
        </div>

        {printers.length === 0 ? (

          /* ── Sin impresoras: estado vacío accionable ── */
          <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
              <Printer size={26} className="text-muted opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-semibold text-text">Sin impresoras configuradas</p>
              <p className="text-sm text-muted leading-relaxed max-w-[260px]">
                Primero creá un perfil de impresora y luego podrás asignarlo a esta etiqueta.
              </p>
            </div>
            {onCreatePrinter ? (
              <TPButton
                variant="primary"
                onClick={() => { onClose(); onCreatePrinter(); }}
                className="gap-2"
              >
                <Printer size={14} />
                Crear impresora
              </TPButton>
            ) : (
              <p className="text-xs text-muted border border-border rounded-lg px-3 py-2">
                Salí del editor y creá una impresora desde la pestaña <strong>Impresoras</strong>.
              </p>
            )}
          </div>

        ) : (

          /* ── Con impresoras: lista seleccionable ── */
          <div className="space-y-1.5">

            {/* Opción: sin impresora */}
            <button
              type="button"
              onClick={() => setPrinterId(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                printerId === null
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-surface2"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors",
                printerId === null ? "border-primary/40" : "border-border"
              )}>
                <Printer size={14} className={printerId === null ? "text-primary opacity-50" : "text-muted opacity-30"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[12px] font-medium leading-tight",
                  printerId === null ? "text-primary" : "text-muted"
                )}>Sin impresora predeterminada</p>
                <p className="text-[10px] text-muted opacity-60 leading-tight mt-0.5">
                  Se seleccionará al momento de imprimir
                </p>
              </div>
              {printerId === null && (
                <Check size={14} className="text-primary flex-shrink-0" />
              )}
            </button>

            {/* Lista de impresoras */}
            {printers.map(p => {
              const isSelected = printerId === p.id;
              const typeColor  = PRINTER_TYPE_COLORS[p.type as PrinterType] ?? "bg-gray-500/15 text-gray-700";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrinterId(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-surface2"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
                    isSelected ? "bg-primary/10 border-primary/30" : "border-border"
                  )}>
                    <Printer size={15} className={isSelected ? "text-primary" : "text-muted"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-semibold text-text truncate leading-tight">{p.name}</p>
                      {p.isDefault && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
                        typeColor
                      )}>
                        {PRINTER_TYPE_LABELS[p.type as PrinterType]}
                      </span>
                      <span className="text-[11px] text-muted tabular-nums">
                        {parseFloat(String(p.pageWidthMm)).toFixed(0)}×{parseFloat(String(p.pageHeightMm)).toFixed(0)} mm
                      </span>
                      <span className="text-[11px] text-muted tabular-nums">
                        {p.dpi} dpi
                      </span>
                      {p.columns > 1 && (
                        <span className="text-[11px] text-muted">{p.columns} col.</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check size={14} className="text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Acciones */}
        <div className={cn(
          "flex gap-2 pt-1",
          printers.length === 0 ? "justify-center" : "justify-end"
        )}>
          <TPButton variant="ghost" onClick={onClose}>
            {printers.length === 0 ? "Cerrar" : "Cancelar"}
          </TPButton>
          {printers.length > 0 && (
            <TPButton
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!hasChange}
            >
              Guardar
            </TPButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── NewTemplateModal ─────────────────────────────────────────────────────────

// Metadata de display para cada preset (paralelo a PRESET_TEMPLATES por índice)
const PRESET_DISPLAY: {
  description: string;
  badge?:      string;
  badgeColor?: string;
}[] = [
  { description: "Formato estándar",  badge: "Precargada", badgeColor: "bg-violet-500/15 text-violet-600 border-violet-300/40" },
  { description: "Formato compacto",  badge: "Precargada", badgeColor: "bg-violet-500/15 text-violet-600 border-violet-300/40" },
  { description: "Formato reducido",  badge: "Precargada", badgeColor: "bg-violet-500/15 text-violet-600 border-violet-300/40" },
];

// Tarjeta de preset individual
function PresetCard({
  preset, meta, selected, onClick,
}: {
  preset:   (typeof PRESET_TEMPLATES)[number];
  meta:     (typeof PRESET_DISPLAY)[number];
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition",
        selected
          ? "border-primary bg-primary/8 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-surface2"
      )}
    >
      {meta.badge && (
        <span className={cn(
          "absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
          meta.badgeColor ?? "bg-primary/10 text-primary border-primary/30"
        )}>
          {meta.badge}
        </span>
      )}
      <Tag size={18} className={cn("mb-0.5", selected ? "text-primary" : "text-muted")} />
      <span className={cn("text-xs font-semibold leading-tight", selected ? "text-primary" : "text-text")}>
        {preset.name}
      </span>
      <span className="text-[11px] font-mono text-muted/80">
        {preset.widthMm}×{preset.heightMm} mm
      </span>
      <span className="text-[11px] text-muted leading-tight">
        {meta.description}
      </span>
    </button>
  );
}

function NewTemplateModal({ open, onClose, onCreate, printers }: {
  open:     boolean;
  onClose:  () => void;
  onCreate: (t: LabelTemplateRow) => void;
  printers: PrinterProfileRow[];
}) {
  const [name,                   setName]                   = useState("");
  const [widthMm,                setWidthMm]                = useState<number | null>(null);
  const [heightMm,               setHeightMm]               = useState<number | null>(null);
  const [dpi,                    setDpi]                    = useState<number | null>(203);
  const [busy,                   setBusy]                   = useState(false);
  const [defaultPrinterId,       setDefaultPrinterId]       = useState<string | null>(null);
  // 0..N = índice en PRESET_TEMPLATES
  const [usePreset, setUsePreset] = useState<number | null>(0);

  useEffect(() => {
    if (!open) {
      setName(""); setWidthMm(null); setHeightMm(null); setDpi(203); setUsePreset(0);
      setDefaultPrinterId(null);
    }
  }, [open]);

  function applyPreset(idx: number) {
    const p = PRESET_TEMPLATES[idx];
    if (!p) return;
    setName(p.name);
    setWidthMm(p.widthMm);
    setHeightMm(p.heightMm);
    setDpi(p.dpi ?? 203);
    setUsePreset(idx);
  }

  function clearToManual() {
    setUsePreset(null);
    setName("");
    setWidthMm(null);
    setHeightMm(null);
    setDpi(203);
  }

  async function handleCreate() {
    if (!name.trim())      { toast.error("El nombre es requerido.");          return; }
    if (!widthMm)          { toast.error("El ancho es requerido.");           return; }
    if (!heightMm)         { toast.error("El alto es requerido.");            return; }
    setBusy(true);
    try {
      const t = await labelTemplatesApi.create({
        name:                    name.trim(),
        widthMm,
        heightMm,
        dpi:                     dpi ?? 203,
        orientation:             usePreset !== null ? (PRESET_TEMPLATES[usePreset] as any).orientation ?? "horizontal" : "horizontal",
        defaultPrinterProfileId: defaultPrinterId ?? null,
      });
      if (usePreset !== null && PRESET_TEMPLATES[usePreset]) {
        const preset  = PRESET_TEMPLATES[usePreset];
        const withEls = await labelTemplatesApi.replaceElements(t.id, preset.elements as any);
        onCreate(withEls ?? t);
      } else {
        onCreate(t);
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Nueva plantilla de etiqueta"
      onClose={onClose}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={onClose}><X size={15} />Cancelar</TPButton>
          <TPButton variant="primary" onClick={handleCreate} loading={busy}>
            <Plus size={15} />Crear plantilla
          </TPButton>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Elegí un formato base o cargá una medida personalizada.
        </p>

        {/* ── Bloque A: Formato base ─────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70 mb-2">
            Formato base
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_TEMPLATES.map((p, i) => (
              <PresetCard
                key={i}
                preset={p}
                meta={PRESET_DISPLAY[i] ?? { description: "" }}
                selected={usePreset === i}
                onClick={() => applyPreset(i)}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* ── Bloque B: Configuración inicial ───────────────────────────────── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70 mb-3">
            Configuración inicial
          </p>
          <div className="space-y-3">
            <TPField label="Nombre" required>
              <TPInput
                value={name}
                onChange={setName}
                placeholder={usePreset !== null ? PRESET_TEMPLATES[usePreset]?.name : "Ej: Mi etiqueta"}
              />
            </TPField>

            <div className="grid grid-cols-3 gap-3">
              <TPField label="Ancho (mm)" required>
                <TPNumberInput
                  value={widthMm}
                  onChange={setWidthMm}
                  decimals={1} min={5} max={300}
                  placeholder="58"
                />
              </TPField>
              <TPField label="Alto (mm)" required>
                <TPNumberInput
                  value={heightMm}
                  onChange={setHeightMm}
                  decimals={1} min={5} max={500}
                  placeholder="40"
                />
              </TPField>
              <TPField label="DPI">
                <TPComboFixed
                  value={String(dpi ?? 203)}
                  onChange={(v) => setDpi(Number(v))}
                  options={[
                    { value: "203", label: "203 dpi" },
                    { value: "300", label: "300 dpi" },
                    { value: "96",  label: "96 dpi"  },
                  ]}
                />
              </TPField>
            </div>

            {printers.length > 0 && (
              <TPField label="Impresora predeterminada">
                <TPComboFixed
                  value={defaultPrinterId ?? "__none__"}
                  onChange={(v) => setDefaultPrinterId(v === "__none__" ? null : v)}
                  options={[
                    { value: "__none__", label: "— Sin impresora predeterminada —" },
                    ...printers.map(p => ({ value: p.id, label: p.name + (p.isDefault ? " ★" : "") })),
                  ]}
                />
              </TPField>
            )}

            {/* Info si hay preset con elementos */}
            {usePreset !== null && PRESET_TEMPLATES[usePreset]?.elements?.length > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <Sparkles size={13} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80">
                  Esta plantilla incluye{" "}
                  <strong>{PRESET_TEMPLATES[usePreset].elements.length} elementos</strong>{" "}
                  precargados que podés editar en el diseñador.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── PrinterRow ───────────────────────────────────────────────────────────────

// ─── CalibrationSection ───────────────────────────────────────────────────────

/** Botones de ajuste rápido de offset.
 *  El valor 0 en `steps` actúa como reset absoluto a 0. */
function OffsetNudge({
  value, onChange, steps, min = -20, max = 20,
}: {
  value:    number | null;
  onChange: (v: number | null) => void;
  steps:    readonly number[];
  min?:     number;
  max?:     number;
}) {
  const cur = value ?? 0;
  return (
    <div className="flex flex-wrap gap-0.5 justify-end">
      {steps.map((d, i) => {
        const isReset = d === 0;
        const newVal = isReset
          ? 0
          : Math.max(min, Math.min(max, Math.round((cur + d) * 10) / 10));
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(newVal)}
            className={cn(
              "px-1 py-0.5 text-[9.5px] font-mono font-semibold rounded transition leading-none tabular-nums",
              isReset
                ? "bg-slate-100 hover:bg-slate-200 text-slate-500"
                : "bg-amber-100 hover:bg-amber-200 text-amber-800",
            )}
          >
            {isReset ? "0" : d > 0 ? `+${d}` : String(d)}
          </button>
        );
      })}
    </div>
  );
}

const NUDGE_STEPS_X = [-1, -0.5, 0, +0.5, +1] as const;
const NUDGE_STEPS_Y = [-20, -10, -5, -2, -1, -0.5, 0, +0.5, +1, +2, +5, +10, +20] as const;

/** Mini preview visual del efecto del offset.
 *  El rectángulo interior (contenido impreso) se desplaza respecto al exterior (borde físico). */
function OffsetPreview({ ox, oy, wMm, hMm }: { ox: number; oy: number; wMm: number; hMm: number }) {
  // Escalar a una caja de ~180 × 90px máximo, respetando la proporción
  const MAX_W = 180;
  const MAX_H = 80;
  const aspect = wMm / hMm;
  const bW = aspect >= MAX_W / MAX_H ? MAX_W : Math.round(MAX_H * aspect);
  const bH = aspect >= MAX_W / MAX_H ? Math.round(MAX_W / aspect) : MAX_H;

  // px por mm en esta escala — capear al 70% del box para que siempre sea visible
  const pxPerMm = bW / wMm;
  const rawX  = ox * pxPerMm;
  const rawY  = oy * pxPerMm;
  const capX  = bW * 0.7;
  const capY  = bH * 0.7;
  const shiftX  = Math.round(Math.max(-capX, Math.min(capX, rawX)));
  const shiftY  = Math.round(Math.max(-capY, Math.min(capY, rawY)));
  const isCapped = Math.abs(rawX) > capX || Math.abs(rawY) > capY;

  const cx = bW / 2;
  const cy = bH / 2;

  const isZero = ox === 0 && oy === 0;

  const fmtVal = (v: number) => `${v >= 0 ? "+" : ""}${v}`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center justify-between w-full">
        <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Vista previa del desplazamiento</p>
        <span className="text-[9.5px] font-mono font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
          X: {fmtVal(ox)}mm &nbsp; Y: {fmtVal(oy)}mm
        </span>
      </div>
      <div
        style={{ width: bW, height: bH, position: "relative", flexShrink: 0 }}
        className="rounded overflow-hidden bg-white border border-amber-300/60"
      >
        {/* Zona física de la etiqueta (borde punteado = referencia fija) */}
        <div
          style={{ position: "absolute", inset: 0, border: "1.5px dashed #94a3b8", borderRadius: 2 }}
          title="Borde físico de la etiqueta"
        />

        {/* Contenido impreso desplazado */}
        <div
          style={{
            position: "absolute",
            left:   shiftX,
            top:    shiftY,
            width:  bW,
            height: bH,
            transition: "left 0.15s, top 0.15s",
          }}
        >
          {/* Borde del contenido */}
          <div style={{ position: "absolute", inset: 0, border: `1.5px solid ${isZero ? "#22c55e" : "#f59e0b"}`, borderRadius: 2 }} />
          {/* Cruz horizontal */}
          <div style={{ position: "absolute", left: 0, top: cy - 0.5, width: bW, height: 1, background: isZero ? "#86efac" : "#fbbf24", opacity: 0.8 }} />
          {/* Cruz vertical */}
          <div style={{ position: "absolute", left: cx - 0.5, top: 0, width: 1, height: bH, background: isZero ? "#86efac" : "#fbbf24", opacity: 0.8 }} />
          {/* Marcas esquina */}
          {([[3,0],[3,bH-5],[bW-5,0],[bW-5,bH-5]] as [number,number][]).map(([x,y],i) => (
            <React.Fragment key={i}>
              <div style={{ position:"absolute", left:x, top:y, width:1, height:5, background:"#94a3b8" }} />
              <div style={{ position:"absolute", left:x-2, top:y+2, width:5, height:1, background:"#94a3b8" }} />
            </React.Fragment>
          ))}
        </div>
      </div>
      {isCapped && (
        <p className="text-[9px] text-amber-600 italic text-center">
          Vista reducida — el offset real supera el área del preview
        </p>
      )}
      <p className="text-[9.5px] text-slate-400 text-center">
        {isZero
          ? "Sin desplazamiento — el contenido coincide con el borde físico"
          : [
              ox > 0 ? `Derecha ${ox}mm` : ox < 0 ? `Izquierda ${Math.abs(ox)}mm` : null,
              oy > 0 ? `Abajo ${oy}mm`   : oy < 0 ? `Arriba ${Math.abs(oy)}mm`    : null,
            ].filter(Boolean).join(" · ")
        }
      </p>
    </div>
  );
}

function CalibrationSection({
  offsetX, offsetY, onOffsetX, onOffsetY,
  previewWMm = 58, previewHMm = 40,
  onPrintCalibration,
}: {
  offsetX:              number | null;
  offsetY:              number | null;
  onOffsetX:            (v: number | null) => void;
  onOffsetY:            (v: number | null) => void;
  previewWMm?:          number;
  previewHMm?:          number;
  onPrintCalibration?:  () => void;
}) {
  const [open, setOpen] = useState(false);
  const ox = offsetX ?? 0;
  const oy = offsetY ?? 0;
  const hasOffset = ox !== 0 || oy !== 0;

  return (
    <div className="rounded-xl border border-amber-300/50 bg-amber-50/40 overflow-hidden">

      {/* ── Header / toggle ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-amber-50/60 transition"
      >
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <ScanLine size={13} className="text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800 leading-tight">Calibración física de impresión</p>
          <p className="text-[10.5px] text-amber-600 leading-tight mt-0.5">
            Corregí el desplazamiento entre diseño y etiqueta física
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasOffset ? (
            <span className="text-[10px] bg-amber-500/20 text-amber-800 font-mono font-medium px-1.5 py-0.5 rounded-full tabular-nums">
              X{ox >= 0 ? "+" : ""}{ox} Y{oy >= 0 ? "+" : ""}{oy}
            </span>
          ) : (
            <span className="text-[10px] text-amber-500/70">sin ajuste</span>
          )}
          {open ? <ChevronUp size={13} className="text-amber-600" /> : <ChevronDown size={13} className="text-amber-600" />}
        </div>
      </button>

      {/* ── Contenido colapsable ─────────────────────────────────────────── */}
      {open && (
        <div className="px-3 pb-3 space-y-4 border-t border-amber-200/60">

          {/* Descripción + botón imprimir */}
          <div className="flex items-start justify-between gap-3 pt-3">
            <p className="text-[11.5px] text-amber-800 leading-relaxed flex-1">
              Corregí el desfasaje entre diseño y papel{" "}
              <span className="font-semibold">sin modificar tus plantillas</span>.
            </p>
            {onPrintCalibration && (
              <button
                type="button"
                onClick={onPrintCalibration}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-semibold transition whitespace-nowrap flex-shrink-0"
              >
                <Printer size={11} />
                Imprimir prueba
              </button>
            )}
          </div>

          {/* ── Offset X ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-amber-800">Offset X (mm)</label>
              <OffsetNudge value={offsetX} onChange={onOffsetX} steps={NUDGE_STEPS_X} min={-20} max={20} />
            </div>
            <TPNumberInput value={offsetX} onChange={onOffsetX} decimals={1} min={-20} max={20} />
            <p className="text-[10px] text-amber-600">
              <span className="text-emerald-700 font-medium">+ positivo</span> → derecha &nbsp;·&nbsp;
              <span className="text-red-600 font-medium">− negativo</span> → izquierda
            </p>
          </div>

          {/* ── Offset Y ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-amber-800">Offset Y (mm)</label>
              <OffsetNudge value={offsetY} onChange={onOffsetY} steps={NUDGE_STEPS_Y} min={-100} max={100} />
            </div>
            <TPNumberInput value={offsetY} onChange={onOffsetY} decimals={1} min={-100} max={100} />
            <p className="text-[10px] text-amber-600">
              <span className="text-emerald-700 font-medium">+ positivo</span> → abajo &nbsp;·&nbsp;
              <span className="text-red-600 font-medium">− negativo</span> → arriba
            </p>
          </div>

          {/* ── Preview en vivo ── */}
          <div className="rounded-lg bg-white/70 border border-amber-200/50 p-3">
            <OffsetPreview ox={ox} oy={oy} wMm={previewWMm} hMm={previewHMm} />
          </div>

          {/* Cómo calibrar */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">Cómo calibrar</p>
            <ol className="space-y-1">
              {[
                "Hacé clic en \"Imprimir prueba\" e imprimí la etiqueta de calibración",
                "Compará el borde impreso con el borde físico de la etiqueta",
                "Medí el desplazamiento en mm",
                "Ingresá el valor opuesto (usá los botones ±0.5 / ±1 para ajuste rápido)",
                "Volvé a imprimir y repetí hasta alinear",
              ].map((step, i) => (
                <li key={i} className="flex gap-2 text-[10.5px] text-amber-800">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-700 font-bold text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Ejemplos */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">Ejemplos</p>
            <div className="rounded-lg bg-white/60 border border-amber-200/50 divide-y divide-amber-100/80">
              {[
                { problem: "Salió 2 mm a la izquierda",  fix: "Offset X = +2"   },
                { problem: "Salió 3 mm a la derecha",    fix: "Offset X = −3"   },
                { problem: "Salió 1 mm más abajo",       fix: "Offset Y = −1"   },
                { problem: "Salió 1.5 mm más arriba",    fix: "Offset Y = +1.5" },
              ].map((ex, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1.5 gap-2">
                  <span className="text-[10.5px] text-amber-700">{ex.problem}</span>
                  <span className="text-[10.5px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {ex.fix}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Importante */}
          <div className="rounded-lg bg-amber-100/60 border border-amber-200/60 p-2.5 space-y-1">
            <p className="text-[10.5px] font-semibold text-amber-800">Importante</p>
            {[
              "Estos ajustes se aplican a todas las plantillas que usen esta impresora.",
              "No es necesario mover elementos dentro del diseño.",
              "Una vez calibrado, el sistema queda alineado automáticamente.",
            ].map((item, i) => (
              <p key={i} className="text-[10.5px] text-amber-700 flex gap-1.5 items-start">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                {item}
              </p>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── PrinterRow ───────────────────────────────────────────────────────────────

function PrinterRow({ p, onEdit, onDelete, onCalibrate }: {
  p:            PrinterProfileRow;
  onEdit:       () => void;
  onDelete:     () => void;
  onCalibrate:  () => void;
}) {
  const offX = parseFloat(p.offsetXMm);
  const offY = parseFloat(p.offsetYMm);
  const hasOffset = offX !== 0 || offY !== 0;

  return (
    <div className={cn(
      "group flex items-center gap-3 p-3 rounded-xl border border-border bg-surface hover:border-primary/30 transition",
      !p.isActive && "opacity-60"
    )}>
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Printer size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-text truncate">{p.name}</p>
          {p.isDefault && (
            <span className="text-[10px] bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded-full">Default</span>
          )}
          {hasOffset && (
            <span className="text-[10px] bg-amber-500/15 text-amber-700 font-medium px-1.5 py-0.5 rounded-full tabular-nums">
              X{offX >= 0 ? "+" : ""}{offX} Y{offY >= 0 ? "+" : ""}{offY}mm
            </span>
          )}
        </div>
        <p className="text-xs text-muted tabular-nums">
          {PRINTER_TYPE_LABELS[p.type]} · {p.pageWidthMm}×{p.pageHeightMm}mm · {p.columns} col
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <TPButton variant="ghost" onClick={onCalibrate} className="text-xs px-2 py-1 text-amber-600" title="Imprimir prueba de calibración">
          <ScanLine size={11} />
        </TPButton>
        <TPButton variant="ghost" onClick={onEdit}   className="text-xs px-2 py-1"><Pencil size={11} /></TPButton>
        <TPButton variant="ghost" onClick={onDelete} className="text-xs px-2 py-1 text-red-500"><Trash2 size={11} /></TPButton>
      </div>
    </div>
  );
}

// ─── PrinterModal ─────────────────────────────────────────────────────────────

function PrinterModal({ open, profile, onClose, onSave }: {
  open:    boolean;
  profile: PrinterProfileRow | null;
  onClose: () => void;
  onSave:  () => void;
}) {
  const [name,      setName]      = useState(profile?.name ?? "");
  const [type,      setType]      = useState<PrinterType>(profile?.type ?? "THERMAL");
  const [cols,      setCols]      = useState<number | null>(profile?.columns ?? 1);
  const [pageW,     setPageW]     = useState<number | null>(profile ? parseFloat(profile.pageWidthMm)  : 210);
  const [pageH,     setPageH]     = useState<number | null>(profile ? parseFloat(profile.pageHeightMm) : 297);
  const [mTop,      setMTop]      = useState<number | null>(profile ? parseFloat(profile.marginTopMm)    : 5);
  const [mLeft,     setMLeft]     = useState<number | null>(profile ? parseFloat(profile.marginLeftMm)   : 5);
  const [mRight,    setMRight]    = useState<number | null>(profile ? parseFloat(profile.marginRightMm)  : 5);
  const [mBottom,   setMBottom]   = useState<number | null>(profile ? parseFloat(profile.marginBottomMm) : 5);
  const [gapH,      setGapH]      = useState<number | null>(profile ? parseFloat(profile.gapHMm) : 2);
  const [gapV,      setGapV]      = useState<number | null>(profile ? parseFloat(profile.gapVMm) : 2);
  const [offsetX,   setOffsetX]   = useState<number | null>(profile ? parseFloat(profile.offsetXMm) : 0);
  const [offsetY,   setOffsetY]   = useState<number | null>(profile ? parseFloat(profile.offsetYMm) : 0);
  const [isDefault, setIsDefault] = useState(profile?.isDefault ?? false);
  const [busy,      setBusy]      = useState(false);
  const [usePreset, setUsePreset] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setType(profile?.type ?? "THERMAL");
    setCols(profile?.columns ?? 1);
    setPageW(profile  ? parseFloat(profile.pageWidthMm)  : 210);
    setPageH(profile  ? parseFloat(profile.pageHeightMm) : 297);
    setMTop(profile   ? parseFloat(profile.marginTopMm)    : 5);
    setMLeft(profile  ? parseFloat(profile.marginLeftMm)   : 5);
    setMRight(profile ? parseFloat(profile.marginRightMm)  : 5);
    setMBottom(profile? parseFloat(profile.marginBottomMm) : 5);
    setGapH(profile   ? parseFloat(profile.gapHMm) : 2);
    setGapV(profile   ? parseFloat(profile.gapVMm) : 2);
    setOffsetX(profile ? parseFloat(profile.offsetXMm) : 0);
    setOffsetY(profile ? parseFloat(profile.offsetYMm) : 0);
    setIsDefault(profile?.isDefault ?? false);
    setUsePreset(null);
  }, [open, profile]);

  function applyPreset(idx: number) {
    const p = PRESET_PRINTERS[idx];
    if (!p) return;
    setName(p.name);       setType(p.type ?? "THERMAL");
    setPageW(p.pageWidthMm ?? 210); setPageH(p.pageHeightMm ?? 297);
    setMTop(p.marginTopMm ?? 5);    setMLeft(p.marginLeftMm ?? 5);
    setMRight(p.marginRightMm ?? 5);setMBottom(p.marginBottomMm ?? 5);
    setGapH(p.gapHMm ?? 2);        setGapV(p.gapVMm ?? 2);
    setCols(p.columns ?? 1);
    setUsePreset(idx);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("El nombre es requerido."); return; }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(), type, columns: cols ?? 1,
        pageWidthMm: pageW ?? 210,   pageHeightMm: pageH ?? 297,
        marginTopMm: mTop ?? 5,      marginLeftMm: mLeft ?? 5,
        marginRightMm: mRight ?? 5,  marginBottomMm: mBottom ?? 5,
        gapHMm: gapH ?? 2,           gapVMm: gapV ?? 2,
        offsetXMm: offsetX ?? 0,     offsetYMm: offsetY ?? 0,
        isDefault,
      };
      if (profile) {
        await printerProfilesApi.update(profile.id, payload);
        toast.success("Impresora actualizada.");
      } else {
        await printerProfilesApi.create(payload);
        toast.success("Impresora creada.");
      }
      onSave(); onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  const PRESET_ICONS = [Printer, LayoutGrid, Columns2] as const;

  return (
    <Modal
      open={open}
      title={profile ? "Editar impresora" : "Nueva impresora"}
      onClose={onClose}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="secondary" onClick={onClose}><X size={15} />Cancelar</TPButton>
          <TPButton variant="primary" onClick={handleSave} loading={busy}><Save size={15} />Guardar</TPButton>
        </div>
      }
    >
      <div className="space-y-5">
        {!profile && (
          <div className="grid grid-cols-3 gap-2">
            {PRESET_PRINTERS.map((p, i) => {
              const Icon = PRESET_ICONS[i] ?? Printer;
              return (
                <TPButton
                  key={i}
                  variant="secondary"
                  onClick={() => applyPreset(i)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 h-auto py-3 !justify-center",
                    usePreset === i && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium text-center leading-tight">{p.name}</span>
                </TPButton>
              );
            })}
          </div>
        )}
        <TPField label="Nombre">
          <TPInput value={name} onChange={setName} placeholder="Ej: Térmica 58mm" />
        </TPField>
        <div className="grid grid-cols-2 gap-3">
          <TPField label="Tipo">
            <TPComboFixed
              value={type}
              onChange={(v) => setType(v as PrinterType)}
              options={Object.entries(PRINTER_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </TPField>
          <TPField label="Columnas">
            <TPNumberInput value={cols} onChange={setCols} decimals={0} min={1} max={10} />
          </TPField>
          <TPField label="Ancho hoja (mm)">
            <TPNumberInput value={pageW} onChange={setPageW} decimals={1} min={20} max={500} />
          </TPField>
          <TPField label="Alto hoja (mm)">
            <TPNumberInput value={pageH} onChange={setPageH} decimals={1} min={20} max={9999} />
          </TPField>
        </div>
        <p className="text-xs text-muted font-medium">Márgenes (mm)</p>
        <div className="grid grid-cols-2 gap-3">
          <TPField label="Superior">
            <TPNumberInput value={mTop}    onChange={setMTop}    decimals={1} min={0} />
          </TPField>
          <TPField label="Inferior">
            <TPNumberInput value={mBottom} onChange={setMBottom} decimals={1} min={0} />
          </TPField>
          <TPField label="Izquierdo">
            <TPNumberInput value={mLeft}   onChange={setMLeft}   decimals={1} min={0} />
          </TPField>
          <TPField label="Derecho">
            <TPNumberInput value={mRight}  onChange={setMRight}  decimals={1} min={0} />
          </TPField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TPField label="Gap horizontal (mm)">
            <TPNumberInput value={gapH} onChange={setGapH} decimals={1} min={0} />
          </TPField>
          <TPField label="Gap vertical (mm)">
            <TPNumberInput value={gapV} onChange={setGapV} decimals={1} min={0} />
          </TPField>
        </div>

        {/* ── Calibración física ─────────────────────────────────────────── */}
        <CalibrationSection
          offsetX={offsetX}
          offsetY={offsetY}
          onOffsetX={setOffsetX}
          onOffsetY={setOffsetY}
          previewWMm={pageW ?? 58}
          previewHMm={
            type === "A4" || type === "INKJET"
              ? 40
              : Math.min(pageH ?? 40, 50)
          }
          onPrintCalibration={() => {
            // Construir perfil sintético con los valores actuales del formulario
            const syntheticProfile: PrinterProfileRow = {
              id:             profile?.id ?? "preview",
              name:           name.trim() || "Impresora",
              type,
              dpi:            203,
              pageWidthMm:    String(pageW  ?? 58),
              pageHeightMm:   String(pageH  ?? 297),
              marginTopMm:    String(mTop   ?? 5),
              marginLeftMm:   String(mLeft  ?? 5),
              marginRightMm:  String(mRight ?? 5),
              marginBottomMm: String(mBottom ?? 5),
              gapHMm:         String(gapH   ?? 2),
              gapVMm:         String(gapV   ?? 2),
              columns:        cols ?? 1,
              offsetXMm:      String(offsetX ?? 0),
              offsetYMm:      String(offsetY ?? 0),
              isDefault:      false,
              isActive:       true,
              deletedAt:      null,
              createdAt:      "",
            };
            const lw = pageW ?? 58;
            const lh = type === "A4" || type === "INKJET" ? 40 : Math.min(pageH ?? 40, 50);
            const html = buildCalibrationHtml(syntheticProfile, lw, lh);
            const win = window.open("", "_blank", "width=600,height=400");
            win?.document.write(html);
            win?.document.close();
          }}
        />

        <TPCheckbox checked={isDefault} onChange={setIsDefault} label="Impresora predeterminada" />
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabKey = "plantillas" | "impresoras";

export default function ConfiguracionSistemaEtiquetas() {
  const [templates,            setTemplates]            = useState<LabelTemplateRow[]>([]);
  const [printers,             setPrinters]             = useState<PrinterProfileRow[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [tab,                  setTab]                  = useState<TabKey>("plantillas");
  const [editTemplate,         setEditTemplate]         = useState<LabelTemplateRow | null>(null);
  const [newTplOpen,           setNewTplOpen]           = useState(false);
  const [printerModal,         setPrinterModal]         = useState<PrinterProfileRow | null | undefined>(undefined); // undefined = closed
  const [assignPrinterTpl,     setAssignPrinterTpl]     = useState<LabelTemplateRow | null>(null);
  const { askDelete, dialogProps, closeDelete } = useConfirmDelete();

  async function load() {
    setLoading(true);
    try {
      const [tpls, prns] = await Promise.all([labelTemplatesApi.list(), printerProfilesApi.list()]);
      setTemplates(tpls.filter(t => !t.deletedAt));
      setPrinters(prns.filter(p  => !p.deletedAt));
    } catch {
      toast.error("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function duplicateTemplate(t: LabelTemplateRow) {
    try {
      const copy = await labelTemplatesApi.create({
        name:    `${t.name} (copia)`,
        widthMm:  parseFloat(t.widthMm),
        heightMm: parseFloat(t.heightMm),
        dpi:      t.dpi,
      });
      if (t.elements?.length) {
        await labelTemplatesApi.replaceElements(copy.id, t.elements.map((el, i) => ({
          type: el.type, label: el.label, fieldKey: el.fieldKey,
          x: parseFloat(el.x), y: parseFloat(el.y),
          width: parseFloat(el.width), height: parseFloat(el.height),
          fontSize: el.fontSize, fontWeight: el.fontWeight,
          align: el.align, visible: el.visible, sortOrder: i,
          configJson: JSON.parse(el.configJson || "{}"),
        })));
      }
      toast.success("Plantilla duplicada.");
      load();
    } catch {
      toast.error("No se pudo duplicar.");
    }
  }

  // If editing a template, show the full-screen editor
  if (editTemplate) {
    return (
      <TemplateEditor
        template={editTemplate}
        printers={printers}
        onBack={() => { setEditTemplate(null); load(); }}
        onSaved={(updated) => {
          setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
          // Actualizar editTemplate para que el toolbar refleje el printer
          setEditTemplate(updated);
        }}
      />
    );
  }

  return (
    <TPSectionShell title="Etiquetas">

      {/* ── Tabs + botón de acción — misma línea ── */}
      <div className="flex items-center justify-between mb-4">
        <TPTabs
          options={[
            { label: "Plantillas", value: "plantillas" },
            { label: "Impresoras", value: "impresoras" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
        />
        {tab === "plantillas" && (
          <TPButton variant="primary" onClick={() => setNewTplOpen(true)}>
            <Plus size={15} strokeWidth={2.5} />
            Nueva plantilla
          </TPButton>
        )}
        {tab === "impresoras" && (
          <TPButton variant="primary" onClick={() => setPrinterModal(null)}>
            <Plus size={15} strokeWidth={2.5} />
            Nueva impresora
          </TPButton>
        )}
      </div>

      {/* ── Plantillas ────────────────────────────────────────────────────── */}
      {tab === "plantillas" && (
        <>

          {/* Banner: sin impresoras configuradas */}
          {!loading && templates.length > 0 && printers.length === 0 && (
            <div className="flex items-start gap-3 mb-4 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50">
              <Printer size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-700 leading-tight">Sin impresoras configuradas</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Creá una impresora en la pestaña <strong>Impresoras</strong> para asignarla a cada plantilla y simplificar el flujo de impresión.
                </p>
              </div>
              <TPButton
                variant="ghost"
                onClick={() => setTab("impresoras")}
                className="shrink-0 text-amber-600 hover:text-amber-700 text-xs px-2 border border-amber-200 hover:bg-amber-100"
              >
                Ir a Impresoras
              </TPButton>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted text-center py-8">Cargando…</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={32} className="mx-auto mb-2" style={{ color: "var(--muted)", opacity: 0.3 }} />
              <p className="text-sm text-muted">No hay plantillas. Creá la primera.</p>
              <TPButton variant="ghost" onClick={() => setNewTplOpen(true)} className="mt-3">
                <Plus size={15} strokeWidth={2.5} /> Nueva plantilla
              </TPButton>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {templates.map(t => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  onEdit={() => setEditTemplate(t)}
                  onDuplicate={() => duplicateTemplate(t)}
                  onAssignPrinter={() => setAssignPrinterTpl(t)}
                  onDelete={() => askDelete({
                    entityName:  "Plantilla",
                    entityLabel: t.name,
                    onDelete: async () => {
                      await labelTemplatesApi.remove(t.id);
                      setTemplates(prev => prev.filter(x => x.id !== t.id));
                    },
                  })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Impresoras ────────────────────────────────────────────────────── */}
      {tab === "impresoras" && (
        <>
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Cargando…</p>
          ) : printers.length === 0 ? (
            <div className="text-center py-12">
              <Printer size={32} className="text-muted opacity-30 mx-auto mb-2" />
              <p className="text-sm text-muted">No hay perfiles de impresora.</p>
              <TPButton variant="ghost" onClick={() => setPrinterModal(null)} className="mt-3">
                <Plus size={15} strokeWidth={2.5} /> Nueva impresora
              </TPButton>
            </div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {printers.map(p => (
                <PrinterRow
                  key={p.id}
                  p={p}
                  onEdit={() => setPrinterModal(p)}
                  onCalibrate={() => {
                    const isA4 = p.type === "A4" || p.type === "INKJET";
                    // Usar ancho de página; alto = 40mm para térmica, 50mm para A4
                    const lw = parseFloat(String(p.pageWidthMm));
                    const lh = isA4 ? 50 : Math.min(parseFloat(String(p.pageHeightMm)), 50);
                    const html = buildCalibrationHtml(p, lw, lh);
                    const win = window.open("", "_blank", "width=600,height=400");
                    win?.document.write(html);
                    win?.document.close();
                  }}
                  onDelete={() => askDelete({
                    entityName:  "Perfil",
                    entityLabel: p.name,
                    onDelete: async () => {
                      await printerProfilesApi.remove(p.id);
                      setPrinters(prev => prev.filter(x => x.id !== p.id));
                    },
                  })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <NewTemplateModal
        open={newTplOpen}
        onClose={() => setNewTplOpen(false)}
        onCreate={(t) => { setTemplates(prev => [...prev, t]); setEditTemplate(t); }}
        printers={printers}
      />

      {printerModal !== undefined && (
        <PrinterModal
          open={true}
          profile={printerModal}
          onClose={() => setPrinterModal(undefined)}
          onSave={load}
        />
      )}

      {assignPrinterTpl && (
        <AssignPrinterModal
          open={true}
          onClose={() => setAssignPrinterTpl(null)}
          template={assignPrinterTpl}
          printers={printers}
          onSave={(updated) => {
            setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
            setAssignPrinterTpl(null);
          }}
          onCreatePrinter={() => {
            setAssignPrinterTpl(null);
            setTab("impresoras");
            setPrinterModal(null); // abre modal de nueva impresora
          }}
        />
      )}

      <ConfirmDeleteDialog {...dialogProps} />
    </TPSectionShell>
  );
}
