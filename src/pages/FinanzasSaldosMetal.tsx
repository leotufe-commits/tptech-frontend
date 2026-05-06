// src/pages/FinanzasSaldosMetal.tsx
// ============================================================================
// Saldos por metal — vista consultiva.
//
// Sin backend, sin conversión real entre metales ni moneda. Fase 7 conectará
// las posiciones de metal (oro, plata, otros) y su valuación en moneda base.
//
// No incluye compensaciones ni conciliación — esas serán pantallas separadas.
// ============================================================================

import React, { useState } from "react";
import { Scale, Coins, TrendingUp, Activity } from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPCard } from "../components/ui/TPCard";
import { TPField } from "../components/ui/TPField";

import { todayISO, fmtMoney, fmtQty } from "../lib/document-helpers";

type MetalBalanceRow = {
  id: string;
  metal: string;       // ej. "Oro", "Plata"
  purity: string;      // ej. "18k", "925"
  grams: number;
  referenceValue: number; // valuación estimada en moneda base
  baseCurrency: string;   // ej. "ARS", "USD"
  lastUpdate: string;     // ISO yyyy-mm-dd
};

const COLS: TPColDef[] = [
  { key: "metal",          label: "Metal",            width: "140px", sortKey: "metal" },
  { key: "purity",         label: "Pureza",           width: "100px" },
  { key: "grams",          label: "Gramos",           width: "140px", align: "right", sortKey: "grams" },
  { key: "referenceValue", label: "Valor estimado",   width: "180px", align: "right", sortKey: "referenceValue" },
  { key: "lastUpdate",     label: "Última cotización",width: "160px" },
];

export default function FinanzasSaldosMetal() {
  const [asOf, setAsOf] = useState<string>(todayISO());

  const rows: MetalBalanceRow[] = []; // mock vacío — Fase 7

  const kpis: TPKpiItem[] = [
    { id: "metales",  label: "Tipos de metal",    value: 0, hint: "Con posición distinta de cero", tone: "neutral", icon: <Coins size={12} /> },
    { id: "gramos",   label: "Gramos totales",    value: 0, hint: "Suma de todos los metales",     tone: "neutral", icon: <Scale size={12} /> },
    { id: "valor",    label: "Valor estimado",    value: 0, hint: "En moneda base (estimación)",    tone: "neutral", icon: <TrendingUp size={12} /> },
    { id: "variacion",label: "Variación período", value: 0, hint: "Cambio vs. corte anterior",      tone: "neutral", icon: <Activity size={12} /> },
  ];

  function renderRow(
    r: MetalBalanceRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      metal:          <TPTd className="text-sm font-semibold text-text">{r.metal}</TPTd>,
      purity:         <TPTd className="text-sm text-text/80">{r.purity}</TPTd>,
      grams:          <TPTd className="text-right tabular-nums font-semibold">{fmtQty(r.grams)} g</TPTd>,
      referenceValue: <TPTd className="text-right tabular-nums text-text/80">{fmtMoney(r.referenceValue, r.baseCurrency)}</TPTd>,
      lastUpdate:     <TPTd className="text-sm text-muted">{r.lastUpdate}</TPTd>,
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
      title="Saldos por metal"
      subtitle="Posición financiera expresada en metales"
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

        <TPTableKit<MetalBalanceRow>
          rows={rows}
          columns={COLS}
          storageKey="tp_finanzas_saldos_metal_cols"
          sortPersistKey="tp_finanzas_saldos_metal"
          columnPicker
          countLabel={(n) => `${n} ${n === 1 ? "metal" : "metales"}`}
          emptyText="Sin saldos de metales. Conectá la fuente de inventario y cotizaciones (Fase 7) para ver la posición."
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}
