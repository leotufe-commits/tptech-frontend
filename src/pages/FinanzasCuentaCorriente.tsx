// src/pages/FinanzasCuentaCorriente.tsx
// ============================================================================
// Cuenta corriente — ledger consultivo por entidad.
//
// Estado 100% local (useState) con data mock. Sin backend, sin recálculo real
// de saldos, sin conciliación. Preparada para Fase 6, cuando se conecte con
// EntityBalanceEntry en el backend.
//
// Este módulo deja el andamio multi-moneda + metales desde el diseño:
//   · cada movimiento lleva su `currency`
//   · el saldo acumulado se calcula POR MONEDA por separado (no se mezclan)
//   · el campo `metalAmount` está preparado para cuando entre la capa de metales
//
// Sigue el mismo patrón visual que las pantallas de Compras:
//   TPSectionShell + TPKpiBar + TPTableKit v2.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  FileText,
  ExternalLink,
  Info,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPBadge } from "../components/ui/TPBadges";
import { TPActionsMenu, type TPActionsMenuItem } from "../components/ui/TPActionsMenu";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPSelect from "../components/ui/TPSelect";

import { toast } from "../lib/toast";
import {
  round2,
  fmtDate,
} from "../lib/document-helpers";
import { formatMoneyDoc as fmtMoney } from "../lib/pricing/format";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type AccountMovementType =
  | "PURCHASE_INVOICE"
  | "SALE_INVOICE"
  | "PAYMENT"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "ADJUSTMENT";

const MOVEMENT_LABELS: Record<AccountMovementType, string> = {
  PURCHASE_INVOICE: "Factura proveedor",
  SALE_INVOICE:     "Factura venta",
  PAYMENT:          "Pago",
  CREDIT_NOTE:      "Nota crédito",
  DEBIT_NOTE:       "Nota débito",
  ADJUSTMENT:       "Ajuste",
};

const MOVEMENT_TYPE_OPTIONS = (Object.keys(MOVEMENT_LABELS) as AccountMovementType[]).map(
  (k) => ({ value: k, label: MOVEMENT_LABELS[k] }),
);

type LedgerMovement = {
  id: string;
  entityName: string;
  date: string;                 // ISO yyyy-mm-dd
  type: AccountMovementType;
  documentRef: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  /** Preparación para capa de metales (Fase 6). No se muestra hoy. */
  metalAmount?: number;
};

