// src/pages/InformesVentas.tsx
// ============================================================================
// Informe de ventas — vista base.
//
// Sin backend, sin cálculos reales. Estructura lista para que Fase 7 enchufe
// agregados reales (por período, por cliente, por producto). Hoy muestra KPIs
// en cero y tabla vacía.
// ============================================================================

import React, { useState } from "react";
import { ShoppingCart, FileText, Users, Receipt } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtDate } from "../lib/document-helpers";
import { formatMoneyDoc as fmtMoney } from "../lib/pricing/format";

type SalesRow = {
  id: string;
  date: string;
  client: string;
  document: string;
  currency: string;
  total: number;
};

const COLS: TPColDef[] = [
  { key: "date",     label: "Fecha",     width: "110px", sortKey: "date" },
  { key: "document", label: "Documento", width: "130px", sortKey: "document" },
  { key: "client",   label: "Cliente",                   sortKey: "client" },
  { key: "currency", label: "Moneda",    width: "90px" },
  { key: "total",    label: "Total",     width: "140px", align: "right", sortKey: "total" },
];

export default function InformesVentas() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>(todayISO());

  const rows: SalesRow[] = []; // mock vacío — Fase 7 llena con agregados reales

  const kpis: TPKpiItem[] = [
    { id: "facturado", label: "Facturado (total)", value: 0, hint: "Suma de facturas emitidas", tone: "neutral", icon: <ShoppingCart size={12} /> },
    { id: "docs",      label: "Documentos",        value: 0, hint: "Facturas + NC",             tone: "neutral", icon: <FileText size={12} /> },
    { id: "clientes",  label: "Clientes únicos",   value: 0, hint: "Con ventas en el período",  tone: "neutral", icon: <Users size={12} /> },
    { id: "ticket",    label: "Ticket promedio",   value: 0, hint: "Facturado / documentos",    tone: "neutral", icon: <Receipt size={12} /> },
  ];

  function renderRow(
    r: SalesRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      date:     <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      document: <TPTd className="font-mono text-[11px] text-muted">{r.document}</TPTd>,
      client:   <TPTd className="text-sm text-text truncate">{r.client}</TPTd>,
      currency: <TPTd className="text-sm">{r.currency}</TPTd>,
      total:    <TPTd className="text-right tabular-nums font-semibold">{fmtMoney(r.total, r.currency)}</TPTd>,
    };
    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);
    return (
      <TPTr key={r.id}>
        {keys.map((k) => <React.Fragment key={k}>{cells[k]}</React.Fragment>)}
      </TPTr>
    );
  }

  return (
    <TPSectionShell
      title="Informe de ventas"
      subtitle="Facturación, clientes y productos más vendidos"
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={4} />

        <TPCard title="Filtros">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TPField label="Desde">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="tp-input w-full"
              />
            </TPField>
            <TPField label="Hasta">
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="tp-input w-full"
              />
            </TPField>
          </div>
        </TPCard>

        <TPTableKit<SalesRow>
          rows={rows}
          columns={COLS}
          storageKey="tp_informes_ventas_cols"
          sortPersistKey="tp_informes_ventas"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "venta" : "ventas"}`}
          emptyText="Sin ventas en el período seleccionado. Elegí un rango válido o conectá la fuente de datos (Fase 7)."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
