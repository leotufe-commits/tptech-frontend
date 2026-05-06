// src/lib/movementPrint.ts
// Genera HTML de impresión para movimientos usando la plantilla PDF configurada.
// Usado por InventarioArticulosMovimientos y InventarioMovimientos.

import {
  type DocumentTemplateConfig,
  buildLocalDefaultConfig,
} from "../services/document-templates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type MovementPrintLine = {
  description: string;   // nombre artículo o nombre metal
  variant:     string;   // nombre de la variante
  code:        string;   // código de artículo / variante
  sku:         string;   // SKU de la variante
  quantity:    number | null;  // unidades (artículos); null para metales
  unit:        string;         // "un." para artículos, "g" para metales
  weight:      number | null;  // gramos (metales; opcional en artículos)
};

export type MovementPrintData = {
  title:        string;   // "Movimiento de stock" | "Movimiento de metales"
  code:         string;   // "E-0001"
  kindLabel:    string;   // "Entrada" | "Salida" | "Transferencia" | "Ajuste"
  isVoided:     boolean;
  effectiveAt:  string;   // ISO string
  createdAt:    string;   // ISO string
  createdByName: string;
  warehouse:    string;   // "Almacén Principal" o "Origen → Destino"
  note:         string;
  voidedAt:     string;
  voidedByName: string;
  voidedNote:   string;
  lines:        MovementPrintLine[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FONT_MAP: Record<string, string> = {
  inter: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono:  "'Courier New', Courier, monospace",
};

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: string): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("es-AR"); } catch { return d; }
}

function fmtDateTime(d: string): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("es-AR"); } catch { return d; }
}

function fmtGrams(n: number | null): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " g";
}

function fmtQty(n: number | null): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-AR");
}

// ─── Generador principal ──────────────────────────────────────────────────────

/**
 * Genera un documento HTML completo para impresión usando la plantilla configurada.
 * - config: DocumentTemplateConfig obtenida de documentTemplatesApi.get("MOVIMIENTO_STOCK")
 * - data:   datos del movimiento ya formateados
 * - jewelry: datos de la joyería del AuthContext (puede ser null)
 */
