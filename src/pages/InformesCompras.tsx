// src/pages/InformesCompras.tsx
// ============================================================================
// Informe de compras — vista base.
//
// Sin backend, sin cálculos reales. Estructura lista para que Fase 7 enchufe
// agregados reales (por proveedor, por período, por categoría).
// ============================================================================

import React, { useState } from "react";
import { ShoppingBag, FileText, Truck, Receipt } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtDate } from "../lib/document-helpers";
import { formatMoneyDoc as fmtMoney } from "../lib/pricing/format";

type PurchaseRow = {
  id: string;
  date: string;
  supplier: string;
  document: string;
  currency: string;
  total: number;
};

const COLS: TPColDef[] = [
  { key: "date",     label: "Fecha",     width: "110px", sortKey: "date" },
  { key: "document", label: "Documento", width: "130px", sortKey: "document" },
  { key: "supplier", label: "Proveedor",                 sortKey: "supplier" },
  { key: "currency", label: "Moneda",    width: "90px" },
  { key: "total",    label: "Total",     width: "140px", align: "right", sortKey: "total" },
];

export default function InformesCompras() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>(todayISO());

  const rows: PurchaseRow[] = []; // mock vacío — Fase 7

  const kpis: TPKpiItem[] = [
    { id: "comprado",    label: "Gasto (total)",      value: 0, hint: "Suma de facturas proveedor", tone: "neutral", icon: <ShoppingBag size={12} /> },
    { id: "ocs",         label: "Órdenes emitidas",   value: 0, hint: "OC del período",             tone: "neutral", icon: <FileText size={12} /> },
    { id: "proveedores", label: "Proveedores únicos", value: 0, hint: "Con compras en el período",  tone: "neutral", icon: <Truck size={12} /> },
    { id: "ticket",      label: "Ticket promedio",    value: 0, hint: "Gasto / facturas",            tone: "neutral", icon: <Receipt size={12} /> },
  ];

  function renderRow(
    r: PurchaseRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      date:     <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      document: <TPTd className="font-mono text-[11px] text-muted">{r.document}</TPTd>,
      supplier: <TPTd className="text-sm text-text truncate">{r.supplier}</TPTd>,
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
      title="Informe de compras"
      subtitle="Órdenes, proveedores y evolución del gasto"
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

        <TPTableKit<PurchaseRow>
          rows={rows}
          columns={COLS}
          storageKey="tp_informes_compras_cols"
          sortPersistKey="tp_informes_compras"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "compra" : "compras"}`}
          emptyText="Sin compras en el período seleccionado. Elegí un rango válido o conectá la fuente de datos (Fase 7)."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
