// src/pages/FinanzasMovimientos.tsx
// ============================================================================
// Movimientos financieros — vista base consultiva.
//
// Sin backend, sin cálculos reales. Fase 7 enchufará EntityBalanceEntry /
// asientos financieros (ingresos, egresos, ajustes internos). Hoy: estructura
// lista + KPIs en cero + tabla vacía.
//
// No incluye conciliación ni compensaciones — esas serán pantallas separadas
// cuando se agreguen en la próxima fase.
// ============================================================================

import React, { useState } from "react";
import { Activity, TrendingUp, TrendingDown, Wallet } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtDate, fmtMoney } from "../lib/document-helpers";

type MovementKind = "INCOME" | "EXPENSE" | "ADJUSTMENT";

type FinancialMovement = {
  id: string;
  date: string;
  kind: MovementKind;
  description: string;
  currency: string;
  debit: number;
  credit: number;
};

const KIND_LABEL: Record<MovementKind, string> = {
  INCOME:     "Ingreso",
  EXPENSE:    "Egreso",
  ADJUSTMENT: "Ajuste",
};

const COLS: TPColDef[] = [
  { key: "date",        label: "Fecha",       width: "110px", sortKey: "date" },
  { key: "kind",        label: "Tipo",        width: "120px", sortKey: "kind" },
  { key: "description", label: "Descripción",                 sortKey: "description" },
  { key: "currency",    label: "Moneda",      width: "90px" },
  { key: "debit",       label: "Ingreso",     width: "130px", align: "right", sortKey: "debit" },
  { key: "credit",      label: "Egreso",      width: "130px", align: "right", sortKey: "credit" },
];

export default function FinanzasMovimientos() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>(todayISO());

  const rows: FinancialMovement[] = []; // mock vacío — Fase 7

  const kpis: TPKpiItem[] = [
    { id: "total",     label: "Movimientos",  value: 0, hint: "Asientos del período",    tone: "neutral", icon: <Activity size={12} /> },
    { id: "ingresos",  label: "Ingresos",     value: 0, hint: "Suma de entradas",        tone: "neutral", icon: <TrendingUp size={12} /> },
    { id: "egresos",   label: "Egresos",      value: 0, hint: "Suma de salidas",         tone: "neutral", icon: <TrendingDown size={12} /> },
    { id: "saldoNeto", label: "Saldo neto",   value: 0, hint: "Ingresos − egresos",      tone: "neutral", icon: <Wallet size={12} /> },
  ];

  function renderRow(
    r: FinancialMovement,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      date:        <TPTd className="text-sm text-text/80">{fmtDate(r.date)}</TPTd>,
      kind:        <TPTd className="text-sm text-text/80">{KIND_LABEL[r.kind]}</TPTd>,
      description: <TPTd className="text-sm text-text truncate">{r.description}</TPTd>,
      currency:    <TPTd className="text-sm">{r.currency}</TPTd>,
      debit:       <TPTd className="text-right tabular-nums text-emerald-500">{r.debit > 0 ? fmtMoney(r.debit, r.currency) : <span className="text-muted">—</span>}</TPTd>,
      credit:      <TPTd className="text-right tabular-nums text-amber-500">{r.credit > 0 ? fmtMoney(r.credit, r.currency) : <span className="text-muted">—</span>}</TPTd>,
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
      title="Movimientos financieros"
      subtitle="Ingresos, egresos y ajustes financieros"
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

        <TPTableKit<FinancialMovement>
          rows={rows}
          columns={COLS}
          storageKey="tp_finanzas_movimientos_cols"
          sortPersistKey="tp_finanzas_movimientos"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "movimiento" : "movimientos"}`}
          emptyText="Sin movimientos financieros en el período. Conectá la fuente de datos (Fase 7) para ver ingresos, egresos y ajustes."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
