// src/pages/configuracion-sistema/documentos/DocumentPreview.tsx
// Preview HTML en tiempo real — sin generación de PDF (Phase 1)
import React from "react";
import {
  type DocumentTemplateConfig,
  type DocumentKind,
  DOC_KIND_LABELS,
  getLogoPx,
  getLogoBorderRadiusPx,
} from "../../../services/document-templates";

type Props = {
  config:       DocumentTemplateConfig;
  kind:         DocumentKind;
  companyName?: string;
  logoUrl?:     string;
};

const FONT_MAP: Record<string, string> = {
  inter:  "system-ui, -apple-system, sans-serif",
  serif:  "Georgia, 'Times New Roman', serif",
  mono:   "'Courier New', Courier, monospace",
};

/** Deriva iniciales de 1-2 letras a partir del nombre de la empresa. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "JT";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function DocumentPreview({ config, kind, companyName, logoUrl }: Props) {
  const visibleCols = config.columns.filter((c) => c.visible);
  const fontFamily  = FONT_MAP[config.fontFamily] ?? FONT_MAP.inter;
  const accent      = config.accentColor || "#1a1a1a";
  const logoPx      = getLogoPx(config.headerLogoSize ?? "18");
  const logoPos     = config.headerLogoPosition ?? "left";
  const logoRadius  = getLogoBorderRadiusPx(config.headerLogoBorderRadius ?? 20, logoPx.h);
  const initials    = getInitials(companyName ?? "");

  // Escala de renderizado: A4 portrait (210mm) → 380px ≈ 1.81 px/mm
  const PX_PER_MM = 380 / 210;
  const paperW = Math.round((config.pageWidthMm  ?? 210) * PX_PER_MM);
  const paperH = Math.round((config.pageHeightMm ?? 297) * PX_PER_MM);

  const paperStyle: React.CSSProperties = {
    background: "#fff",
    boxShadow:  "0 2px 16px rgba(0,0,0,0.12)",
    fontFamily,
    fontSize:   `${(config.fontSizeBase ?? 10) * 0.72}px`,
    color:      "#1a1a1a",
    width:      paperW,
    minHeight:  paperH,
    padding:    `${(config.marginTop    ?? 15) * 0.75}px
                 ${(config.marginRight  ?? 15) * 0.75}px
                 ${(config.marginBottom ?? 20) * 0.75}px
                 ${(config.marginLeft   ?? 15) * 0.75}px`,
    lineHeight: 1.4,
  };

  const totalColWidth = visibleCols.reduce((s, c) => s + c.width, 0);

  // ── Logo element ──────────────────────────────────────────────────────────
  // El contenedor es siempre cuadrado (lado = h) para que border-radius 50% dé
  // un círculo real. La imagen usa object-fit: contain para no deformar logos apaisados.
  const logoSide = logoPx.h;

  const logoEl = config.headerLogoEnabled ? (
    <div style={{
      width: logoSide, height: logoSide,
      borderRadius: logoRadius, flexShrink: 0, overflow: "hidden",
      background: logoUrl ? "transparent" : "#e5e7eb",
      border: logoUrl ? "none" : "1px dashed #d1d5db",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{
          fontSize:   Math.round(logoPx.h * 0.35),
          fontWeight: 700,
          color:      "#9ca3af",
          letterSpacing: 1,
          userSelect: "none",
        }}>{initials}</span>
      )}
    </div>
  ) : null;

  // ── Company data block ────────────────────────────────────────────────────
  const companyBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {config.headerShowName      && <div style={{ fontWeight: 700, fontSize: "1.1em" }}>{companyName || "Nombre Comercial"}</div>}
      {config.headerShowLegalName && <div style={{ color: "#6b7280" }}>Razón Social S.R.L.</div>}
      {config.headerShowCuit      && <div style={{ color: "#6b7280" }}>CUIT: 30-12345678-9 · Resp. Inscripto</div>}
      {config.headerShowAddress   && <div style={{ color: "#6b7280" }}>Av. Principal 1234, CABA, Buenos Aires</div>}
      {config.headerShowPhone     && <div style={{ color: "#6b7280" }}>Tel: (011) 1234-5678</div>}
      {config.headerShowEmail     && <div style={{ color: "#6b7280" }}>contacto@empresa.com</div>}
      {config.headerShowWebsite   && <div style={{ color: "#6b7280" }}>www.empresa.com</div>}
    </div>
  );

  // ── Doc info block ────────────────────────────────────────────────────────
  const docInfoBlock = (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ fontWeight: 700, fontSize: "1.15em", color: accent }}>
        {DOC_KIND_LABELS[kind]}
      </div>
      <div style={{ color: "#9ca3af", marginTop: 2 }}>Nº 0001-00001234</div>
      <div style={{ color: "#9ca3af" }}>Fecha: 12/04/2026</div>
    </div>
  );

  // ── Header layout según posición ─────────────────────────────────────────
  function renderHeader() {
    if (logoPos === "center") {
      return (
        <div>
          {logoEl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              {logoEl}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            {companyBlock}
            {docInfoBlock}
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
    // left (default)
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {logoEl}
          {companyBlock}
        </div>
        {docInfoBlock}
      </div>
    );
  }

  return (
    <div style={paperStyle}>

      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 8, marginBottom: 10 }}>
        {renderHeader()}

        {config.headerCustomText && (
          <div style={{ marginTop: 6, padding: "4px 6px", background: "#f9fafb", borderRadius: 3, color: "#6b7280", fontSize: "0.85em" }}>
            {config.headerCustomText}
          </div>
        )}
      </div>

      {/* ── Datos del documento (cliente, vendedor, etc.) ─────────────── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8em", color: "#9ca3af", fontWeight: 600, marginBottom: 2 }}>CLIENTE</div>
          <div style={{ fontWeight: 600 }}>Empresa Cliente S.A.</div>
          <div style={{ color: "#6b7280" }}>CUIT: 20-98765432-1</div>
        </div>
        {(config.sections.seller || config.sections.paymentTerms || config.sections.validityDate) && (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
            {config.sections.seller       && <div style={{ color: "#6b7280" }}>Vendedor: Juan Pérez</div>}
            {config.sections.paymentTerms && <div style={{ color: "#6b7280" }}>Pago: Contado</div>}
            {config.sections.validityDate && <div style={{ color: "#6b7280" }}>Válido hasta: 26/04/2026</div>}
            {config.sections.warehouse    && <div style={{ color: "#6b7280" }}>Almacén: Principal</div>}
          </div>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      {visibleCols.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, tableLayout: "fixed" }}>
          <thead>
            <tr style={{
              background: config.tableStyle === "minimal" ? "transparent" : `${accent}18`,
              borderBottom: `1px solid ${accent}`,
            }}>
              {visibleCols.map((col) => (
                <th key={col.key} style={{
                  padding:    "4px 4px",
                  textAlign:  col.align,
                  fontWeight: 700,
                  fontSize:   "0.85em",
                  whiteSpace: "nowrap",
                  overflow:   "hidden",
                  width:      `${(col.width / totalColWidth) * 100}%`,
                  color:      accent,
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i} style={{
                borderBottom: config.tableStyle === "minimal" ? "none" : "1px solid #e5e7eb",
                background:   config.tableStyle === "striped" && i % 2 === 0 ? "#f9fafb" : "transparent",
              }}>
                {visibleCols.map((col, ci) => (
                  <td key={col.key} style={{
                    padding:   "3px 4px",
                    textAlign: col.align,
                    color:     ci === 0 ? "#374151" : "#9ca3af",
                    overflow:  "hidden",
                  }}>
                    {ci === 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {config.headerShowProductImage && (
                          <div style={{
                            width: 22, height: 22, flexShrink: 0,
                            background: "#e5e7eb", border: "1px solid #d1d5db",
                            borderRadius: 3,
                          }} />
                        )}
                        <span>{`Artículo de muestra ${i}`}</span>
                      </div>
                    ) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Totales ──────────────────────────────────────────────────── */}
      {(config.sections.subtotal || config.sections.total) && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <div style={{ width: 160, display: "flex", flexDirection: "column", gap: 2 }}>
            {config.sections.discount && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9em" }}>
                <span>Descuento</span><span>− $ 500,00</span>
              </div>
            )}
            {config.sections.taxes && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9em" }}>
                <span>IVA 21%</span><span>$ 1.890,00</span>
              </div>
            )}
            {config.sections.subtotal && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "0.9em" }}>
                <span>Subtotal</span><span>$ 9.000,00</span>
              </div>
            )}
            {config.sections.total && (
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontWeight: 700, borderTop: `1px solid ${accent}`,
                paddingTop: 3, marginTop: 2, color: accent,
              }}>
                <span>TOTAL</span><span>$ 10.890,00</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Moneda / Cotización ───────────────────────────────────────── */}
      {(config.sections.currency || config.sections.exchangeRate) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: "0.8em", color: "#9ca3af" }}>
          {config.sections.currency     && <span>Moneda: ARS</span>}
          {config.sections.exchangeRate && <span>Cotización: 1 USD = $ 1.050,00</span>}
        </div>
      )}

      {/* ── Observaciones ────────────────────────────────────────────── */}
      {config.sections.observations && (
        <div style={{
          marginBottom: 8, padding: "5px 6px",
          background: "#f9fafb", borderRadius: 3,
          border: "1px solid #e5e7eb", color: "#9ca3af", fontSize: "0.85em",
        }}>
          Observaciones: (texto libre del operador)
        </div>
      )}

      {/* ── Firma ────────────────────────────────────────────────────── */}
      {config.sections.signature && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ width: 120, borderTop: "1px solid #d1d5db", paddingTop: 4, textAlign: "center", color: "#9ca3af", fontSize: "0.75em" }}>
            Firma y aclaración
          </div>
        </div>
      )}

      {/* ── Pie del documento ─────────────────────────────────────────── */}
      {(config.footerText || config.footerLegalText || config.footerBankData || config.footerShowPageNumbers) && (
        <div style={{
          borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 6,
          fontSize: "0.78em", color: "#9ca3af",
        }}>
          {config.footerText      && <div style={{ marginBottom: 2 }}>{config.footerText}</div>}
          {config.footerBankData  && <div style={{ marginBottom: 2, fontStyle: "italic" }}>{config.footerBankData}</div>}
          {config.footerLegalText && <div style={{ color: "#d1d5db", fontSize: "0.9em" }}>{config.footerLegalText}</div>}
          {config.footerShowPageNumbers && (
            <div style={{
              textAlign: config.footerPagePosition.includes("right")  ? "right"
                       : config.footerPagePosition.includes("center") ? "center"
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
