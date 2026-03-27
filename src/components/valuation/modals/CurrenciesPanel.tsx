// src/components/valuation/modals/CurrenciesPanel.tsx
import React, { useMemo, useState } from "react";
import { TPColumnPicker } from "../../ui/TPColumnPicker";
import { Loader2, Plus, Search, X } from "lucide-react";
import { TPRowActions } from "../../ui/TPRowActions";

import type { CurrencyRow } from "../../../hooks/useValuation";
import { cn, norm, Pill } from "../valuation.ui";

import { SortArrows } from "../../ui/TPSort";
import { TPTableWrap, TPTable, TPThead, TPTbody, TPTr, TPTh, TPTd, TPEmptyRow } from "../../ui/TPTable";

import CurrencyRateHistoryModal from "./CurrencyRateHistoryModal";
import ConfirmDeleteDialog from "../../ui/ConfirmDeleteDialog";

import { fmtRateSmart } from "../../../lib/format";
import TPCard from "../../ui/TPCard";

type SortKey = "code" | "name" | "price" | "status";
type SortDir = "asc" | "desc";

/* ── Definición de columnas ─────────────────────────────────── */
type CurrColDef = {
  key: string;
  label: string;
  width?: string;
  visible: boolean;
  canHide?: boolean;
  align?: "left" | "right";
  sortKey?: SortKey;
};

const CURR_COLUMNS: CurrColDef[] = [
  { key: "currency", label: "Moneda",   visible: true, canHide: false, sortKey: "code" },
  { key: "price",    label: "Precio",   visible: true, align: "right", sortKey: "price" },
  { key: "status",   label: "Estado",   visible: true, sortKey: "status" },
  { key: "actions",  label: "Acciones", visible: true, canHide: false, align: "right", width: "220px" },
];

const LS_KEY_CURR = "tptech_col_currencies";


