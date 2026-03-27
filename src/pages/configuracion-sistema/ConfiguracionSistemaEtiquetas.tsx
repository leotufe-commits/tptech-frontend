// src/pages/configuracion-sistema/ConfiguracionSistemaEtiquetas.tsx
// Editor visual de plantillas de etiquetas.
// Drag + resize + snap + bounds clamping, sin librerías externas de canvas.
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft,
  BarcodeIcon, ChevronDown, ChevronUp, Copy, Eye, EyeOff,
  GripVertical, Grid, Layers, Maximize2, Minimize2,
  Pencil, Plus, Printer, QrCode, Save, Sparkles,
  ScanLine, Tag, Trash2, Type, ZoomIn, ZoomOut,
} from "lucide-react";

import { cn }              from "../../components/ui/tp";
import { TPSectionShell }  from "../../components/ui/TPSectionShell";
import { TPButton }        from "../../components/ui/TPButton";
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

// Datos de muestra para preview en el editor
const SAMPLE_MAP: Record<string, string> = {
  "article.name":      "Anillo Solitario Oro",
  "article.code":      "ANI-0042",
  "article.sku":       "JW-042",
  "article.barcode":   "7790001234567",
  "article.salePrice": "$28.500",
  "article.costPrice": "$14.200",
  "article.brand":     "Vera",
  "variant.name":      "Talle 15",
  "variant.code":      "T15",
  "size":              "15",
  "static":            "",
};

const SAMPLE_ITEM = {
  id:          "_sample",
  name:        "Anillo Solitario Oro",
  code:        "ANI-0042",
  sku:         "JW-042",
  barcode:     "7790001234567",
  barcodeType: "CODE128" as const,
  salePrice:   "28500",
  costPrice:   "14200",
  brand:       "Vera",
  variantName: "Talle 15",
  variantCode: "T15",
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
    configJson:      cfg,
  };
}

function localToRowPayload(el: LocalElement, i: number) {
  const { autoHideIfEmpty, lineClamp, suffix, configJson, ...rest } = el;
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
    configJson: { ...configJson, autoHideIfEmpty, lineClamp, suffix },
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
    configJson: JSON.stringify(el.configJson),
  };
}

// ─── Element content renderer (canvas) ───────────────────────────────────────

function ElementContent({ el, zoom }: { el: LocalElement; zoom: number }) {
  const sample = SAMPLE_MAP[el.fieldKey] ?? el.label ?? "";
  const text   = el.label && el.fieldKey !== "static"
    ? `${el.label}${sample}${el.suffix}`
    : `${sample}${el.suffix}`;
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
  return (
    <div style={{
      width:          "100%",
      height:         "100%",
      fontSize:       `${el.fontSize * zoom * 0.75}px`,
      fontWeight:     el.fontWeight,
      display:        "flex",
      alignItems:     "center",
      justifyContent: justifyMap[el.align] ?? "flex-start",
      overflow:       "hidden",
      whiteSpace:     "nowrap",
      padding:        "0 1px",
      lineHeight:     1.2,
      color:          text ? "#111" : "#aaa",
    }}>
      {text || el.fieldKey || "Texto"}
    </div>
  );
}

// ─── LabelCanvas ─────────────────────────────────────────────────────────────

type DragState = {
  elementId: string;
  startX:    number;
  startY:    number;
  origX:     number;
  origY:     number;
};

type ResizeState = {
  elementId: string;
  handle:    "se" | "e" | "s";
  startX:    number;
  startY:    number;
  origW:     number;
  origH:     number;
};

