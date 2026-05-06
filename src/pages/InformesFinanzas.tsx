// src/pages/InformesFinanzas.tsx
// ============================================================================
// Informe financiero — vista base.
//
// Sin backend, sin cálculos reales. Fase 7 enchufará saldos reales por moneda,
// aging de deuda, flujo de caja por período, posición por metal.
// ============================================================================

import React, { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Activity } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtMoney } from "../lib/document-helpers";

type FinanceRow = {
  id: string;
  currency: string;
  receivable: number;
  payable: number;
  net: number;
};

const COLS: TPColDef[] = [
  { key: "currency",   label: "Moneda",         width: "100px", sortKey: "currency" },
  { key: "receivable", label: "A cobrar",       width: "160px", align: "right", sortKey: "receivable" },
  { key: "payable",    label: "A pagar",        width: "160px", align: "right", sortKey: "payable" },
  { key: "net",        label: "Saldo neto",     width: "180px", align: "right", sortKey: "net" },
];

export default function InformesFinanzas() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo]     = useState<string>(todayISO());

  const rows: FinanceRow[] = []; // mock vacío — Fase 7

  const kpis: TPKpiItem[] = [
    { id: "cobrar",  label: "Total a cobrar",  value: 0, hint: "Clientes con deuda",     tone: "neutral", icon: <TrendingUp size={12} /> },
    { id: "pagar",   label: "Total a pagar",   value: 0, hint: "Proveedores con deuda",  tone: "neutral", icon: <TrendingDown size={12} /> },
    { id: "neto",    label: "Saldo neto",      value: 0, hint: "A cobrar − a pagar",     tone: "neutral", icon: <Wallet size={12} /> },
    { id: "movs",    label: "Movimientos",     value: 0, hint: "Asientos en el período", tone: "neutral", icon: <Activity size={12} /> },
  ];

  function renderRow(
    r: FinanceRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      currency:   <TPTd className="text-sm font-semibold text-text">{r.currency}</TPTd>,
      receivable: <TPTd className="text-right tabular-nums text-amber-500">{fmtMoney(r.receivable, r.currency)}</TPTd>,
      payable:    <TPTd className="text-right tabular-nums text-emerald-500">{fmtMoney(r.payable, r.currency)}</TPTd>,
      net:        <TPTd className={`text-right tabular-nums font-bold ${r.net > 0 ? "text-amber-500" : r.net < 0 ? "text-emerald-500" : "text-text"}`}>{fmtMoney(r.net, r.currency)}</TPTd>,
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
      title="Informe financiero"
      subtitle="Saldos, deuda y flujo de caja por moneda"
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

        <TPTableKit<FinanceRow>
          rows={rows}
          columns={COLS}
          storageKey="tp_informes_finanzas_cols"
          sortPersistKey="tp_informes_finanzas"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "moneda" : "monedas"}`}
          emptyText="Sin datos financieros. Conectá la fuente de cuenta corriente (Fase 7) para ver saldos por moneda."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