export function buildMovementHtmlFromTemplate(
  config: DocumentTemplateConfig,
  data:   MovementPrintData,
  jewelry: Record<string, any> | null
): string {
  const fontFamily = FONT_MAP[config.fontFamily] ?? FONT_MAP.inter;
  const accent     = config.accentColor || "#1a1a1a";
  const mTop    = config.marginTop    ?? 15;
  const mRight  = config.marginRight  ?? 15;
  const mBottom = config.marginBottom ?? 20;
  const mLeft   = config.marginLeft   ?? 15;
  const fontSize = config.fontSizeBase ?? 10;
  const pageW    = config.pageWidthMm  ?? 210;
  const pageH    = config.pageHeightMm ?? 297;

  // Columnas visibles ordenadas
  const visibleCols = [...config.columns]
    .filter(c => c.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const totalWidth = visibleCols.reduce((s, c) => s + c.width, 0) || 1;

  // ── Encabezado empresa ─────────────────────────────────────────────────────

  // Dirección compuesta desde campos individuales del schema
  const addressParts = [
    jewelry?.street && jewelry?.number
      ? `${jewelry.street} ${jewelry.number}${jewelry.floor ? ` piso ${jewelry.floor}` : ""}${jewelry.apartment ? ` dpto. ${jewelry.apartment}` : ""}`
      : jewelry?.street || "",
    jewelry?.city || "",
    jewelry?.province || "",
  ].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  // Teléfono compuesto de prefijo + número
  const fullPhone = [jewelry?.phoneCountry || "", jewelry?.phoneNumber || ""]
    .map(s => String(s).trim())
    .filter(Boolean)
    .join(" ");

  const logoSizePx = config.headerLogoSize === "lg" ? 60 : config.headerLogoSize === "sm" ? 30 : 44;
  const logoHtml = config.headerLogoEnabled
    ? jewelry?.logoUrl
      ? `<img src="${esc(jewelry.logoUrl)}" alt="Logo" style="height:${logoSizePx}px;max-width:120px;object-fit:contain;display:block">`
      : `<div style="width:${logoSizePx}px;height:${Math.round(logoSizePx * 0.73)}px;background:#e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#9ca3af;font-size:${Math.round(logoSizePx * 0.35)}px">${esc((jewelry?.name || "J").slice(0, 2).toUpperCase())}</div>`
    : "";

  const companyLines: string[] = [];
  if (config.headerShowName      && jewelry?.name)        companyLines.push(`<div style="font-weight:700;font-size:1.1em">${esc(jewelry.name)}</div>`);
  if (config.headerShowLegalName && jewelry?.legalName)   companyLines.push(`<div style="color:#6b7280">${esc(jewelry.legalName)}</div>`);
  if (config.headerShowCuit      && jewelry?.cuit)        companyLines.push(`<div style="color:#6b7280">CUIT: ${esc(jewelry.cuit)}</div>`);
  if (config.headerShowAddress   && fullAddress)          companyLines.push(`<div style="color:#6b7280">${esc(fullAddress)}</div>`);
  if (config.headerShowPhone     && fullPhone)            companyLines.push(`<div style="color:#6b7280">Tel: ${esc(fullPhone)}</div>`);
  if (config.headerShowEmail     && jewelry?.email)       companyLines.push(`<div style="color:#6b7280">${esc(jewelry.email)}</div>`);
  if (config.headerShowWebsite   && jewelry?.website)     companyLines.push(`<div style="color:#6b7280">${esc(jewelry.website)}</div>`);

  const customTextHtml = config.headerCustomText
    ? `<div style="margin-top:4px;padding:3px 6px;background:#f9fafb;border-radius:3px;color:#6b7280;font-size:0.85em">${esc(config.headerCustomText)}</div>`
    : "";

  // ── Tabla de líneas ────────────────────────────────────────────────────────

  const theadCells = visibleCols.map(col =>
    `<th style="padding:6px 8px;text-align:${col.align};font-weight:700;font-size:0.82em;` +
    `color:${accent};text-transform:uppercase;letter-spacing:.04em;` +
    `width:${((col.width / totalWidth) * 100).toFixed(1)}%;` +
    `border-bottom:2px solid ${accent}">${esc(col.label)}</th>`
  ).join("");

  const tbodyRows = data.lines.map((l, i) => {
    const bg = config.tableStyle === "striped" && i % 2 === 1 ? "#f9fafb" : "transparent";
    const rowBorder = config.tableStyle !== "minimal" ? "1px solid #e5e7eb" : "none";

    const cells = visibleCols.map(col => {
      let val = "—";
      switch (col.key) {
        case "position":    val = String(i + 1);           break;
        case "description": val = esc(l.description || "—"); break;
        case "variant":     val = esc(l.variant     || "—"); break;
        case "code":        val = esc(l.code        || "—"); break;
        case "sku":         val = esc(l.sku         || "—"); break;
        case "quantity":    val = fmtQty(l.quantity);         break;
        case "unit":        val = esc(l.unit        || "—"); break;
        case "weight":      val = fmtGrams(l.weight);         break;
      }
      return `<td style="padding:6px 8px;text-align:${col.align};border-bottom:${rowBorder}">${val}</td>`;
    }).join("");

    return `<tr style="background:${bg}">${cells}</tr>`;
  }).join("") || `<tr><td colspan="${visibleCols.length}" style="padding:12px;text-align:center;color:#9ca3af">Sin líneas</td></tr>`;

  // ── Secciones opcionales ───────────────────────────────────────────────────

  const voidedBanner = data.isVoided
    ? `<div style="margin-bottom:10px;padding:8px 12px;background:#fee2e2;border-radius:4px;border:1px solid #fca5a5;color:#991b1b;font-size:0.85em">
         <strong>ANULADO</strong> — ${fmtDateTime(data.voidedAt)} por ${esc(data.voidedByName) || "—"}
         ${data.voidedNote ? ` — ${esc(data.voidedNote)}` : ""}
       </div>`
    : "";

  const observationsHtml = config.sections.observations && data.note
    ? `<div style="margin-bottom:10px;padding:8px 10px;background:#f9fafb;border-radius:4px;border:1px solid #e5e7eb;font-size:0.85em;color:#374151">
         <strong>Observaciones:</strong> ${esc(data.note)}
       </div>`
    : "";

  const signatureHtml = config.sections.signature
    ? `<div style="display:flex;justify-content:flex-end;margin-top:24px">
         <div style="width:140px;border-top:1px solid #d1d5db;padding-top:6px;text-align:center;font-size:0.78em;color:#9ca3af">Firma y aclaración</div>
       </div>`
    : "";

  const hasFooter = config.footerText || config.footerLegalText || config.footerBankData || config.footerShowPageNumbers;
  const footerHtml = hasFooter
    ? `<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:8px;font-size:0.78em;color:#9ca3af">
         ${config.footerText      ? `<div style="margin-bottom:2px">${esc(config.footerText)}</div>` : ""}
         ${config.footerBankData  ? `<div style="font-style:italic;margin-bottom:2px">${esc(config.footerBankData)}</div>` : ""}
         ${config.footerLegalText ? `<div style="color:#d1d5db">${esc(config.footerLegalText)}</div>` : ""}
         ${config.footerShowPageNumbers ? `<div style="text-align:right;margin-top:4px">Página 1 de 1</div>` : ""}
       </div>`
    : `<div style="border-top:1px solid #f0f0f0;margin-top:20px;padding-top:8px;font-size:0.78em;color:#bbb;text-align:center">
         Impreso el ${new Date().toLocaleString("es-AR")} · TPTech
       </div>`;

  // Almacén: se muestra en la grilla de info del documento si sections.warehouse está activo
  const warehouseCell = config.sections.warehouse
    ? `<div style="padding:8px 0">
         <div style="font-size:0.78em;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">Almacén</div>
         <div>${esc(data.warehouse) || "—"}</div>
       </div>`
    : "";

  // ── HTML completo ──────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(data.title)} ${esc(data.code)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize}pt;
      color: #111;
      padding: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm;
      max-width: ${pageW}mm;
      margin: 0 auto;
      line-height: 1.4;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    @media print {
      @page { margin: 0; size: ${pageW}mm ${pageH}mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- ENCABEZADO -->
  <div style="border-bottom:2px solid ${accent};padding-bottom:10px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="display:flex;gap:10px;align-items:flex-start">
        ${logoHtml ? `<div style="flex-shrink:0">${logoHtml}</div>` : ""}
        <div style="display:flex;flex-direction:column;gap:2px">
          ${companyLines.join("\n          ")}
          ${customTextHtml}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:700;font-size:1.15em;color:${accent}">${esc(data.title)}</div>
        <div style="color:#6b7280;font-family:monospace;margin-top:2px">${esc(data.code) || "—"}</div>
        <div style="color:#9ca3af">${fmtDate(data.effectiveAt)}</div>
      </div>
    </div>
  </div>

  <!-- GRILLA DE CAMPOS -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:14px;font-size:0.9em">
    <div style="padding:4px 0">
      <div style="font-size:0.78em;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Tipo</div>
      <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.85em;font-weight:700;background:${accent}18;color:${accent}">${esc(data.kindLabel)}</span>
    </div>
    <div style="padding:4px 0">
      <div style="font-size:0.78em;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Estado</div>
      <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.85em;font-weight:700;background:${data.isVoided ? "#fee2e2" : "#dcfce7"};color:${data.isVoided ? "#991b1b" : "#166534"}">${data.isVoided ? "Anulado" : "Confirmado"}</span>
    </div>
    <div style="padding:4px 0">
      <div style="font-size:0.78em;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Fecha efectiva</div>
      <div>${fmtDate(data.effectiveAt)}</div>
    </div>
    <div style="padding:4px 0">
      <div style="font-size:0.78em;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Registrado</div>
      <div>${fmtDateTime(data.createdAt)}</div>
    </div>
    <div style="padding:4px 0">
      <div style="font-size:0.78em;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Operador</div>
      <div>${esc(data.createdByName) || "—"}</div>
    </div>
    ${warehouseCell}
  </div>

  ${voidedBanner}
  ${observationsHtml}

  <!-- TABLA DE LÍNEAS -->
  <table>
    <thead>
      <tr style="background:${config.tableStyle === "minimal" ? "transparent" : accent + "0f"}">
        ${theadCells}
      </tr>
    </thead>
    <tbody>
      ${tbodyRows}
    </tbody>
  </table>

  ${signatureHtml}
  ${footerHtml}

</body>
</html>`;
}

// ─── Función de impresión ─────────────────────────────────────────────────────

/**
 * Abre una ventana nueva, carga la plantilla MOVIMIENTO_STOCK y dispara la impresión.
 * - Si no hay plantilla configurada o falla la carga → usa la config por defecto.
 * - Llama a window.open() sincrónicamente para evitar que el navegador lo bloquee.
 */
export async function printMovement(
  data:     MovementPrintData,
  jewelry:  Record<string, any> | null,
  getTemplate: () => Promise<DocumentTemplateConfig>
): Promise<void> {
  const win = window.open("", "_blank", "width=920,height=700");
  if (!win) {
    // No lanzar toast aquí — el llamador lo maneja
    throw new Error("blocked");
  }

  // Mostrar loading inmediatamente mientras se carga la plantilla
  win.document.write(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#888;font-size:14px">
       Generando documento…
     </body></html>`
  );

  let config: DocumentTemplateConfig;
  try {
    config = await getTemplate();
  } catch {
    config = buildLocalDefaultConfig("MOVIMIENTO_STOCK", "A4");
  }

  const html = buildMovementHtmlFromTemplate(config, data, jewelry);
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
