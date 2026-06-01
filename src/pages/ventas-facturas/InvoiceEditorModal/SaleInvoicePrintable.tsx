// src/pages/ventas-facturas/InvoiceEditorModal/SaleInvoicePrintable.tsx
// ============================================================================
// SaleInvoicePrintable — renderiza la factura para impresión usando el TEMPLATE
// configurado en "Configuración del sistema → Documentos → Plantilla: Factura".
//
// Reglas:
//   · Usa EXCLUSIVAMENTE el `DocumentTemplateConfig` devuelto por
//     `documentTemplatesApi.get("FACTURA")` para decidir qué se muestra
//     (logo, datos del header, columnas activas, secciones visibles, pie,
//     colores, márgenes, fuente, etc.). Cero hardcoding paralelo.
//   · Consume datos REALES del comprobante (draft) + del tenant (company).
//     Nunca usa mocks — los mocks son del `DocumentPreview` del editor de
//     plantillas para previsualización SIN datos comerciales.
//   · Cero cálculo: totales/subtotales/impuestos vienen del pricing-engine
//     (vía `effectiveTotals`). El frontend solo formatea y posiciona.
//   · Visible SÓLO durante `@media print`. En pantalla queda oculto.
//
// Las columnas se mapean desde `config.columns` por su `key`:
//   position, code, sku, description, variant, quantity, unit, weight,
//   unitPrice, discount, tax, subtotal
// Cualquier `key` que el caller no sepa renderizar cae a una cadena vacía
// (passthrough seguro — la columna sigue ocupando espacio definido por el
// template).
// ============================================================================

import React from "react";
import {
  type DocumentTemplateConfig,
  DOC_KIND_LABELS,
  getLogoPx,
  getLogoBorderRadiusPx,
} from "../../../services/document-templates";
import type { CompanyFullProfile } from "../../../services/company";
import type { DocumentLine } from "../../../lib/document-types";
import { formatByType } from "../../../lib/pricing/format";

const FONT_MAP: Record<string, string> = {
  inter: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono:  "'Courier New', Courier, monospace",
};