function LabelCanvas({
  template, elements, selectedId, zoom, snapMm, showGrid,
  onSelect, onUpdate,
}: {
  template:   { widthMm: number; heightMm: number; bgColor: string };
  elements:   LocalElement[];
  selectedId: string | null;
  zoom:       number;
  snapMm:     number;
  showGrid:   boolean;
  onSelect:   (id: string | null) => void;
  onUpdate:   (id: string, patch: Partial<LocalElement>) => void;
}) {
  const drag   = useRef<DragState | null>(null);
  const resize = useRef<ResizeState | null>(null);
  const scale  = MM_TO_PX * zoom;

  function startDrag(e: React.MouseEvent, el: LocalElement) {
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    drag.current = {
      elementId: el.id,
      startX:    e.clientX,
      startY:    e.clientY,
      origX:     el.x,
      origY:     el.y,
    };
  }

  function startResize(e: React.MouseEvent, el: LocalElement, handle: "se" | "e" | "s") {
    e.stopPropagation();
    e.preventDefault();
    resize.current = {
      elementId: el.id,
      handle,
      startX:    e.clientX,
      startY:    e.clientY,
      origW:     el.width,
      origH:     el.height,
    };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (drag.current) {
      const dx  = (e.clientX - drag.current.startX) / scale;
      const dy  = (e.clientY - drag.current.startY) / scale;
      const el  = elements.find(el => el.id === drag.current!.elementId);
      if (!el) return;
      const nx  = clamp(snapVal(drag.current.origX + dx, snapMm), 0, template.widthMm  - el.width);
      const ny  = clamp(snapVal(drag.current.origY + dy, snapMm), 0, template.heightMm - el.height);
      onUpdate(drag.current.elementId, { x: nx, y: ny });
    }
    if (resize.current) {
      const dx  = (e.clientX - resize.current.startX) / scale;
      const dy  = (e.clientY - resize.current.startY) / scale;
      const el  = elements.find(el => el.id === resize.current!.elementId);
      if (!el) return;
      const patch: Partial<LocalElement> = {};
      if (resize.current.handle === "se" || resize.current.handle === "e") {
        patch.width  = clamp(snapVal(resize.current.origW + dx, snapMm), 1, template.widthMm  - el.x);
      }
      if (resize.current.handle === "se" || resize.current.handle === "s") {
        patch.height = clamp(snapVal(resize.current.origH + dy, snapMm), 0.5, template.heightMm - el.y);
      }
      onUpdate(resize.current.elementId, patch);
    }
  }

  function onMouseUp() {
    drag.current   = null;
    resize.current = null;
  }

  const canvasW = mm(template.widthMm, zoom);
  const canvasH = mm(template.heightMm, zoom);
  const gridSize = mm(snapMm, zoom);

  // Sort elements by sortOrder for z-index
  const sorted = [...elements].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div
      style={{
        position:        "relative",
        width:           canvasW,
        height:          canvasH,
        backgroundColor: template.bgColor || "#ffffff",
        border:          "1px solid #cbd5e1",
        boxShadow:       "0 4px 20px rgba(0,0,0,0.15)",
        flexShrink:      0,
        overflow:        "visible",
        cursor:          "default",
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={() => onSelect(null)}
    >
      {/* Clip region */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {/* Grid */}
        {showGrid && gridSize > 2 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage: `
                linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px`,
            }}
          />
        )}
      </div>

      {/* Elements (rendered above clip, so handles can overflow) */}
      {sorted.filter(el => el.visible).map(el => {
        const elW  = mm(el.width, zoom);
        const elH  = mm(el.type === "LINE" ? Math.max(0.3, el.height) : el.height, zoom);
        const elX  = mm(el.x, zoom);
        const elY  = mm(el.y, zoom);
        const selected = selectedId === el.id;

        return (
          <div
            key={el.id}
            style={{
              position:        "absolute",
              left:            elX,
              top:             elY,
              width:           elW,
              height:          el.type === "LINE" ? Math.max(1, elH) : elH,
              outline:         selected ? "2px solid #3b82f6" : "1px dashed rgba(0,0,0,0.15)",
              outlineOffset:   selected ? "0px" : "-1px",
              backgroundColor: selected ? "rgba(59,130,246,0.04)" : "transparent",
              cursor:          "move",
              zIndex:          el.sortOrder + (selected ? 100 : 1),
              boxSizing:       "border-box",
            }}
            onMouseDown={(e) => startDrag(e, el)}
          >
            <ElementContent el={el} zoom={zoom} />

            {/* Resize handles — only for selected */}
            {selected && (
              <>
                {/* SE corner */}
                <div
                  style={{
                    position: "absolute", right: -5, bottom: -5,
                    width: 10, height: 10,
                    background: "#3b82f6", border: "2px solid #fff",
                    borderRadius: 2, cursor: "se-resize", zIndex: 200,
                  }}
                  onMouseDown={(e) => startResize(e, el, "se")}
                />
                {/* E midpoint */}
                <div
                  style={{
                    position: "absolute", right: -4, top: "50%", marginTop: -4,
                    width: 8, height: 8,
                    background: "#3b82f6", border: "2px solid #fff",
                    borderRadius: "50%", cursor: "e-resize", zIndex: 200,
                  }}
                  onMouseDown={(e) => startResize(e, el, "e")}
                />
                {/* S midpoint */}
                <div
                  style={{
                    position: "absolute", left: "50%", marginLeft: -4, bottom: -4,
                    width: 8, height: 8,
                    background: "#3b82f6", border: "2px solid #fff",
                    borderRadius: "50%", cursor: "s-resize", zIndex: 200,
                  }}
                  onMouseDown={(e) => startResize(e, el, "s")}
                />
              </>
            )}
          </div>
        );
      })}

      {/* Dimension overlay */}
      <div style={{
        position: "absolute",
        bottom: -18,
        left: 0,
        fontSize: 9,
        color: "#94a3b8",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        {template.widthMm}×{template.heightMm}mm
      </div>
    </div>
  );
}

// ─── Element properties panel ─────────────────────────────────────────────────

function ElementPanel({
  el, onChange, onDelete,
}: {
  el:       LocalElement;
  onChange: (patch: Partial<LocalElement>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      {/* Type badge + delete */}
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", ELEMENT_TYPE_COLORS[el.type])}>
          {ELEMENT_TYPE_LABELS[el.type]}
        </span>
        <button
          onClick={onDelete}
          className="text-muted hover:text-red-500 transition p-1 rounded"
          title="Eliminar elemento"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Field key */}
      {(el.type === "TEXT" || el.type === "BARCODE" || el.type === "QR") && (
        <TPField label="Campo de datos">
          <TPComboFixed
            value={el.fieldKey}
            onChange={(v) => onChange({ fieldKey: v })}
            options={FIELD_KEY_OPTIONS}
          />
        </TPField>
      )}

      {/* Prefix label */}
      {el.type === "TEXT" && (
        <div className="grid grid-cols-2 gap-2">
          <TPField label="Prefijo">
            <TPInput value={el.label} onChange={(v) => onChange({ label: v })} placeholder="Ej: Precio: " />
          </TPField>
          <TPField label="Sufijo">
            <TPInput value={el.suffix} onChange={(v) => onChange({ suffix: v })} placeholder="Ej: kg" />
          </TPField>
        </div>
      )}

      {/* Position + size */}
      <div className="grid grid-cols-2 gap-2">
        <TPField label="X (mm)">
          <TPNumberInput value={el.x}      onChange={(v) => onChange({ x: v ?? 0 })}      decimals={1} step={0.5} min={0} />
        </TPField>
        <TPField label="Y (mm)">
          <TPNumberInput value={el.y}      onChange={(v) => onChange({ y: v ?? 0 })}      decimals={1} step={0.5} min={0} />
        </TPField>
        <TPField label="Ancho (mm)">
          <TPNumberInput value={el.width}  onChange={(v) => onChange({ width: v ?? 5 })}  decimals={1} step={0.5} min={1} />
        </TPField>
        <TPField label="Alto (mm)">
          <TPNumberInput value={el.height} onChange={(v) => onChange({ height: v ?? 1 })} decimals={1} step={0.5} min={0.3} />
        </TPField>
      </div>

      {/* Typography (TEXT only) */}
      {el.type === "TEXT" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <TPField label="Tamaño (pt)">
              <TPNumberInput value={el.fontSize}  onChange={(v) => onChange({ fontSize: v ?? 8 })}  decimals={0} step={1} min={4} max={72} />
            </TPField>
            <TPField label="Peso">
              <TPComboFixed
                value={el.fontWeight}
                onChange={(v) => onChange({ fontWeight: v })}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "bold",   label: "Negrita" },
                ]}
              />
            </TPField>
          </div>

          <TPField label="Alineación">
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onChange({ align: a })}
                  className={cn(
                    "flex-1 flex items-center justify-center h-7 rounded border text-xs transition",
                    el.align === a
                      ? "bg-primary text-white border-primary"
                      : "border-border hover:bg-surface2 text-muted"
                  )}
                >
                  {a === "left"   && <AlignLeft   size={13} />}
                  {a === "center" && <AlignCenter size={13} />}
                  {a === "right"  && <AlignRight  size={13} />}
                </button>
              ))}
            </div>
          </TPField>

          <TPField label="Máx. líneas (0 = sin límite)">
            <TPNumberInput value={el.lineClamp} onChange={(v) => onChange({ lineClamp: v ?? 0 })} decimals={0} step={1} min={0} max={10} />
          </TPField>
        </>
      )}

      {/* Visibility + behavior */}
      <div className="space-y-1.5">
        <TPCheckbox
          checked={el.visible}
          onChange={(v) => onChange({ visible: v })}
          label="Visible"
        />
        {el.type === "TEXT" && (
          <TPCheckbox
            checked={el.autoHideIfEmpty}
            onChange={(v) => onChange({ autoHideIfEmpty: v })}
            label="Ocultar si está vacío"
          />
        )}
      </div>
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
    configJson:      {},
    _new:            true,
  };
}

