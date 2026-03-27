// src/pages/article-detail/LabelPrintModal.tsx
// Modal de impresión de etiquetas.
// Preview: usa LabelSheet + LabelRenderer (React, mm→px exacto).
// Impresión: abre ventana con HTML+JsBarcode CDN, layout calculado con buildPrintPages.
import React, { useState, useEffect, useRef } from "react";
import { Printer, Plus, Minus, Tag, LayoutTemplate } from "lucide-react";

import { Modal }       from "../../components/ui/Modal";
import { TPButton }    from "../../components/ui/TPButton";
import { TPCard }      from "../../components/ui/TPCard";
import { TPField }     from "../../components/ui/TPField";
import { TPCheckbox }  from "../../components/ui/TPCheckbox";
import TPNumberInput   from "../../components/ui/TPNumberInput";
import TPComboFixed    from "../../components/ui/TPComboFixed";

// Nuevos utils de etiquetas
import { mmToPx }           from "../../utils/units";
import { resolveField }     from "../../utils/labelResolver";
import {
  buildPrintPages,
  calcRowsPerPage,
  type CopiesMap,
} from "../../utils/labelLayout";
import LabelSheet from "../../components/labels/LabelSheet";

import {
  labelTemplatesApi,
  type LabelTemplateRow,
  type LabelElementRow,
} from "../../services/label-templates";
import {
  printerProfilesApi,
  type PrinterProfileRow,
} from "../../services/printer-profiles";

import "../../styles/print-labels.css";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type LabelItem = {
  id:           string;
  code:         string;
  name:         string;
  barcode:      string | null;
  barcodeType:  "CODE128" | "EAN13" | "QR";
  costPrice:    string | null;
  salePrice:    string | null;
  variantName?: string;
  variantCode?: string;
  brand?:       string;
  sku?:         string;
  attrs?:       Record<string, string>;
};

export type LabelPrintModalProps = {
  open:    boolean;
  onClose: () => void;
  items:   LabelItem[];
};

// ─── Modo manual (fallback) ───────────────────────────────────────────────────

type LabelSize = "58x40" | "58x30" | "40x25" | "a4";

const LABEL_SIZE_LABELS: Record<LabelSize, string> = {
  "58x40": "Etiqueta 58×40mm",
  "58x30": "Etiqueta 58×30mm",
  "40x25": "Etiqueta pequeña 40×25mm",
  "a4":    "Hoja A4 (múltiples)",
};

function getSizeConfig(size: LabelSize): { w: number; h: number } {
  return {
    "58x40": { w: 58, h: 40 },
    "58x30": { w: 58, h: 30 },
    "40x25": { w: 40, h: 25 },
    "a4":    { w: 65, h: 42 },
  }[size];
}

// ─── Helpers de formateo ──────────────────────────────────────────────────────

