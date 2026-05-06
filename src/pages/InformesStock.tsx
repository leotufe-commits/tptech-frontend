// src/pages/InformesStock.tsx
// ============================================================================
// Informe de stock — vista base.
//
// Sin backend, sin cálculos reales. Fase 7 enchufará snapshot de inventario,
// rotación por artículo/variante, stock valorizado, sugerencia de reposición.
// ============================================================================

import React, { useState } from "react";
import { Package, Boxes, AlertTriangle, Scale } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtDate, fmtQty } from "../lib/document-helpers";

type StockRow = {
  id: string;
  article: string;
  variant: string;
  warehouse: string;
  qty: number;
  minStock: number;
  lastMovement: string;
};

const COLS: TPColDef[] = [
  { key: "article",      label: "Artículo",                         sortKey: "article" },
  { key: "variant",      label: "Variante",      width: "140px" },
  { key: "warehouse",    label: "Almacén",       width: "150px", sortKey: "warehouse" },
  { key: "qty",          label: "Stock actual",  width: "120px", align: "right", sortKey: "qty" },
  { key: "minStock",     label: "Mín.",          width: "90px",  align: "right" },
  { key: "lastMovement", label: "Último mov.",   width: "120px" },
];

export default function InformesStock() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>(todayISO());

  const rows: StockRow[] = []; // mock vacío — Fase 7

  const kpis: TPKpiItem[] = [
    { id: "items",    label: "Artículos activos", value: 0, hint: "Con stock o movimiento",    tone: "neutral", icon: <Package size={12} /> },
    { id: "unidades", label: "Unidades totales",  value: 0, hint: "Piezas en todos los almacenes", tone: "neutral", icon: <Boxes size={12} /> },
    { id: "criticos", label: "Bajo mínimo",       value: 0, hint: "Necesitan reposición",      tone: "neutral", icon: <AlertTriangle size={12} /> },
    { id: "gramos",   label: "Gramos totales",    value: 0, hint: "Metales en stock",          tone: "neutral", icon: <Scale size={12} /> },
  ];

  function renderRow(
    r: StockRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      article:      <TPTd className="text-sm text-text truncate">{r.article}</TPTd>,
      variant:      <TPTd className="text-sm text-text/80">{r.variant || <span className="text-muted">—</span>}</TPTd>,
      warehouse:    <TPTd className="text-sm text-text/80">{r.warehouse}</TPTd>,
      qty:          <TPTd className="text-right tabular-nums font-semibold">{fmtQty(r.qty)}</TPTd>,
      minStock:     <TPTd className="text-right tabular-nums text-muted">{fmtQty(r.minStock)}</TPTd>,
      lastMovement: <TPTd className="text-sm text-text/80">{fmtDate(r.lastMovement)}</TPTd>,
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
      title="Informe de stock"
      subtitle="Existencias, rotación y reposición sugerida"
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

        <TPTableKit<StockRow>
          rows={rows}
          columns={COLS}
          storageKey="tp_informes_stock_cols"
          sortPersistKey="tp_informes_stock"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "artículo" : "artículos"}`}
          emptyText="Sin datos de stock. Conectá la fuente de inventario (Fase 7) para ver existencias y rotación."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