// ─── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  open,
  onClose,
  template,
  elements,
}: {
  open:     boolean;
  onClose:  () => void;
  template: { widthMm: string; heightMm: string; bgColor: string; dpi: number; orientation: string; name: string; id: string; isDefault: boolean; isActive: boolean; deletedAt: null; createdAt: string };
  elements: LocalElement[];
}) {
  const fakeTemplate = {
    ...template,
    elements: elements.map(localToElementRow),
  } as LabelTemplateRow;

  return (
    <Modal open={open} title="Vista previa con datos de muestra" onClose={onClose} maxWidth="sm">
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-xs text-muted text-center">
          Los datos mostrados son de muestra. La impresión usará los datos reales del artículo.
        </p>
        <div className="border border-border rounded shadow-sm overflow-hidden">
          <LabelRenderer
            template={fakeTemplate}
            item={SAMPLE_ITEM}
            dpi={96}
            scale={2}
            debug={false}
          />
        </div>
        <p className="text-xs text-muted tabular-nums">
          {template.widthMm}×{template.heightMm}mm · {elements.length} elementos
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
}: {
  template: LabelTemplateRow;
  onBack:   () => void;
  onSaved:  (t: LabelTemplateRow) => void;
}) {
  const [template,    setTemplate]    = useState(initialTemplate);
  const [elements,    setElements]    = useState<LocalElement[]>(() => initialTemplate.elements.map(rowToLocal));
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [zoom,        setZoom]        = useState(2.5);
  const [snapMm,      setSnapMm]      = useState(1);
  const [showGrid,    setShowGrid]    = useState(true);
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedEl = elements.find(e => e.id === selectedId) ?? null;

  // ── Element CRUD ────────────────────────────────────────────────────────────

  const updateEl = useCallback((id: string, patch: Partial<LocalElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    setDirty(true);
  }, []);

  function addElement(type: LabelElementType) {
    const el = makeElement(type, elements.length);
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
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
    setSelectedId(dup.id);
    setDirty(true);
  }

  function deleteElement(id: string) {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDirty(true);
  }

  function bringForward(id: string) {
    setElements(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const next = [...prev];
      const tmp  = next[idx].sortOrder;
      next[idx]         = { ...next[idx],     sortOrder: next[idx + 1].sortOrder };
      next[idx + 1]     = { ...next[idx + 1], sortOrder: tmp };
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
    setDirty(true);
  }

  function sendBackward(id: string) {
    setElements(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const tmp  = next[idx].sortOrder;
      next[idx]     = { ...next[idx],     sortOrder: next[idx - 1].sortOrder };
      next[idx - 1] = { ...next[idx - 1], sortOrder: tmp };
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
    setDirty(true);
  }

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

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: "100dvh" }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface flex-shrink-0">
        {/* Back */}
        <TPButton variant="ghost" onClick={onBack} className="gap-1 px-2">
          <ArrowLeft size={14} />
          <span className="text-xs">Volver</span>
        </TPButton>
        <div className="w-px h-5 bg-border" />

        {/* Template name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-text truncate">{template.name}</span>
          <span className="ml-2 text-xs text-muted tabular-nums">
            {template.widthMm}×{template.heightMm}mm · {template.dpi}dpi
          </span>
        </div>

        {/* Quick-add buttons */}
        <div className="flex items-center gap-1">
          {(["TEXT", "BARCODE", "QR", "LINE"] as LabelElementType[]).map(type => (
            <button
              key={type}
              title={`Agregar ${ELEMENT_TYPE_LABELS[type]}`}
              onClick={() => addElement(type)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition hover:scale-105",
                ELEMENT_TYPE_COLORS[type]
              )}
            >
              {type === "TEXT"    && <Type       size={11} />}
              {type === "BARCODE" && <ScanLine   size={11} />}
              {type === "QR"      && <QrCode     size={11} />}
              {type === "LINE"    && <Minimize2  size={11} />}
              <span className="hidden sm:inline">{ELEMENT_TYPE_LABELS[type]}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Grid toggle */}
        <button
          title={showGrid ? "Ocultar grilla" : "Mostrar grilla"}
          onClick={() => setShowGrid(g => !g)}
          className={cn(
            "p-1.5 rounded border text-xs transition",
            showGrid
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted hover:border-primary/30"
          )}
        >
          <Grid size={13} />
        </button>

        {/* Snap selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Snap</span>
          <select
            value={snapMm}
            onChange={e => setSnapMm(Number(e.target.value))}
            className="text-xs border border-border rounded px-1 py-0.5 bg-surface text-text h-6"
          >
            {SNAP_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => +(Math.max(0.5, z - 0.5).toFixed(1)))}
            className="p-1 rounded hover:bg-surface2 text-muted"
          ><ZoomOut size={13} /></button>
          <span className="text-xs text-muted w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => +(Math.min(6, z + 0.5).toFixed(1)))}
            className="p-1 rounded hover:bg-surface2 text-muted"
          ><ZoomIn size={13} /></button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Preview */}
        <TPButton variant="ghost" onClick={() => setPreviewOpen(true)} className="gap-1 px-2">
          <Eye size={13} />
          <span className="text-xs hidden sm:inline">Preview</span>
        </TPButton>

        {/* Save */}
        {dirty && <span className="text-xs text-amber-500 font-medium hidden sm:inline">Sin guardar</span>}
        <TPButton variant="primary" onClick={handleSave} loading={saving} disabled={!dirty} className="gap-1 px-3">
          <Save size={13} />
          <span className="text-xs">Guardar</span>
        </TPButton>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Canvas area ──────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-auto flex items-start justify-center p-10"
          style={{
            background: "#e2e8f0",
            backgroundImage: "radial-gradient(circle,#00000014 1px,transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <LabelCanvas
            template={{
              widthMm:  parseFloat(template.widthMm),
              heightMm: parseFloat(template.heightMm),
              bgColor:  template.bgColor || "#ffffff",
            }}
            elements={elements}
            selectedId={selectedId}
            zoom={zoom}
            snapMm={snapMm}
            showGrid={showGrid}
            onSelect={setSelectedId}
            onUpdate={updateEl}
          />
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 border-l border-border bg-surface flex flex-col min-h-0">

          {/* Element list or properties */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {selectedEl ? (
              <>
                {/* Selected element actions */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    title="Duplicar"
                    onClick={() => duplicateElement(selectedEl.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted hover:bg-surface2 transition"
                  >
                    <Copy size={11} /> Duplicar
                  </button>
                  <button
                    title="Traer al frente"
                    onClick={() => bringForward(selectedEl.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted hover:bg-surface2 transition"
                  >
                    <ChevronUp size={11} /> Subir
                  </button>
                  <button
                    title="Enviar atrás"
                    onClick={() => sendBackward(selectedEl.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted hover:bg-surface2 transition"
                  >
                    <ChevronDown size={11} /> Bajar
                  </button>
                </div>

                <ElementPanel
                  el={selectedEl}
                  onChange={(patch) => updateEl(selectedEl.id, patch)}
                  onDelete={() => deleteElement(selectedEl.id)}
                />
              </>
            ) : (
              <>
                <p className="text-xs text-muted font-medium uppercase tracking-wide">Elementos ({elements.length})</p>
                {elements.length === 0 ? (
                  <p className="text-xs text-muted/60 italic text-center py-4">
                    Sin elementos. Usá los botones de la barra superior para agregar.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {[...elements]
                      .sort((a, b) => b.sortOrder - a.sortOrder)
                      .map(el => (
                        <button
                          key={el.id}
                          onClick={() => setSelectedId(el.id)}
                          className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:bg-primary/5 hover:border-primary/30 text-xs transition"
                        >
                          <span className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            el.type === "TEXT"    && "bg-blue-500",
                            el.type === "BARCODE" && "bg-violet-500",
                            el.type === "QR"      && "bg-green-500",
                            el.type === "IMAGE"   && "bg-amber-500",
                            el.type === "LINE"    && "bg-gray-400",
                          )} />
                          <span className="flex-1 truncate font-medium">{ELEMENT_TYPE_LABELS[el.type]}</span>
                          <span className="text-muted/60 truncate max-w-[60px]">{el.fieldKey || el.label || "—"}</span>
                          {!el.visible && <EyeOff size={9} className="text-muted/50 flex-shrink-0" />}
                        </button>
                      ))
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer info */}
          <div className="p-3 border-t border-border space-y-1 text-xs text-muted flex-shrink-0">
            {selectedEl ? (
              <>
                <div className="flex justify-between">
                  <span>Posición</span>
                  <span className="font-mono">{selectedEl.x.toFixed(1)},{selectedEl.y.toFixed(1)}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Tamaño</span>
                  <span className="font-mono">{selectedEl.width.toFixed(1)}×{selectedEl.height.toFixed(1)}mm</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span>Etiqueta</span><span className="font-mono">{template.widthMm}×{template.heightMm}mm</span></div>
                <div className="flex justify-between"><span>DPI</span><span className="font-mono">{template.dpi}</span></div>
                <div className="flex justify-between"><span>Elementos</span><span className="font-mono">{elements.length}</span></div>
                <div className="flex justify-between"><span>Snap activo</span><span className="font-mono">{snapMm}mm</span></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview modal */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        template={template as any}
        elements={elements}
      />
    </div>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ t, onEdit, onDelete, onDuplicate }: {
  t: LabelTemplateRow;
  onEdit:      () => void;
  onDelete:    () => void;
  onDuplicate: () => void;
}) {
  const elCount = t.elements?.length ?? 0;
  const zoom    = 1;

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
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text truncate">{t.name}</p>
            <p className="text-xs text-muted tabular-nums">
              {t.widthMm}×{t.heightMm}mm · {elCount} elemento{elCount !== 1 ? "s" : ""}
            </p>
          </div>
          {t.isDefault && (
            <span className="shrink-0 text-[10px] bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded-full">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
          <TPButton variant="ghost" onClick={onEdit}      className="text-xs px-2 py-1 gap-1"><Pencil size={10} /> Editar</TPButton>
          <TPButton variant="ghost" onClick={onDuplicate} className="text-xs px-2 py-1 gap-1"><Copy   size={10} /></TPButton>
          <TPButton variant="ghost" onClick={onDelete}    className="text-xs px-2 py-1 text-red-500 hover:text-red-600"><Trash2 size={10} /></TPButton>
        </div>
      </div>
    </div>
  );
}

// ─── NewTemplateModal ─────────────────────────────────────────────────────────

// Metadata de display para cada preset (paralelo a PRESET_TEMPLATES por índice)
const PRESET_DISPLAY: {
  description: string;
  badge?:      string;
  badgeColor?: string;
}[] = [
  { description: "Precio + código + nombre" },
  { description: "Compacta para talle / precio" },
  { description: "Código + costo + control interno" },
  {
    description: "Etiqueta técnica tipo operario/engranaje",
    badge:      "Precargada",
    badgeColor: "bg-violet-500/15 text-violet-600 border-violet-300/40",
  },
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
        "relative flex flex-col gap-1 p-3 rounded-xl border text-left transition",
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
      <div className="flex items-center gap-1.5">
        <Tag size={12} className={selected ? "text-primary" : "text-muted"} />
        <span className={cn("text-xs font-semibold leading-tight", selected ? "text-primary" : "text-text")}>
          {preset.name}
        </span>
      </div>
      <span className="text-[11px] font-mono text-muted/80">
        {preset.widthMm}×{preset.heightMm} mm
      </span>
      <span className="text-[11px] text-muted leading-tight">
        {meta.description}
      </span>
    </button>
  );
}

function NewTemplateModal({ open, onClose, onCreate }: {
  open:     boolean;
  onClose:  () => void;
  onCreate: (t: LabelTemplateRow) => void;
}) {
  const [name,      setName]      = useState("");
  const [widthMm,   setWidthMm]   = useState<number | null>(null);
  const [heightMm,  setHeightMm]  = useState<number | null>(null);
  const [dpi,       setDpi]       = useState<number | null>(203);
  const [busy,      setBusy]      = useState(false);
  // null = Manual; 0..N = índice en PRESET_TEMPLATES
  const [usePreset, setUsePreset] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setName(""); setWidthMm(null); setHeightMm(null); setDpi(203); setUsePreset(null);
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
        name:      name.trim(),
        widthMm,
        heightMm,
        dpi:       dpi ?? 203,
        orientation: usePreset !== null ? (PRESET_TEMPLATES[usePreset] as any).orientation ?? "horizontal" : "horizontal",
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
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="ghost" onClick={onClose}>Cancelar</TPButton>
          <TPButton variant="primary" onClick={handleCreate} loading={busy}>
            Crear plantilla
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
            {/* Manual card */}
            <button
              type="button"
              onClick={clearToManual}
              className={cn(
                "flex flex-col gap-1 p-3 rounded-xl border text-left transition",
                usePreset === null
                  ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                  : "border-border border-dashed hover:border-primary/40 hover:bg-surface2"
              )}
            >
              <div className="flex items-center gap-1.5">
                <Plus size={12} className={usePreset === null ? "text-primary" : "text-muted"} />
                <span className={cn("text-xs font-semibold", usePreset === null ? "text-primary" : "text-text")}>
                  Manual
                </span>
              </div>
              <span className="text-[11px] text-muted">Desde cero</span>
              <span className="text-[11px] text-muted/70">Medidas personalizadas</span>
            </button>
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

/** Botones ±delta para ajuste rápido de offset */
function OffsetNudge({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const cur = value ?? 0;
  const STEPS = [-1, -0.5, +0.5, +1] as const;
  return (
    <div className="flex gap-0.5">
      {STEPS.map(d => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(Math.round((cur + d) * 10) / 10)}
          className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-100 hover:bg-amber-200 text-amber-800 transition leading-none tabular-nums"
        >
          {d > 0 ? `+${d}` : d}
        </button>
      ))}
    </div>
  );
}

/** Mini preview visual del efecto del offset.
 *  El rectángulo interior (contenido impreso) se desplaza respecto al exterior (borde físico). */
function OffsetPreview({ ox, oy, wMm, hMm }: { ox: number; oy: number; wMm: number; hMm: number }) {
  // Escalar a una caja de ~180 × 90px máximo, respetando la proporción
  const MAX_W = 180;
  const MAX_H = 80;
  const aspect = wMm / hMm;
  const bW = aspect >= MAX_W / MAX_H ? MAX_W : Math.round(MAX_H * aspect);
  const bH = aspect >= MAX_W / MAX_H ? Math.round(MAX_W / aspect) : MAX_H;

  // px por mm en esta escala
  const pxPerMm = bW / wMm;
  const shiftX  = Math.round(ox * pxPerMm);
  const shiftY  = Math.round(oy * pxPerMm);
  const cx = bW / 2;
  const cy = bH / 2;

  const isZero = ox === 0 && oy === 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Vista previa del desplazamiento</p>
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
          {/* Label de offset */}
          <div style={{ position:"absolute", left:cx-22, top:cy+3, width:44, textAlign:"center", fontSize:8, fontFamily:"monospace", color: isZero ? "#16a34a" : "#92400e", fontWeight:600, whiteSpace:"nowrap" }}>
            X{ox >= 0 ? "+" : ""}{ox} Y{oy >= 0 ? "+" : ""}{oy}mm
          </div>
        </div>
      </div>
      <p className="text-[9.5px] text-slate-400">
        {isZero
          ? "Sin desplazamiento — el contenido coincide con el borde físico"
          : `Contenido desplazado ${ox !== 0 ? `${ox > 0 ? "→" : "←"} ${Math.abs(ox)}mm en X` : ""}${ox !== 0 && oy !== 0 ? " · " : ""}${oy !== 0 ? `${oy > 0 ? "↓" : "↑"} ${Math.abs(oy)}mm en Y` : ""}`
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
              <OffsetNudge value={offsetX} onChange={onOffsetX} />
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
              <OffsetNudge value={offsetY} onChange={onOffsetY} />
            </div>
            <TPNumberInput value={offsetY} onChange={onOffsetY} decimals={1} min={-20} max={20} />
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

  return (
    <Modal
      open={open}
      title={profile ? "Editar impresora" : "Nueva impresora"}
      onClose={onClose}
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <TPButton variant="ghost" onClick={onClose}>Cancelar</TPButton>
          <TPButton variant="primary" onClick={handleSave} loading={busy}>Guardar</TPButton>
        </div>
      }
    >
      <div className="space-y-4">
        {!profile && (
          <div className="grid grid-cols-3 gap-2">
            {PRESET_PRINTERS.map((p, i) => (
              <button
                key={i}
                onClick={() => applyPreset(i)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition",
                  usePreset === i
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40"
                )}
              >
                <Printer size={13} />
                <span className="font-medium text-center leading-tight">{p.name}</span>
              </button>
            ))}
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
        <div className="grid grid-cols-4 gap-2">
          <TPField label="↑"><TPNumberInput value={mTop}    onChange={setMTop}    decimals={1} min={0} /></TPField>
          <TPField label="↓"><TPNumberInput value={mBottom} onChange={setMBottom} decimals={1} min={0} /></TPField>
          <TPField label="←"><TPNumberInput value={mLeft}   onChange={setMLeft}   decimals={1} min={0} /></TPField>
          <TPField label="→"><TPNumberInput value={mRight}  onChange={setMRight}  decimals={1} min={0} /></TPField>
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
  const [templates,     setTemplates]     = useState<LabelTemplateRow[]>([]);
  const [printers,      setPrinters]      = useState<PrinterProfileRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState<TabKey>("plantillas");
  const [editTemplate,  setEditTemplate]  = useState<LabelTemplateRow | null>(null);
  const [newTplOpen,    setNewTplOpen]    = useState(false);
  const [printerModal,  setPrinterModal]  = useState<PrinterProfileRow | null | undefined>(undefined); // undefined = closed
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
        onBack={() => { setEditTemplate(null); load(); }}
        onSaved={(updated) => {
          setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        }}
      />
    );
  }

  return (
    <TPSectionShell title="Etiquetas">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(["plantillas", "impresoras"] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition capitalize",
              tab === t
                ? "bg-primary text-white border-primary"
                : "border-border text-muted hover:border-primary/30"
            )}
          >
            {t === "plantillas" ? "Plantillas" : "Impresoras"}
          </button>
        ))}
      </div>

      {/* ── Plantillas ────────────────────────────────────────────────────── */}
      {tab === "plantillas" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{templates.length} plantilla{templates.length !== 1 ? "s" : ""}</p>
            <TPButton variant="primary" onClick={() => setNewTplOpen(true)}>
              <Plus size={14} /> Nueva plantilla
            </TPButton>
          </div>
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Cargando…</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={32} className="text-muted/30 mx-auto mb-2" />
              <p className="text-sm text-muted">No hay plantillas. Creá la primera.</p>
              <TPButton variant="ghost" onClick={() => setNewTplOpen(true)} className="mt-3">
                <Plus size={13} /> Nueva plantilla
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{printers.length} perfil{printers.length !== 1 ? "es" : ""}</p>
            <TPButton variant="primary" onClick={() => setPrinterModal(null)}>
              <Plus size={14} /> Nueva impresora
            </TPButton>
          </div>
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Cargando…</p>
          ) : printers.length === 0 ? (
            <div className="text-center py-12">
              <Printer size={32} className="text-muted/30 mx-auto mb-2" />
              <p className="text-sm text-muted">No hay perfiles de impresora.</p>
              <TPButton variant="ghost" onClick={() => setPrinterModal(null)} className="mt-3">
                <Plus size={13} /> Nueva impresora
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
      />

      {printerModal !== undefined && (
        <PrinterModal
          open={true}
          profile={printerModal}
          onClose={() => setPrinterModal(undefined)}
          onSave={load}
        />
      )}

      <ConfirmDeleteDialog {...dialogProps} />
    </TPSectionShell>
  );
}