function formatMoney(v: string | null | undefined): string {
  if (!v) return "—";
  const n = parseFloat(v);
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

// ─── Resolución de valor para HTML de impresión ───────────────────────────────

function resolveForHtml(fieldKey: string, item: LabelItem, staticLabel = ""): string {
  // Delegamos al resolver central (misma lógica que el preview)
  const resolved = resolveField(item, fieldKey);
  if (fieldKey === "static") return staticLabel;
  if (!resolved && fieldKey.includes("Price")) return formatMoney(null); // "—" para precios vacíos
  return resolved;
}

// ─── Renderizado de elemento en HTML de impresión ────────────────────────────

function elementToHtml(el: LabelElementRow, item: LabelItem): string {
  const x   = parseFloat(el.x);
  const y   = parseFloat(el.y);
  const w   = parseFloat(el.width);
  const h   = parseFloat(el.height);
  const base = `position:absolute; left:${x}mm; top:${y}mm; width:${w}mm; height:${h}mm; overflow:hidden;`;

  if (el.type === "LINE") {
    return `<div style="${base} background:#333; height:0.3mm; top:${y + h / 2}mm;"></div>`;
  }

  const staticText = el.label || "";
  const rawValue   = resolveForHtml(el.fieldKey, item, staticText);
  const prefix     = (el.fieldKey !== "static" && el.label) ? el.label : "";
  const display    = el.fieldKey === "static" ? staticText : (prefix + rawValue);

  if (el.type === "BARCODE" || el.type === "QR") {
    if (!rawValue && el.fieldKey !== "static") return "";
    let cfg: Record<string, unknown> = {};
    try { cfg = JSON.parse(el.configJson || "{}"); } catch { /* ok */ }
    const fmt = el.type === "QR"
      ? "qrcode"
      : (cfg["barcodeType"] === "EAN13" ? "EAN13" : "CODE128");
    return `<div style="${base} display:flex; align-items:center; justify-content:center;">
      <svg class="bc" data-v="${rawValue}" data-f="${fmt}" style="max-width:${w}mm; max-height:${h}mm;"></svg>
    </div>`;
  }

  if (el.type === "IMAGE") {
    if (!display) return "";
    return `<img src="${display}" style="${base} object-fit:contain;" />`;
  }

  // TEXT
  const justify = el.align === "right"  ? "flex-end"
                : el.align === "center" ? "center"
                :                         "flex-start";
  const textStyle = `${base} font-size:${el.fontSize}pt; font-weight:${el.fontWeight}; text-align:${el.align}; display:flex; align-items:center; justify-content:${justify}; white-space:nowrap;`;
  return `<div style="${textStyle}">${display}</div>`;
}

// ─── Constructor de HTML de impresión (con plantilla) ─────────────────────────
// Usa buildPrintPages para la distribución correcta de etiquetas.

function buildTemplateHtml(
  tpl:      LabelTemplateRow,
  printer:  PrinterProfileRow | null,
  items:    LabelItem[],
  copies:   CopiesMap,
  defaultCopies: number,
): string {
  const lw = parseFloat(tpl.widthMm);
  const lh = parseFloat(tpl.heightMm);

  const isA4      = printer?.type === "A4" || printer?.type === "INKJET";
  const mTop      = printer ? parseFloat(printer.marginTopMm)    : 3;
  const mLeft     = printer ? parseFloat(printer.marginLeftMm)   : 3;
  const mRight    = printer ? parseFloat(printer.marginRightMm)  : 3;
  const mBottom   = printer ? parseFloat(printer.marginBottomMm) : 3;
  const gapH      = printer ? parseFloat(printer.gapHMm)  : 0;
  const gapV      = printer ? parseFloat(printer.gapVMm)  : 2;
  const cols      = printer ? printer.columns : 1;
  const pageH     = printer ? parseFloat(printer.pageHeightMm) : 9999;
  const pageW     = printer ? parseFloat(printer.pageWidthMm)  : lw;

  // Calcular filas por página
  const rows = calcRowsPerPage({
    printerType:    (printer?.type ?? "THERMAL") as "THERMAL" | "ZEBRA" | "A4" | "INKJET",
    pageHeightMm:   pageH,
    marginTopMm:    mTop,
    marginBottomMm: mBottom,
    gapVMm:         gapV,
    labelHeightMm:  lh,
  });
  const safeRows = isFinite(rows) ? rows : 9999;

  // Paginar
  const pages = buildPrintPages({ items, copiesMap: copies, defaultCopies, columns: cols, rows: safeRows });

  const elements = tpl.elements.filter((el) => el.visible !== false);

  // Generar HTML de páginas
  const pagesHtml = pages.map((page) => {
    const labelsHtml = page.map((row) =>
      row.map((item) => {
        const elHtml = elements.map((el) => elementToHtml(el, item)).join("\n");
        return `<div style="position:relative; width:${lw}mm; height:${lh}mm; overflow:hidden; display:inline-block;">${elHtml}</div>`;
      }).join("")
    ).join("\n");

    if (isA4) {
      return `
<div class="lpage" style="position:relative; width:${pageW - mLeft - mRight}mm; padding:0; margin:0;">
  <div style="display:flex; flex-wrap:wrap; gap:${gapV}mm ${gapH}mm;">${labelsHtml}</div>
</div>`;
    } else {
      // Térmica: cada etiqueta con salto de página
      return page.flat().map((item) => {
        const elHtml = elements.map((el) => elementToHtml(el, item)).join("\n");
        return `<div class="lpage" style="position:relative; width:${lw}mm; height:${lh}mm; overflow:hidden;">${elHtml}</div>`;
      }).join("\n");
    }
  }).join("\n");

  const pageRule = isA4
    ? `@page { size: A4; margin: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm; }`
    : `@page { size: ${lw}mm ${lh}mm; margin: 0; }`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiquetas TPTech</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; background:#fff; }
    ${pageRule}
    .lpage { page-break-after: always; break-after: page; }
    .lpage:last-child { page-break-after: avoid; break-after: avoid; }
    @media print { * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
${pagesHtml}
  <script>
    window.onload = function() {
      document.querySelectorAll('svg.bc').forEach(function(svg) {
        var v = svg.getAttribute('data-v');
        var f = svg.getAttribute('data-f') || 'CODE128';
        if (!v) return;
        try { JsBarcode(svg, v, { format: f, displayValue: false, margin: 0, height: 30 }); }
        catch(e) { svg.style.display='none'; }
      });
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;
}

// ─── Constructor HTML modo manual ─────────────────────────────────────────────

function buildManualHtml(
  labelSize:   LabelSize,
  showBarcode: boolean,
  showCode:    boolean,
  showName:    boolean,
  showPrice:   boolean,
  showCost:    boolean,
  items:       LabelItem[],
  copies:      CopiesMap,
  defaultCopies: number,
): string {
  const { w, h } = getSizeConfig(labelSize);
  const isA4      = labelSize === "a4";

  const expanded: LabelItem[] = [];
  for (const item of items) {
    const n = copies[item.id] ?? defaultCopies;
    for (let i = 0; i < n; i++) expanded.push(item);
  }

  const labelsHtml = expanded.map((item) => {
    const hasBC  = showBarcode && item.barcode;
    const name   = item.variantName ? `${item.name} · ${item.variantName}` : item.name;
    const brk    = isA4 ? "" : "page-break-after:always;";
    return `<div class="label" style="width:${w}mm; height:${h}mm; ${brk}">
      ${showName   ? `<div class="ln">${name}</div>` : ""}
      ${showCode   ? `<div class="lc">${item.code}</div>` : ""}
      ${hasBC      ? `<svg class="bc" data-v="${item.barcode}" data-f="${item.barcodeType}" style="max-width:${w - 6}mm; max-height:${h > 35 ? 18 : 14}mm;"></svg>` : ""}
      ${hasBC      ? `<div class="lb">${item.barcode}</div>` : ""}
      ${showPrice  ? `<div class="lp">${formatMoney(item.salePrice)}</div>` : ""}
      ${showCost   ? `<div class="lx">Costo: ${formatMoney(item.costPrice)}</div>` : ""}
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiquetas TPTech</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; background:#fff; }
    ${isA4
      ? `@page { size:A4; margin:10mm; } .wrap { display:flex; flex-wrap:wrap; gap:2mm; }`
      : `@page { size:${w}mm ${h}mm; margin:0; } .wrap {}`}
    .label { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2mm; gap:0.5mm; border:${isA4 ? "0.3mm solid #ccc" : "none"}; overflow:hidden; }
    .ln { font-size:${h > 35 ? "7pt" : "6pt"}; font-weight:bold; text-align:center; overflow:hidden; line-height:1.2; }
    .lc { font-size:6pt; color:#666; font-family:monospace; }
    .bc { display:block; }
    .lb { font-size:5.5pt; color:#444; font-family:monospace; letter-spacing:0.5px; }
    .lp { font-size:${h > 35 ? "10pt" : "8pt"}; font-weight:bold; }
    .lx { font-size:5.5pt; color:#888; }
    @media print { .label { border-color:transparent; } * { -webkit-print-color-adjust:exact; } }
  </style>
</head>
<body>
  <div class="wrap">${labelsHtml}</div>
  <script>
    window.onload = function() {
      document.querySelectorAll('svg.bc').forEach(function(svg) {
        var v = svg.getAttribute('data-v');
        var f = svg.getAttribute('data-f') || 'CODE128';
        if (!v) return;
        try {
          var jf = f === 'EAN13' ? 'EAN13' : f === 'QR' ? 'qrcode' : 'CODE128';
          JsBarcode(svg, v, { format: jf, displayValue: false, margin: 0, height: 30 });
        } catch(e) { svg.style.display='none'; }
      });
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;
}

// ─── Preview escalado (usa LabelSheet + LabelRenderer) ────────────────────────

type PreviewProps = {
  template: LabelTemplateRow;
  printer:  PrinterProfileRow | null;
  items:    LabelItem[];
  copies:   CopiesMap;
  defaultCopies: number;
};

/** Muestra las primeras etiquetas a escala, en grilla según perfil de impresora. */
function LabelPreview({ template, printer, items, copies, defaultCopies }: PreviewProps) {
  const lh   = parseFloat(template.heightMm);
  const cols  = printer?.columns ?? 1;
  const gapH  = printer ? parseFloat(printer.gapHMm)  : 0;
  const gapV  = printer ? parseFloat(printer.gapVMm)  : 2;
  const offX  = printer ? parseFloat(printer.marginLeftMm) : 0;
  const offY  = printer ? parseFloat(printer.marginTopMm)  : 0;

  // Mostrar máximo 1 página en preview
  const rows = Math.min(3, calcRowsPerPage({
    printerType:    (printer?.type ?? "THERMAL") as "THERMAL" | "ZEBRA" | "A4" | "INKJET",
    pageHeightMm:   printer ? parseFloat(printer.pageHeightMm) : 9999,
    marginTopMm:    offY,
    marginBottomMm: printer ? parseFloat(printer.marginBottomMm) : 0,
    gapVMm:         gapV,
    labelHeightMm:  lh,
  }));
  const safeRows = isFinite(rows) ? rows : 3;

  const pages = buildPrintPages({
    items,
    copiesMap:     copies,
    defaultCopies,
    columns: cols,
    rows:    safeRows,
  });

  if (!pages.length || !pages[0].length) {
    // Sin artículos: mostrar etiqueta vacía de demo
    const demoPages = [[
      [{ id: "_demo", name: "Nombre artículo", code: "ART-001", barcode: "1234567890", barcodeType: "CODE128" as const, salePrice: "1500", costPrice: null }],
    ]];
    return <PreviewGrid template={template} pages={demoPages} cols={cols} gapH={gapH} gapV={gapV} offX={offX} offY={offY} />;
  }

  return <PreviewGrid template={template} pages={[pages[0]]} cols={cols} gapH={gapH} gapV={gapV} offX={offX} offY={offY} />;
}

type PreviewGridProps = {
  template: LabelTemplateRow;
  pages:    LabelItem[][][];
  cols:     number;
  gapH:     number;
  gapV:     number;
  offX:     number;
  offY:     number;
};

function PreviewGrid({ template, pages, cols, gapH, gapV, offX, offY }: PreviewGridProps) {
  const PREVIEW_MAX_W = 240; // px disponibles para el preview
  const labelWmm = parseFloat(template.widthMm);

  // Ancho total del layout en mm
  const totalWmm = offX + cols * labelWmm + (cols - 1) * gapH;
  // Escala para que quepa en PREVIEW_MAX_W px (96dpi base)
  const naturalWpx = mmToPx(totalWmm);
  const scale = Math.min(PREVIEW_MAX_W / naturalWpx, 1);

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-slate-100 rounded p-2 overflow-auto"
        style={{ maxHeight: 260, maxWidth: PREVIEW_MAX_W + 16 }}
      >
        <LabelSheet
          template={template}
          pages={pages as unknown as import("../../utils/labelLayout").LabelPage[]}
          columns={cols}
          gapXMm={gapH}
          gapYMm={gapV}
          offsetXMm={offX}
          offsetYMm={offY}
          dpi={96}
          scale={scale}
        />
      </div>
      <span className="text-xs text-muted mt-1">
        {parseFloat(template.widthMm)}×{parseFloat(template.heightMm)} mm
        {cols > 1 ? ` · ${cols} col` : ""}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LabelPrintModal({
  open,
  onClose,
  items: initialItems,
}: LabelPrintModalProps) {
  // ── Carga de API ────────────────────────────────────────────────────────────
  const [templates,  setTemplates]  = useState<LabelTemplateRow[]>([]);
  const [printers,   setPrinters]   = useState<PrinterProfileRow[]>([]);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiLoading(true);
    Promise.all([labelTemplatesApi.list(), printerProfilesApi.list()])
      .then(([tpls, prns]) => {
        const activeTpls = tpls.filter((t) => t.isActive && !t.deletedAt);
        const activePrns = prns.filter((p) => p.isActive  && !p.deletedAt);
        setTemplates(activeTpls);
        setPrinters(activePrns);
        setTemplateId((prev) => prev !== undefined ? prev : (activeTpls.find((t) => t.isDefault)?.id ?? null));
        setPrinterId ((prev) => prev !== undefined ? prev : (activePrns.find((p) => p.isDefault)?.id ?? null));
      })
      .catch(() => { /* silently ignore */ })
      .finally(() => setApiLoading(false));
  }, [open]);

  // ── Selección de plantilla / impresora ─────────────────────────────────────
  const [templateId, setTemplateId] = useState<string | null | undefined>(undefined);
  const [printerId,  setPrinterId]  = useState<string | null | undefined>(undefined);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const selectedPrinter  = printers.find((p)  => p.id === printerId)  ?? null;

  // ── Modo manual ─────────────────────────────────────────────────────────────
  const [labelSize,   setLabelSize]   = useState<LabelSize>("58x40");
  const [showBarcode, setShowBarcode] = useState(true);
  const [showCode,    setShowCode]    = useState(true);
  const [showName,    setShowName]    = useState(true);
  const [showPrice,   setShowPrice]   = useState(true);
  const [showCost,    setShowCost]    = useState(false);

  // ── Copias ──────────────────────────────────────────────────────────────────
  const [copies,       setCopies]       = useState<CopiesMap>({});
  const [globalCopies, setGlobalCopies] = useState<number | null>(1);

  const getCopies    = (id: string) => copies[id] ?? globalCopies ?? 1;
  const setCopiesFor = (id: string, v: number) =>
    setCopies((prev) => ({ ...prev, [id]: Math.max(1, Math.min(99, v)) }));

  const totalLabels = initialItems.reduce((acc, item) => acc + getCopies(item.id), 0);

  // ── Opciones de combo ───────────────────────────────────────────────────────
  const templateOptions = [
    { value: "__manual__", label: "Manual (sin plantilla)" },
    ...templates.map((t) => ({ value: t.id, label: t.name + (t.isDefault ? " ★" : "") })),
  ];
  const printerOptions = [
    { value: "__none__", label: "— Sin perfil —" },
    ...printers.map((p) => ({ value: p.id, label: p.name + (p.isDefault ? " ★" : "") })),
  ];

  // ── Imprimir ────────────────────────────────────────────────────────────────
  function handlePrint() {
    const html = selectedTemplate
      ? buildTemplateHtml(selectedTemplate, selectedPrinter, initialItems, copies, globalCopies ?? 1)
      : buildManualHtml(labelSize, showBarcode, showCode, showName, showPrice, showCost, initialItems, copies, globalCopies ?? 1);

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("El navegador bloqueó la ventana emergente. Permitila para imprimir."); return; }
    win.document.write(html);
    win.document.close();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      title="Imprimir etiquetas"
      onClose={onClose}
      maxWidth="2xl"
      footer={
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1" />
          <TPButton variant="secondary" onClick={onClose}>Cancelar</TPButton>
          <TPButton
            iconLeft={<Printer size={14} />}
            onClick={handlePrint}
            disabled={initialItems.length === 0}
          >
            Imprimir
          </TPButton>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Columna izquierda: configuración ───────────────────────────── */}
        <div className="space-y-4">

          <TPCard title="Plantilla e impresora">
            <div className="space-y-3">
              <TPField label="Plantilla">
                <TPComboFixed
                  value={templateId == null ? "__manual__" : (templateId ?? "__manual__")}
                  onChange={(v) => setTemplateId(v === "__manual__" ? null : v)}
                  options={apiLoading
                    ? [{ value: "__manual__", label: "Cargando…" }]
                    : templateOptions}
                />
              </TPField>

              {selectedTemplate && (
                <TPField label="Perfil de impresora">
                  <TPComboFixed
                    value={printerId ?? "__none__"}
                    onChange={(v) => setPrinterId(v === "__none__" ? null : v)}
                    options={printerOptions}
                  />
                </TPField>
              )}
            </div>

            {/* Preview de plantilla */}
            {selectedTemplate && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1 mb-2">
                  <LayoutTemplate size={12} className="text-muted" />
                  <span className="text-xs text-muted">Vista previa</span>
                </div>
                <LabelPreview
                  template={selectedTemplate}
                  printer={selectedPrinter}
                  items={initialItems}
                  copies={copies}
                  defaultCopies={globalCopies ?? 1}
                />
              </div>
            )}
          </TPCard>

          {/* Configuración manual (solo sin plantilla) */}
          {!selectedTemplate && (
            <>
              <TPCard title="Configuración de etiqueta">
                <TPField label="Tamaño">
                  <TPComboFixed
                    value={labelSize}
                    onChange={(v) => setLabelSize(v as LabelSize)}
                    options={Object.entries(LABEL_SIZE_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                </TPField>
              </TPCard>

              <TPCard title="Campos visibles">
                <div className="space-y-2">
                  <TPCheckbox checked={showBarcode} onChange={setShowBarcode} label="Código de barras (imagen)" />
                  <TPCheckbox checked={showCode}    onChange={setShowCode}    label="Código de artículo" />
                  <TPCheckbox checked={showName}    onChange={setShowName}    label="Nombre" />
                  <TPCheckbox checked={showPrice}   onChange={setShowPrice}   label="Precio de venta" />
                  <TPCheckbox checked={showCost}    onChange={setShowCost}    label="Precio de costo" />
                </div>
              </TPCard>
            </>
          )}

          {/* Copias globales */}
          <TPCard title="Copias">
            <TPField label="Copias por defecto">
              <TPNumberInput
                value={globalCopies}
                onChange={(v) => setGlobalCopies(v)}
                min={1}
                max={99}
                placeholder="1"
              />
            </TPField>
          </TPCard>
        </div>

        {/* ── Columna derecha: lista de artículos ────────────────────────── */}
        <TPCard title={`Artículos (${initialItems.length})`}>
          {initialItems.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No hay artículos seleccionados.</p>
          ) : (
            <div className="space-y-0 max-h-80 overflow-y-auto tp-scroll">
              {initialItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    {item.variantName && (
                      <div className="text-xs text-muted">{item.variantName}</div>
                    )}
                    <div className="text-xs text-muted/60 font-mono">{item.code}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCopiesFor(item.id, getCopies(item.id) - 1)}
                      className="h-6 w-6 rounded border border-border grid place-items-center hover:bg-surface2 text-muted"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="w-7 text-center text-sm tabular-nums">{getCopies(item.id)}</span>
                    <button
                      type="button"
                      onClick={() => setCopiesFor(item.id, getCopies(item.id) + 1)}
                      className="h-6 w-6 rounded border border-border grid place-items-center hover:bg-surface2 text-muted"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <div className="text-xs text-muted/60 w-16 text-right shrink-0 tabular-nums">
                    {item.barcode ?? <span className="text-red-400/60">sin BC</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-2 border-t border-border text-xs text-muted flex items-center gap-1">
            <Tag size={11} />
            Total a imprimir:{" "}
            <strong className="text-text">{totalLabels} etiquetas</strong>
          </div>
        </TPCard>

      </div>
    </Modal>
  );
}