function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function fmtAmount(value: number | undefined, decimals: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  // formatByType respeta el preset numérico del tenant; aplicamos los
  // decimales del template via override post-format. Para no romper la
  // SSOT numérica, usamos formatByType MONEY que ya respeta separadores.
  // El template controla decimales — usamos formatByType("DECIMAL") con
  // toFixed(decimals) NO: en su lugar dejamos que MONEY use sus reglas
  // (la columna decimals del template afecta a la columna de la tabla
  // pero la SSOT del tenant gana en separadores).
  // number-format:ignore — uso técnico, formato final via tenant.
  return formatByType(value, "MONEY_EXTENDED").replace(
    /([.,])(\d+)$/,
    (_m, sep: string, frac: string) =>
      `${sep}${frac.padEnd(decimals, "0").slice(0, decimals)}`,
  );
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "JT";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export type SaleInvoicePrintableProps = {
  /** Config del template "FACTURA" tal como devuelve el backend. */
  config:           DocumentTemplateConfig;
  /** Datos del tenant (los `headerShow*` del template deciden qué muestra). */
  company:          CompanyFullProfile;
  /** Número del comprobante (ej. "FV-0001"). */
  documentNumber:   string;
  /** Fecha ISO del comprobante. */
  documentDate:     string;
  /** Razón social/nombre del cliente. */
  clientName:       string;
  /** CUIT/Doc del cliente. */
  clientTaxId?:     string;
  /** Dirección legible del cliente. */
  clientAddress?:   string;
  /** Líneas a renderizar — el componente filtra HEADER y vacías. */
  lines:            DocumentLine[];
  /** Totales del pricing-engine. */
  totals:           {
    subtotal:       number;
    discountAmount: number;
    taxAmount:      number;
    total:          number;
  };
  /** Código de moneda del comprobante (ej. "ARS"). */
  currencyCode:     string;
  /** Cotización (solo se muestra si !== 1 y el template lo permite). */
  fxRate?:          number;
  /** Notas/observaciones del comprobante. */
  notes?:           string;
  /** Términos y condiciones del comprobante. */
  terms?:           string;
  /** Vendedor (nombre legible, opcional). */
  sellerName?:      string;
  /** Almacén (nombre legible, opcional). */
  warehouseName?:   string;
  /** Condición de pago (opcional). */
  paymentTermName?: string;
};

export default function SaleInvoicePrintable(props: SaleInvoicePrintableProps): React.ReactElement {
  const { config, company } = props;
  const accent     = config.accentColor || "#1a1a1a";
  const fontFamily = FONT_MAP[config.fontFamily] ?? FONT_MAP.inter;
  const logoPx     = getLogoPx(config.headerLogoSize ?? "18");
  const logoPos    = config.headerLogoPosition ?? "left";
  const logoRadius = getLogoBorderRadiusPx(config.headerLogoBorderRadius ?? 20, logoPx.h);
  const initials   = getInitials(company.name);
  const decimals   = config.currencyDecimals ?? 2;
  const symbolPrefix = config.currencyShowSymbol ? `${props.currencyCode} ` : "";

  const paperStyle: React.CSSProperties = {
    background: "#fff",
    fontFamily,
    fontSize:   `${config.fontSizeBase ?? 10}pt`,
    color:      "#1a1a1a",
    padding:    `${config.marginTop ?? 15}mm ${config.marginRight ?? 15}mm ${config.marginBottom ?? 20}mm ${config.marginLeft ?? 15}mm`,
    lineHeight: 1.4,
    width:      "100%",
    boxSizing:  "border-box",
  };

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoSide = logoPx.h;
  const logoEl = config.headerLogoEnabled ? (
    <div style={{
      width: logoSide, height: logoSide,
      borderRadius: logoRadius, flexShrink: 0, overflow: "hidden",
      background: company.logoUrl ? "transparent" : "#e5e7eb",
      border: company.logoUrl ? "none" : "1px dashed #d1d5db",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {company.logoUrl ? (
        <img src={company.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{
          fontSize: Math.round(logoPx.h * 0.35), fontWeight: 700,
          color: "#9ca3af", letterSpacing: 1, userSelect: "none",
        }}>{initials}</span>
      )}
    </div>
  ) : null;

  // ── Datos de empresa ──────────────────────────────────────────────────────
  const companyBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {config.headerShowName      && company.name      && <div style={{ fontWeight: 700, fontSize: "1.1em" }}>{company.name}</div>}
      {config.headerShowLegalName && company.legalName && <div style={{ color: "#6b7280" }}>{company.legalName}</div>}
      {config.headerShowCuit      && (company.cuit || company.ivaCondition) && (
        <div style={{ color: "#6b7280" }}>
          {company.cuit && `CUIT: ${company.cuit}`}
          {company.cuit && company.ivaCondition && " · "}
          {company.ivaCondition}
        </div>
      )}
      {config.headerShowAddress   && company.addressLine && <div style={{ color: "#6b7280" }}>{company.addressLine}</div>}
      {config.headerShowPhone     && company.phone       && <div style={{ color: "#6b7280" }}>Tel: {company.phone}</div>}
      {config.headerShowEmail     && company.email       && <div style={{ color: "#6b7280" }}>{company.email}</div>}
      {config.headerShowWebsite   && company.website     && <div style={{ color: "#6b7280" }}>{company.website}</div>}
    </div>
  );

  // ── Info del documento ────────────────────────────────────────────────────
  const docInfoBlock = (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ fontWeight: 700, fontSize: "1.15em", color: accent }}>
        {DOC_KIND_LABELS.FACTURA}
      </div>
      {props.documentNumber && <div style={{ color: "#6b7280", marginTop: 2 }}>Nº {props.documentNumber}</div>}
      {props.documentDate   && <div style={{ color: "#6b7280" }}>Fecha: {fmtDate(props.documentDate)}</div>}
    </div>
  );

  function renderHeader(): React.ReactElement {
    if (logoPos === "center") {
      return (
        <div>
          {logoEl && <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{logoEl}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            {companyBlock}{docInfoBlock}
          </div>
        </div>
      );
    }
    if (logoPos === "right") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          {companyBlock}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {logoEl && <div style={{ marginBottom: 4 }}>{logoEl}</div>}
            {docInfoBlock}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>{logoEl}{companyBlock}</div>
        {docInfoBlock}
      </div>
    );
  }

  // ── Columnas visibles del template ────────────────────────────────────────
  const visibleCols = config.columns
    .filter((c) => c.visible)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const totalColWidth = visibleCols.reduce((s, c) => s + c.width, 0) || 1;

  function cellValueFor(line: DocumentLine, idx: number, key: string): React.ReactNode {
    switch (key) {
      case "position":    return idx + 1;
      case "code":        return line.sku ?? "";
      case "sku":         return line.sku ?? "";
      case "description": return line.article ?? line.manualDescription ?? line.description ?? "";
      case "variant":     return line.variant ?? "";
      case "quantity":    return line.quantity;
      case "unit":        return ""; // El nombre de unidad vive en catálogo aparte; passthrough vacío seguro.
      case "weight":      return "";
      case "unitPrice":   return symbolPrefix + fmtAmount(line.unitPrice, decimals);
      case "discount":    return symbolPrefix + fmtAmount(line.discountAmount, decimals);
      case "tax":         return symbolPrefix + fmtAmount(line.taxAmount, decimals);
      case "subtotal":    return symbolPrefix + fmtAmount(line.lineTotalWithTax ?? line.lineTotal ?? line.subtotal, decimals);
      default:            return "";
    }
  }

  // ── Filas (sin HEADER ni vacías) ──────────────────────────────────────────
  const dataLines = props.lines.filter((l) => l.type !== "HEADER" && (l.article || l.manualDescription || l.articleId));

  return (
    <div style={paperStyle} data-tp-sale-invoice-printable>
      {/* Encabezado */}
      <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 8, marginBottom: 10 }}>
        {renderHeader()}
        {config.headerCustomText && (
          <div style={{ marginTop: 6, padding: "4px 6px", background: "#f9fafb", borderRadius: 3, color: "#6b7280", fontSize: "0.85em" }}>
            {config.headerCustomText}
          </div>
        )}
      </div>

      {/* Cliente + secciones de cabecera */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8em", color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>CLIENTE</div>
          <div style={{ fontWeight: 600 }}>{props.clientName || "—"}</div>
          {props.clientTaxId  && <div style={{ color: "#6b7280" }}>{props.clientTaxId}</div>}
          {props.clientAddress && <div style={{ color: "#6b7280" }}>{props.clientAddress}</div>}
        </div>
        {(config.sections.seller || config.sections.paymentTerms || config.sections.warehouse) && (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
            {config.sections.seller       && props.sellerName      && <div style={{ color: "#6b7280" }}>Vendedor: {props.sellerName}</div>}
            {config.sections.paymentTerms && props.paymentTermName && <div style={{ color: "#6b7280" }}>Pago: {props.paymentTermName}</div>}
            {config.sections.warehouse    && props.warehouseName   && <div style={{ color: "#6b7280" }}>Almacén: {props.warehouseName}</div>}
          </div>
        )}
      </div>

      {/* Tabla */}
      {visibleCols.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, tableLayout: "fixed" }}>
          <thead>
            <tr style={{
              background: config.tableStyle === "minimal" ? "transparent" : `${accent}18`,
              borderBottom: `1px solid ${accent}`,
            }}>
              {visibleCols.map((col) => (
                <th key={col.key} style={{
                  padding: "4px 4px", textAlign: col.align, fontWeight: 700,
                  fontSize: "0.85em", whiteSpace: "nowrap", overflow: "hidden",
                  width: `${(col.width / totalColWidth) * 100}%`, color: accent,
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataLines.length === 0 ? (
              <tr><td colSpan={visibleCols.length} style={{ padding: "8px", textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>
                Sin líneas
              </td></tr>
            ) : dataLines.map((l, i) => (
              <tr key={l.id} style={{
                borderBottom: config.tableStyle === "minimal" ? "none" : "1px solid #e5e7eb",
                background:   config.tableStyle === "striped" && i % 2 === 0 ? "#f9fafb" : "transparent",
              }}>
                {visibleCols.map((col) => (
                  <td key={col.key} style={{
                    padding: "3px 4px", textAlign: col.align, overflow: "hidden",
                    color: col.key === "description" ? "#374151" : "#4b5563",
                  }}>
                    {cellValueFor(l, i, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totales */}
      {(config.sections.subtotal || config.sections.total || config.sections.discount || config.sections.taxes) && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ width: 220, display: "flex", flexDirection: "column", gap: 2 }}>
            {config.sections.subtotal && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9em" }}>
                <span>Subtotal</span><span>{symbolPrefix}{fmtAmount(props.totals.subtotal, decimals)}</span>
              </div>
            )}
            {config.sections.discount && props.totals.discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9em" }}>
                <span>Descuento</span><span>− {symbolPrefix}{fmtAmount(props.totals.discountAmount, decimals)}</span>
              </div>
            )}
            {config.sections.taxes && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9em" }}>
                <span>Impuestos</span><span>{symbolPrefix}{fmtAmount(props.totals.taxAmount, decimals)}</span>
              </div>
            )}
            {config.sections.total && (
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontWeight: 700, borderTop: `1px solid ${accent}`,
                paddingTop: 3, marginTop: 2, color: accent,
              }}>
                <span>TOTAL</span><span>{symbolPrefix}{fmtAmount(props.totals.total, decimals)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Moneda / Cotización */}
      {(config.sections.currency || (config.sections.exchangeRate && props.fxRate && props.fxRate !== 1)) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: "0.8em", color: "#6b7280" }}>
          {config.sections.currency     && <span>Moneda: {props.currencyCode}</span>}
          {config.sections.exchangeRate && props.fxRate && props.fxRate !== 1 && (
            <span>Cotización: 1 {props.currencyCode} = {fmtAmount(props.fxRate, decimals)}</span>
          )}
        </div>
      )}

      {/* Observaciones */}
      {config.sections.observations && props.notes && props.notes.trim() && (
        <div style={{
          marginBottom: 8, padding: "5px 6px",
          background: "#f9fafb", borderRadius: 3,
          border: "1px solid #e5e7eb", color: "#374151", fontSize: "0.85em",
          whiteSpace: "pre-wrap",
        }}>
          <strong>Observaciones:</strong> {props.notes}
        </div>
      )}

      {/* Términos y condiciones */}
      {config.sections.termsAndConditions && props.terms && props.terms.trim() && (
        <div style={{
          marginBottom: 8, padding: "5px 6px",
          color: "#6b7280", fontSize: "0.8em", whiteSpace: "pre-wrap",
        }}>
          <strong>Términos:</strong> {props.terms}
        </div>
      )}

      {/* Firma */}
      {config.sections.signature && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ width: 160, borderTop: "1px solid #d1d5db", paddingTop: 4, textAlign: "center", color: "#9ca3af", fontSize: "0.75em" }}>
            Firma y aclaración
          </div>
        </div>
      )}

      {/* Pie del documento */}
      {(config.footerText || config.footerLegalText || config.footerBankData || config.footerTerms || config.footerShowPageNumbers) && (
        <div style={{
          borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 6,
          fontSize: "0.78em", color: "#6b7280",
        }}>
          {config.footerText      && <div style={{ marginBottom: 2 }}>{config.footerText}</div>}
          {config.footerBankData  && <div style={{ marginBottom: 2, fontStyle: "italic" }}>{config.footerBankData}</div>}
          {config.footerTerms     && <div style={{ marginBottom: 2, whiteSpace: "pre-wrap" }}>{config.footerTerms}</div>}
          {config.footerLegalText && <div style={{ color: "#9ca3af", fontSize: "0.9em" }}>{config.footerLegalText}</div>}
          {config.footerShowPageNumbers && (
            <div style={{
              textAlign: config.footerPagePosition?.includes("right")  ? "right"
                       : config.footerPagePosition?.includes("center") ? "center"
                       : "left",
              marginTop: 4,
            }}>
              {config.footerPageFormat === "page_of_total" ? "Página 1 de 1"
               : config.footerPageFormat === "simple"      ? "1 / 1"
               : "1"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