// Fila enriquecida con saldo acumulado por moneda (calculada en frontend)
type LedgerRow = LedgerMovement & {
  cumBalance: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Data mock
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DATA: LedgerMovement[] = [
  // Proveedor Demo A — ARS
  { id: "m1", entityName: "Proveedor Demo A", date: "2026-03-10", type: "PURCHASE_INVOICE", documentRef: "FP-0001", description: "Compra de mercadería", debit: 250000, credit: 0,      currency: "ARS" },
  { id: "m2", entityName: "Proveedor Demo A", date: "2026-03-25", type: "PAYMENT",          documentRef: "PP-0001", description: "Pago transferencia",     debit: 0,      credit: 150000, currency: "ARS" },
  { id: "m3", entityName: "Proveedor Demo A", date: "2026-04-02", type: "PURCHASE_INVOICE", documentRef: "FP-0005", description: "Reposición stock",       debit: 80000,  credit: 0,      currency: "ARS" },
  { id: "m4", entityName: "Proveedor Demo A", date: "2026-04-18", type: "CREDIT_NOTE",      documentRef: "NC-0001", description: "Bonif. post-venta",      debit: 0,      credit: 10000,  currency: "ARS" },
  { id: "m5", entityName: "Proveedor Demo A", date: "2026-04-20", type: "PAYMENT",          documentRef: "PP-0004", description: "Pago parcial",           debit: 0,      credit: 40000,  currency: "ARS" },

  // Proveedor Demo B — mix USD + ARS
  { id: "m6",  entityName: "Proveedor Demo B", date: "2026-03-15", type: "PURCHASE_INVOICE", documentRef: "FP-0002", description: "Servicio mensual",     debit: 500,    credit: 0,    currency: "USD" },
  { id: "m7",  entityName: "Proveedor Demo B", date: "2026-04-01", type: "PAYMENT",          documentRef: "PP-0002", description: "Pago mensual",         debit: 0,      credit: 500,  currency: "USD" },
  { id: "m8",  entityName: "Proveedor Demo B", date: "2026-04-05", type: "PURCHASE_INVOICE", documentRef: "FP-0010", description: "Extras ARS",           debit: 35000,  credit: 0,    currency: "ARS" },
  { id: "m9",  entityName: "Proveedor Demo B", date: "2026-04-15", type: "ADJUSTMENT",       documentRef: "AJ-0001", description: "Ajuste bonificación",  debit: 0,      credit: 5000, currency: "ARS" },

  // Cliente Demo C — SALE_INVOICE (para que aparezca el tipo de venta)
  { id: "m10", entityName: "Cliente Demo C", date: "2026-04-10", type: "SALE_INVOICE", documentRef: "VTA-0012", description: "Venta de anillo",            debit: 120000, credit: 0,      currency: "ARS" },
  { id: "m11", entityName: "Cliente Demo C", date: "2026-04-12", type: "PAYMENT",      documentRef: "CP-0004", description: "Cobro tarjeta",              debit: 0,      credit: 60000,  currency: "ARS" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function typeBadge(t: AccountMovementType) {
  switch (t) {
    case "PURCHASE_INVOICE": return <TPBadge tone="warning" size="sm">{MOVEMENT_LABELS[t]}</TPBadge>;
    case "SALE_INVOICE":     return <TPBadge tone="info"    size="sm">{MOVEMENT_LABELS[t]}</TPBadge>;
    case "PAYMENT":          return <TPBadge tone="success" size="sm">{MOVEMENT_LABELS[t]}</TPBadge>;
    case "CREDIT_NOTE":      return <TPBadge tone="success" size="sm">{MOVEMENT_LABELS[t]}</TPBadge>;
    case "DEBIT_NOTE":       return <TPBadge tone="warning" size="sm">{MOVEMENT_LABELS[t]}</TPBadge>;
    case "ADJUSTMENT":       return <TPBadge tone="neutral" size="sm">{MOVEMENT_LABELS[t]}</TPBadge>;
  }
}

/**
 * Calcula saldo acumulado POR MONEDA por separado.
 * - Orden cronológico ASC dentro de cada moneda.
 * - cumBalance = Σ (debit - credit) hasta esa fecha en esa moneda.
 */
function computeCumulativeBalances(movs: LedgerMovement[]): LedgerRow[] {
  const byCurrency = new Map<string, LedgerMovement[]>();
  for (const m of movs) {
    const arr = byCurrency.get(m.currency) ?? [];
    arr.push(m);
    byCurrency.set(m.currency, arr);
  }

  const out: LedgerRow[] = [];
  for (const [, group] of byCurrency) {
    // Orden cronológico estable: por fecha, y como tiebreaker por id.
    group.sort((a, b) => {
      const ad = a.date || "";
      const bd = b.date || "";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
    let running = 0;
    for (const m of group) {
      running = round2(running + (m.debit || 0) - (m.credit || 0));
      out.push({ ...m, cumBalance: running });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "date",        label: "Fecha",            width: "110px", sortKey: "date" },
  { key: "type",        label: "Tipo",             width: "150px", sortKey: "type" },
  { key: "documentRef", label: "Documento",        width: "130px", sortKey: "documentRef" },
  { key: "description", label: "Descripción",                      sortKey: "description" },
  { key: "debit",       label: "Debe",             width: "130px", align: "right", sortKey: "debit" },
  { key: "credit",      label: "Haber",            width: "130px", align: "right", sortKey: "credit" },
  { key: "cumBalance",  label: "Saldo acumulado",  width: "150px", align: "right" },
  { key: "currency",    label: "Moneda",           width: "90px" },
  { key: "actions",     label: "",                 width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type TypeFilter = "ALL" | AccountMovementType;

export default function FinanzasCuentaCorriente() {
  // Data (mock por ahora — useState para que sea reemplazable por fetch en Fase 6)
  const [movements] = useState<LedgerMovement[]>(MOCK_DATA);

  // Selector de entidad
  const [entity, setEntity] = useState<string>("");

  // Filtros
  const [q, setQ]                           = useState("");
  const [typeFilter, setTypeFilter]         = useState<TypeFilter>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");

  // ── Opciones derivadas del mock ──────────────────────────────────────────
  const entityOptions = useMemo(() => {
    const uniq = Array.from(new Set(movements.map((m) => m.entityName).filter(Boolean))).sort();
    return [
      { value: "", label: "— Seleccionar entidad —" },
      ...uniq.map((e) => ({ value: e, label: e })),
    ];
  }, [movements]);

  const currencyOptions = useMemo(() => {
    const uniq = Array.from(new Set(movements.map((m) => m.currency).filter(Boolean))).sort();
    return [
      { value: "ALL", label: "Todas las monedas" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [movements]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "ALL", label: "Todos los tipos" },
    ...MOVEMENT_TYPE_OPTIONS,
  ];

  // ── Filtrado + cálculo de saldo acumulado ───────────────────────────────
  const rows: LedgerRow[] = useMemo(() => {
    if (!entity) return [];

    // 1. Filtro por entidad
    let base = movements.filter((m) => m.entityName === entity);

    // 2. Cálculo de saldo acumulado (por moneda) sobre TODA la historia de la entidad.
    //    El saldo refleja la realidad histórica — los filtros de tipo/fecha/moneda
    //    se aplican DESPUÉS del cálculo, sobre las filas ya enriquecidas.
    let enriched = computeCumulativeBalances(base);

    // 3. Filtros restantes
    if (typeFilter !== "ALL")     enriched = enriched.filter((r) => r.type === typeFilter);
    if (currencyFilter !== "ALL") enriched = enriched.filter((r) => r.currency === currencyFilter);
    if (dateFrom)                 enriched = enriched.filter((r) => r.date >= dateFrom);
    if (dateTo)                   enriched = enriched.filter((r) => r.date <= dateTo);

    // 4. Search
    const term = q.trim().toLowerCase();
    if (term) {
      enriched = enriched.filter((r) =>
        `${r.documentRef} ${r.description}`.toLowerCase().includes(term),
      );
    }

    return enriched;
  }, [movements, entity, typeFilter, currencyFilter, dateFrom, dateTo, q]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    // Saldo total: suma naive (mezcla monedas). El hint del banner superior
    // avisa que la conversión multi-moneda real llega en Fase 6.
    const saldoTotal = rows.reduce((s, r) => s + (r.debit || 0) - (r.credit || 0), 0);
    const deuda      = saldoTotal > 0 ? saldoTotal : 0;
    const aFavor     = saldoTotal < 0 ? -saldoTotal : 0;
    const count      = rows.length;
    const lastDate   = rows.reduce<string>((acc, r) => (r.date > acc ? r.date : acc), "");

    return [
      { id: "saldo",      label: "Saldo total",           value: fmtMoney(saldoTotal),          hint: entity ? "Débitos − créditos del período" : "Elegí entidad para ver datos", tone: saldoTotal > 0 ? "warning" : saldoTotal < 0 ? "success" : "neutral", icon: <Wallet size={12} /> },
      { id: "deuda",      label: "Deuda total",           value: fmtMoney(deuda),               hint: "Saldo positivo",                                                            tone: deuda > 0 ? "danger" : "neutral",                                   icon: <TrendingUp size={12} /> },
      { id: "favor",      label: "Saldo a favor",         value: fmtMoney(aFavor),              hint: "Saldo negativo",                                                            tone: aFavor > 0 ? "success" : "neutral",                                 icon: <TrendingDown size={12} /> },
      { id: "period",     label: "Movimientos del período", value: count,                       hint: "Aplicando filtros",                                                         tone: count > 0 ? "primary" : "neutral",                                  icon: <Activity size={12} /> },
      { id: "last",       label: "Último movimiento",     value: lastDate ? fmtDate(lastDate) : "—", hint: "Fecha más reciente",                                                    tone: lastDate ? "info" : "neutral",                                      icon: <Clock size={12} /> },
    ];
  }, [rows, entity]);

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(r: LedgerRow): TPActionsMenuItem[] {
    return [
      {
        label: "Ver documento",
        icon: <FileText size={14} />,
        onClick: () => toast.info(`Ver ${r.documentRef} — próximamente`),
      },
      {
        label: "Ir a factura / pago",
        icon: <ExternalLink size={14} />,
        // TODO (Fase 6): según r.type, navegar a la pantalla correspondiente con el id real.
        onClick: () => toast.info(`Ir a ${r.documentRef} — próximamente`),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: LedgerRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      date:        <TPTd className="text-sm text-text/80 tabular-nums">{fmtDate(r.date)}</TPTd>,
      type:        <TPTd>{typeBadge(r.type)}</TPTd>,
      documentRef: <TPTd className="font-mono text-xs font-semibold text-text">{r.documentRef || <span className="text-muted">—</span>}</TPTd>,
      description: <TPTd className="text-sm text-text/80 truncate">{r.description || <span className="text-muted">—</span>}</TPTd>,
      debit: (
        <TPTd className="text-right tabular-nums">
          {r.debit > 0 ? <span className="text-amber-500 font-medium">{fmtMoney(r.debit)}</span> : <span className="text-muted">—</span>}
        </TPTd>
      ),
      credit: (
        <TPTd className="text-right tabular-nums">
          {r.credit > 0 ? <span className="text-emerald-500 font-medium">{fmtMoney(r.credit)}</span> : <span className="text-muted">—</span>}
        </TPTd>
      ),
      cumBalance: (
        <TPTd className={`text-right tabular-nums font-bold ${r.cumBalance > 0 ? "text-amber-500" : r.cumBalance < 0 ? "text-emerald-500" : "text-text"}`}>
          {fmtMoney(r.cumBalance, r.currency)}
        </TPTd>
      ),
      currency:    <TPTd className="text-xs font-mono text-muted">{r.currency}</TPTd>,
      actions: (
        <TPTd className="text-right px-2" data-tp-actions>
          <TPActionsMenu items={rowActions(r)} title="Acciones" />
        </TPTd>
      ),
    };

    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);

    return (
      <TPTr key={r.id}>
        {keys.map((k) => (
          <React.Fragment key={k}>{cells[k]}</React.Fragment>
        ))}
      </TPTr>
    );
  }

  // ── Filtros de header ────────────────────────────────────────────────────
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <TPSelect
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as TypeFilter)}
          options={typeOptions}
        />
      </div>
      <div className="w-36">
        <TPSelect
          value={currencyFilter}
          onChange={setCurrencyFilter}
          options={currencyOptions}
        />
      </div>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className="tp-input w-[140px]"
        title="Desde"
      />
      <input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className="tp-input w-[140px]"
        title="Hasta"
      />
      {(typeFilter !== "ALL" || currencyFilter !== "ALL" || dateFrom || dateTo) && (
        <button
          type="button"
          onClick={() => {
            setTypeFilter("ALL");
            setCurrencyFilter("ALL");
            setDateFrom("");
            setDateTo("");
          }}
          className="text-[11px] text-muted hover:text-text underline decoration-dotted"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );

  // ── Banner de desarrollo (constante) ─────────────────────────────────────
  const devBanner = (
    <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <Info size={16} className="shrink-0 mt-0.5 text-primary" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-text">Cuenta corriente en desarrollo</div>
        <div className="text-muted text-[13px] mt-0.5">
          Los datos que ves son de demostración. La integración completa con facturas, pagos,
          multi-moneda real y metales llega próximamente. El saldo acumulado se calcula por
          moneda; la conversión entre monedas y los saldos en metales se habilitarán junto
          con el módulo de cuenta corriente del backend.
        </div>
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Cuenta corriente"
      subtitle="Movimientos y saldos por entidad"
    >
      <div className="space-y-4">
        {devBanner}

        {/* ── Selector de entidad ── */}
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
            <TPField label="Entidad" hint="Cliente o proveedor">
              <TPSelect
                value={entity}
                onChange={setEntity}
                options={entityOptions}
              />
            </TPField>
            <TPField label="Nombre libre" hint="Opcional — buscar por texto (ignorado si ya hay una entidad seleccionada arriba)">
              <TPInput
                value={entity}
                onChange={(v: string) => setEntity(v)}
                placeholder="Nombre de entidad"
              />
            </TPField>
          </div>
        </div>

        <TPKpiBar items={kpis} columns={5} />

        {!entity ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface2/60 mb-4">
              <Wallet size={24} className="text-muted" />
            </div>
            <div className="text-base font-semibold text-text mb-1">
              Seleccioná una entidad
            </div>
            <div className="text-sm text-muted">
              Elegí un cliente o proveedor arriba para ver sus movimientos y saldos.
            </div>
          </div>
        ) : (
          <TPTableKit<LedgerRow>
            rows={rows}
            columns={COLS}
            storageKey="tp_account_ledger_cols"
            search={{
              value: q,
              onChange: setQ,
              placeholder: "Buscar por documento o descripción…",
              debounceMs: 150,
            }}
            sortPersistKey="tp_account_ledger"
            columnPicker
            headerLeft={filters}
            countLabel={(n) => `${n} ${n === 1 ? "movimiento" : "movimientos"}`}
            emptyText={
              q || typeFilter !== "ALL" || currencyFilter !== "ALL" || dateFrom || dateTo
                ? "Sin resultados con los filtros aplicados."
                : "La entidad no tiene movimientos registrados."
            }
            renderRow={renderRow}
          />
        )}
      </div>
    </TPSectionShell>
  );
}