export default function CurrenciesPanel({
  loading,
  saving,
  currencies,
  baseCurrency,
  onRefetch,
  onOpenCreate,
  onSetBase,
  onToggleActive,
  onOpenRates,
  onDelete,
}: {
  loading: boolean;
  saving: boolean;
  currencies: CurrencyRow[];
  baseCurrency: CurrencyRow | null;

  onRefetch?: () => void;

  onOpenCreate: () => void;

  onSetBase: (currencyId: string) => Promise<{ ok: boolean; error?: string }>;
  onToggleActive: (currencyId: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>;

  onOpenRates: (currency: CurrencyRow) => void;
  onDelete?: (currency: CurrencyRow) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Visibilidad de columnas ──
  const [colVis, setColVis] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_CURR);
      if (saved) return JSON.parse(saved);
    } catch {}
    return Object.fromEntries(CURR_COLUMNS.map((c) => [c.key, c.visible]));
  });

  const visibleCurrCols = CURR_COLUMNS.filter((c) => colVis[c.key] !== false);
  const currColSpan = visibleCurrCols.length;

  function toggleCol(key: string, visible: boolean) {
    setColVis((prev) => {
      const next = { ...prev, [key]: visible };
      try { localStorage.setItem(LS_KEY_CURR, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const [viewOpen, setViewOpen] = useState(false);
  const [viewCurrencyId, setViewCurrencyId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<CurrencyRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [panelErr, setPanelErr] = useState<string | null>(null);

  function openView(currencyId: string) {
    setViewCurrencyId(currencyId);
    setViewOpen(true);
  }
  function closeView() {
    setViewOpen(false);
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === "status" ? "desc" : "asc");
  }

  function priceOf(r: CurrencyRow) {
    if (r.isBase) return 1;
    const v = (r as any).latestRate;
    const n = Number(v);
    return Number.isFinite(n) ? n : -1;
  }

  const list = useMemo(() => {
    const s = norm(q);
    const rows = [...(currencies || [])];

    const filtered = s
      ? rows.filter((c) => {
          const a = norm(c.code);
          const b = norm(c.name);
          const d = norm(c.symbol);
          return a.includes(s) || b.includes(s) || d.includes(s);
        })
      : rows;

    filtered.sort((a, b) => {
      const abase = a.isBase ? 0 : 1;
      const bbase = b.isBase ? 0 : 1;
      if (abase !== bbase) return abase - bbase;

      const dir = sortDir === "asc" ? 1 : -1;

      if (sortKey === "code") return dir * String(a.code || "").localeCompare(String(b.code || ""));
      if (sortKey === "price") return dir * (priceOf(a) - priceOf(b));
      if (sortKey === "status") {
        const aa = a.isActive !== false ? 1 : 0;
        const bb = b.isActive !== false ? 1 : 0;
        return dir * (aa - bb);
      }
      return 0;
    });

    return filtered;
  }, [currencies, q, sortKey, sortDir]);

  async function onSetBaseClick(row: CurrencyRow) {
    if (!row?.id) return;
    setPanelErr(null);

    const r = await onSetBase(row.id);
    if (!r?.ok) {
      setPanelErr(r?.error || "No se pudo cambiar la moneda base.");
      return;
    }
  }

  async function onToggle(row: CurrencyRow) {
    if (!row?.id) return;
    setPanelErr(null);

    const next = !(row.isActive !== false);
    const r = await onToggleActive(row.id, next);

    if (!r?.ok) {
      setPanelErr(r?.error || "No se pudo cambiar el estado.");
      return;
    }

    onRefetch?.();
  }

  function onAskDelete(row: CurrencyRow) {
    if (!onDelete) return;
    if (saving || loading) return;
    if (row?.isBase) return;

    setPanelErr(null);
    setDeleteRow(row);
    setDeleteOpen(true);
  }

  async function onConfirmDelete() {
    if (!onDelete) return;
    const row = deleteRow;
    const id = String(row?.id || "").trim();
    if (!row || !id) return;

    setPanelErr(null);
    setDeleteBusy(true);

    try {
      const r = await onDelete(row);
      if (!r?.ok) {
        setPanelErr(r?.error || "No se pudo eliminar la moneda.");
        return;
      }

      setDeleteOpen(false);
      setDeleteRow(null);
      onRefetch?.();
    } catch (e: any) {
      setPanelErr(e?.message || "No se pudo eliminar la moneda.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function onCloseDelete() {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeleteRow(null);
  }

  const baseSym = String(baseCurrency?.symbol || "").trim() || "$";
  const baseCode = String(baseCurrency?.code || "").trim() || "ARS";

  function fmtPrice(row: CurrencyRow) {
    const v = priceOf(row);
    if (!Number.isFinite(v) || v < 0) return row.isBase ? fmtRateSmart(1) : "Sin tipo";
    const txt = fmtRateSmart(v);
    return baseSym ? `${baseSym} ${txt}` : txt;
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1.5 select-none hover:text-text transition")}
        title="Ordenar"
      >
        <span>{label}</span>
        <SortArrows dir={sortDir} active={active} />
      </button>
    );
  };

  const deletingName = deleteRow ? `${deleteRow.code} · ${deleteRow.name}` : "esta moneda";

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow)" }}>
        <div className="min-w-0 mb-3">
          <div className="text-lg font-bold text-text">Monedas</div>
          <div className="text-sm text-muted">Definí la moneda base y cargá tipos de cambio para las demás.</div>
        </div>

        {panelErr ? (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">{panelErr}</div>
        ) : null}

        <div className="flex gap-2 items-center">
          <TPColumnPicker
            columns={CURR_COLUMNS.map((c) => ({ key: c.key, label: c.label, canHide: c.canHide }))}
            visibility={colVis}
            onChange={toggleCol}
          />
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (código / nombre / símbolo)…"
              className="w-full h-10 rounded-xl border border-border bg-bg text-text pl-9 pr-9 text-sm focus:outline-none focus:ring-4 focus:ring-primary/20"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-lg text-muted hover:text-text hover:bg-surface2 transition"
                title="Limpiar"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="tp-btn-primary h-10 inline-flex items-center justify-center gap-2 shrink-0"
            onClick={onOpenCreate}
            disabled={saving}
            title="Nueva moneda"
          >
            <Plus size={16} />
            Nueva
          </button>
        </div>

        {baseCurrency ? (
          <div className="mt-3 text-xs text-muted">
            Moneda base actual:{" "}
            <span className="text-text font-semibold">
              {baseCurrency.code} ({baseCurrency.symbol})
            </span>
          </div>
        ) : null}

        {/* =========================
            ✅ DESKTOP TABLE (md+)
        ========================= */}
        <div className="mt-4 hidden md:block">
          <TPTableWrap>
            <TPTable>
              <table className="w-full">
                <TPThead>
                  <tr>
                    {visibleCurrCols.map((col) => (
                      <TPTh
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        className={col.align === "right" ? "text-right" : undefined}
                      >
                        {col.sortKey ? (
                          <span className={cn("inline-flex items-center gap-1.5", col.align === "right" ? "justify-end w-full" : "")}>
                            <SortBtn k={col.sortKey} label={col.label} />
                          </span>
                        ) : (
                          col.label
                        )}
                      </TPTh>
                    ))}
                  </tr>
                </TPThead>

                <TPTbody>
                  {loading ? (
                    <tr>
                      <td colSpan={currColSpan} className="px-5 py-10 text-center text-sm text-muted">
                        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                        Cargando…
                      </td>
                    </tr>
                  ) : list.length === 0 ? (
                    <TPEmptyRow colSpan={currColSpan} text="Sin monedas." />
                  ) : (
                    list.map((row) => {
                      const isBase = !!row.isBase;
                      const isActive = row.isActive !== false;
                      const lockActions = saving || deleteBusy;

                      return (
                        <TPTr key={row.id} className={!isActive ? "opacity-60" : undefined} onClick={() => openView(row.id)}>
                          {visibleCurrCols.map((col) => {
                            switch (col.key) {
                              case "currency":
                                return (
                                  <TPTd key="currency" className="text-left">
                                    <div className="font-semibold text-text">
                                      {row.code} <span className="text-muted">· {row.name}</span>
                                    </div>
                                    <div className="text-xs text-muted">
                                      {row.symbol} {isBase ? <span className="text-yellow-400 font-semibold">⭐ Base</span> : null}
                                    </div>
                                  </TPTd>
                                );

                              case "price":
                                return (
                                  <TPTd key="price" className="text-right tabular-nums">
                                    <div className="w-full text-right text-sm text-text font-medium">{fmtPrice(row)}</div>
                                  </TPTd>
                                );

                              case "status":
                                return (
                                  <TPTd key="status" className="text-left">
                                    {isActive ? <Pill tone="ok">Activa</Pill> : <Pill tone="off">Inactiva</Pill>}
                                  </TPTd>
                                );

                              case "actions":
                                return (
                                  <TPTd key="actions" className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <TPRowActions
                                      onFavorite={() => { if (!lockActions && !isBase) void onSetBaseClick(row); }}
                                      isFavorite={isBase}
                                      busyFavorite={lockActions || isBase}
                                      onView={() => openView(row.id)}
                                      onEdit={() => onOpenRates(row)}
                                      onToggle={() => { if (!lockActions && !isBase) void onToggle(row); }}
                                      busyToggle={lockActions || isBase}
                                      isActive={isActive}
                                      onDelete={() => { if (!lockActions && !isBase && onDelete) onAskDelete(row); }}
                                      busyDelete={lockActions || isBase || !onDelete}
                                    />
                                  </TPTd>
                                );

                              default:
                                return null;
                            }
                          })}
                        </TPTr>
                      );
                    })
                  )}
                </TPTbody>
              </table>
            </TPTable>

            <div className="flex items-center justify-between border-t border-border bg-surface2/30 px-5 py-3 text-xs text-muted">
              <div>
                {list.length} moneda{list.length === 1 ? "" : "s"}
              </div>
              <div>Tip: la base no puede desactivarse ni eliminarse, y su precio es 1.</div>
            </div>
          </TPTableWrap>
        </div>

        {/* =========================
            ✅ MOBILE CARDS (sm)
        ========================= */}
        <div className="mt-4 md:hidden space-y-3">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Cargando…
            </div>
          ) : list.length === 0 ? (
            <div className="text-sm text-muted">Sin monedas.</div>
          ) : (
            list.map((row) => {
              const isBase = !!row.isBase;
              const isActive = row.isActive !== false;
              const lockActions = saving || deleteBusy;

              return (
                <TPCard
                  key={row.id}
                  className={cn("rounded-2xl border border-border bg-card p-4", isBase ? "shadow-[0_0_0_1px_rgba(250,204,21,0.22)]" : "", !isActive && "opacity-60")}
                  title={
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-text truncate">
                          {row.code} <span className="text-muted">· {row.name}</span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {row.symbol} {isBase ? <span className="text-yellow-400 font-semibold">⭐ Base</span> : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isActive ? <Pill tone="ok">Activa</Pill> : <Pill tone="off">Inactiva</Pill>}
                      </div>
                    </div>
                  }
                >
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-surface2 p-3">
                      <div className="text-[11px] text-muted font-semibold">Precio</div>
                      <div className="mt-1 text-sm font-semibold text-text tabular-nums">{fmtPrice(row)}</div>
                    </div>

                    <div className="rounded-xl border border-border bg-surface2 p-3">
                      <div className="text-[11px] text-muted font-semibold">Moneda base</div>
                      <div className="mt-1 text-sm text-text">{isBase ? "Sí" : "No"}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <TPRowActions
                      onFavorite={() => { if (!lockActions && !isBase) void onSetBaseClick(row); }}
                      isFavorite={isBase}
                      busyFavorite={lockActions || isBase}
                      onView={() => openView(row.id)}
                      onEdit={() => onOpenRates(row)}
                      onToggle={() => { if (!lockActions && !isBase) void onToggle(row); }}
                      busyToggle={lockActions || isBase}
                      isActive={isActive}
                      onDelete={() => { if (!lockActions && !isBase && onDelete) onAskDelete(row); }}
                      busyDelete={lockActions || isBase || !onDelete}
                    />
                  </div>
                </TPCard>
              );
            })
          )}
        </div>
      </div>

      <CurrencyRateHistoryModal open={viewOpen} onClose={closeView} currencyId={viewCurrencyId} baseCurrencySymbol={baseSym} baseCurrencyCode={baseCode} />

      <ConfirmDeleteDialog
        open={deleteOpen}
        loading={deleteBusy}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Eliminar moneda"
        description={`Vas a eliminar ${deletingName}. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        requireTypeToConfirm={true}
        typeToConfirmText="ELIMINAR"
        dangerHint="Si la moneda está usada en cotizaciones de metales, no se podrá eliminar."
      />
    </section>
  );
}