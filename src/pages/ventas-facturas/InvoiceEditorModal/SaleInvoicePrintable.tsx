// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/SaleInvoicePrintable.tsx
//
// Vista imprimible de la Factura de ventas. Es un componente PURO de
// PRESENTACION — recibe los totales calculados por el backend
// (pricing-engine) y los renderea tal cual. No calcula nada.
//
// Se monta fuera del viewport (style position:fixed -100000px) en
// VentasFacturas para que `handlePrintDocument` lo clone y lo abra en
// una ventana popup. El estilo de pagina lo gobierna `printTemplate`
// (configurable en Configuracion del sistema -> Documentos -> Factura).

import React from "react";
import { formatMoneyDoc } from "../../../lib/pricing/format";
import type { DocumentTemplateConfig } from "../../../services/document-templates";
import type { CompanyFullProfile } from "../../../services/company";
import type { DocumentLine } from "../../../lib/document-types";

export type SaleInvoicePrintableTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

export type SaleInvoicePrintableProps = {
  config: DocumentTemplateConfig;
  company: CompanyFullProfile;
  documentNumber: string;
  documentDate: string;
  clientName: string;
  clientTaxId?: string;
  clientAddress?: string;
  lines: DocumentLine[];
  totals: SaleInvoicePrintableTotals;
  currencyCode: string;
  fxRate: number;
  notes?: string;
  terms?: string;
  sellerName?: string;
  warehouseName?: string;
  paymentTermName?: string;
};

function SaleInvoicePrintable(props: SaleInvoicePrintableProps): React.ReactElement {
  const {
    company, documentNumber, documentDate, clientName, clientTaxId, clientAddress,
    lines, totals, currencyCode, notes, terms, sellerName, warehouseName, paymentTermName,
  } = props;

  const renderableLines = lines.filter(
    (l) => l.articleId || l.isManual || (l.type === "HEADER" && l.title),
  );

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 11,
        color: "#111",
        padding: "16mm 14mm",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* Header — empresa */}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
        {company.logoUrl ? (
          <img
            src={company.logoUrl}
            alt=""
            style={{ width: 80, height: 80, objectFit: "contain" }}
          />
        ) : null}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>
            {company.legalName || company.name || "Empresa"}
          </h1>
          {company.cuit && <div>CUIT: {company.cuit}</div>}
          {company.ivaCondition && <div>{company.ivaCondition}</div>}
          {company.addressLine && <div>{company.addressLine}</div>}
          {company.phone && <div>Tel: {company.phone}</div>}
          {company.email && <div>{company.email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>FACTURA</div>
          <div>N&deg; {documentNumber || "—"}</div>
          <div>Fecha: {documentDate || "—"}</div>
        </div>
      </header>

      {/* Cliente */}
      <section
        style={{
          border: "1px solid #ccc",
          padding: 8,
          marginBottom: 12,
          borderRadius: 4,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Cliente</div>
        <div>{clientName || "—"}</div>
        {clientTaxId && <div>{clientTaxId}</div>}
        {clientAddress && <div>{clientAddress}</div>}
      </section>

      {/* Lineas */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: 12,
        }}
      >
        <thead>
          <tr style={{ background: "#f4f4f4" }}>
            <th style={th()}>Articulo</th>
            <th style={th("right")}>Cant.</th>
            <th style={th("right")}>P. unit.</th>
            <th style={th("right")}>Subtotal</th>
            <th style={th("right")}>Total</th>
          </tr>
        </thead>
        <tbody>
          {renderableLines.map((l) => {
            if (l.type === "HEADER") {
              return (
                <tr key={l.id}>
                  <td colSpan={5} style={{ ...td(), fontWeight: 600, background: "#fafafa" }}>
                    {l.title}
                  </td>
                </tr>
              );
            }
            const description = l.isManual
              ? (l.manualDescription || "")
              : `${l.article || ""}${l.variant ? ` - ${l.variant}` : ""}`;
            return (
              <tr key={l.id}>
                <td style={td()}>{description}</td>
                <td style={td("right")}>{l.quantity ?? 0}</td>
                <td style={td("right")}>{formatMoneyDoc(l.unitPrice ?? 0)}</td>
                <td style={td("right")}>{formatMoneyDoc(l.subtotal ?? 0)}</td>
                <td style={td("right")}>{formatMoneyDoc(l.lineTotal ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totales */}
      <section style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={tdTotalsLabel()}>Subtotal</td>
              <td style={tdTotalsValue()}>{formatMoneyDoc(totals.subtotal)}</td>
            </tr>
            {totals.discountAmount > 0 && (
              <tr>
                <td style={tdTotalsLabel()}>Descuento</td>
                <td style={tdTotalsValue()}>-{formatMoneyDoc(totals.discountAmount)}</td>
              </tr>
            )}
            <tr>
              <td style={tdTotalsLabel()}>Impuestos</td>
              <td style={tdTotalsValue()}>{formatMoneyDoc(totals.taxAmount)}</td>
            </tr>
            <tr>
              <td style={{ ...tdTotalsLabel(), fontWeight: 700, fontSize: 13 }}>
                Total ({currencyCode})
              </td>
              <td style={{ ...tdTotalsValue(), fontWeight: 700, fontSize: 13 }}>
                {formatMoneyDoc(totals.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Meta */}
      <section style={{ fontSize: 10, color: "#444" }}>
        {sellerName && <div>Vendedor: {sellerName}</div>}
        {warehouseName && <div>Almacen: {warehouseName}</div>}
        {paymentTermName && <div>Termino de pago: {paymentTermName}</div>}
      </section>

      {/* Observaciones */}
      {notes && (
        <section style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600 }}>Observaciones</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{notes}</div>
        </section>
      )}

      {/* Terminos */}
      {terms && (
        <section style={{ marginTop: 12, fontSize: 10, color: "#444" }}>
          <div style={{ fontWeight: 600 }}>Terminos y condiciones</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{terms}</div>
        </section>
      )}
    </div>
  );
}

function th(align: "left" | "right" = "left"): React.CSSProperties {
  return {
    padding: 6,
    border: "1px solid #ccc",
    textAlign: align,
    fontSize: 11,
  };
}

function td(align: "left" | "right" = "left"): React.CSSProperties {
  return {
    padding: 6,
    border: "1px solid #eee",
    textAlign: align,
    verticalAlign: "top",
  };
}

function tdTotalsLabel(): React.CSSProperties {
  return {
    padding: "4px 12px",
    textAlign: "right",
  };
}
function tdTotalsValue(): React.CSSProperties {
  return {
    padding: "4px 8px",
    textAlign: "right",
    minWidth: 100,
  };
}

export default SaleInvoicePrintable;
