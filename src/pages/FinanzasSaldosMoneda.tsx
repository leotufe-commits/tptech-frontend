// src/pages/FinanzasSaldosMoneda.tsx
// ============================================================================
// Saldos por moneda — vista consultiva.
//
// Sin backend, sin conversión real entre monedas. Fase 7 conectará los saldos
// reales desde la cuenta corriente (EntityBalanceEntry) y sumará por moneda.
//
// Esta pantalla NO hace conciliación ni compensaciones — esas serán pantallas
// separadas cuando se agreguen.
// ============================================================================

import React, { useState } from "react";
import { Coins, TrendingUp, TrendingDown, Wallet } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtMoney } from "../lib/document-helpers";

type CurrencyBalanceRow = {
  id: string;
  currency: string;
  receivable: number;   // a cobrar (clientes)
  payable: number;      // a pagar (proveedores)
  cash: number;         // en caja
  net: number;          // saldo neto = receivable - payable + cash
};

const COLS: TPColDef[] = [
  { key: "currency",   label: "Moneda",     width: "100px", sortKey: "currency" },
  { key: "receivable", label: "A cobrar",   width: "160px", align: "right", sortKey: "receivable" },
  { key: "payable",    label: "A pagar",    width: "160px", align: "right", sortKey: "payable" },
  { key: "cash",       label: "En caja",    width: "160px", align: "right", sortKey: "cash" },
  { key: "net",        label: "Saldo neto", width: "180px", align: "right", sortKey: "net" },
];

export default function FinanzasSaldosMoneda() {
  const [asOf, setAsOf] = useState<string>(todayISO());

  const rows: CurrencyBalanceRow[] = []; // mock vacío — Fase 7

  const kpis: TPKpiItem[] = [
    { id: "monedas",   label: "Monedas activas",  value: 0, hint: "Con saldo distinto de cero", tone: "neutral", icon: <Coins size={12} /> },
    { id: "cobrar",    label: "Total a cobrar",   value: 0, hint: "Suma en moneda base",        tone: "neutral", icon: <TrendingUp size={12} /> },
    { id: "pagar",     label: "Total a pagar",    value: 0, hint: "Suma en moneda base",        tone: "neutral", icon: <TrendingDown size={12} /> },
    { id: "neto",      label: "Saldo neto",       value: 0, hint: "Posición global estimada",   tone: "neutral", icon: <Wallet size={12} /> },
  ];

  function renderRow(
    r: CurrencyBalanceRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      currency:   <TPTd className="text-sm font-semibold text-text">{r.currency}</TPTd>,
      receivable: <TPTd className="text-right tabular-nums text-amber-500">{r.receivable > 0 ? fmtMoney(r.receivable, r.currency) : <span className="text-muted">—</span>}</TPTd>,
      payable:    <TPTd className="text-right tabular-nums text-emerald-500">{r.payable > 0 ? fmtMoney(r.payable, r.currency) : <span className="text-muted">—</span>}</TPTd>,
      cash:       <TPTd className="text-right tabular-nums text-text/80">{r.cash !== 0 ? fmtMoney(r.cash, r.currency) : <span className="text-muted">—</span>}</TPTd>,
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
      title="Saldos por moneda"
      subtitle="Posición financiera por divisa"
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={4} />

        <TPCard title="Corte a fecha">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TPField label="Al día">
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="tp-input w-full"
              />
            </TPField>
          </div>
        </TPCard>

        <TPTableKit<CurrencyBalanceRow>
          rows={rows}
          columns={COLS}
          storageKey="tp_finanzas_saldos_moneda_cols"
          sortPersistKey="tp_finanzas_saldos_moneda"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "moneda" : "monedas"}`}
          emptyText="Sin saldos para mostrar. Conectá la fuente de cuenta corriente (Fase 7) para ver la posición por moneda."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
