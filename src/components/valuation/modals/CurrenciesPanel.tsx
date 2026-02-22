// src/components/valuation/modals/CurrenciesPanel.tsx
import React, { useMemo, useState } from "react";
import {
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldBan,
  ShieldCheck,
  Star,
  Trash2,
  X, // ✅ clear icon
} from "lucide-react";

import type { CurrencyRow } from "../../../hooks/useValuation";
import { cn, norm, Pill } from "../valuation.ui";

import { SortArrows } from "../../ui/TPSort";
import {
  TPTableWrap,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../../ui/TPTable";

import CurrencyRateHistoryModal from "./CurrencyRateHistoryModal";
import ConfirmDeleteDialog from "../../ui/ConfirmDeleteDialog";

type SortKey = "code" | "name" | "price" | "status";
type SortDir = "asc" | "desc";

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
  onToggleActive: (
    currencyId: string,
    isActive: boolean
  ) => Promise<{ ok: boolean; error?: string }>;

  onOpenRates: (currency: CurrencyRow) => void;
  onDelete?: (currency: CurrencyRow) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // modal view
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCurrencyId, setViewCurrencyId] = useState<string | null>(null);

  // ✅ delete confirm
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
    const v = (r as any).latestRate; // ✅ viene del backend (en MONEDA BASE)
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

      if (sortKey === "code") {
        return dir * String(a.code || "").localeCompare(String(b.code || ""));
      }
      if (sortKey === "price") {
        return dir * (priceOf(a) - priceOf(b));
      }
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

    // ✅ NO llamamos onRefetch acá: el hook ya refresca currencies+metals
    // onRefetch?.();
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

    // ✅ opcional: si el padre no refetchea, permitimos actualizar desde afuera
    onRefetch?.();
  }

  // ✅ abrimos confirm
  function onAskDelete(row: CurrencyRow) {
    if (!onDelete) return;
    if (saving || loading) return;

    // UI ya deshabilita base, pero doble protección
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

  // ✅ símbolo/código base (para modal + columna Precio)
  const baseSym = String(baseCurrency?.symbol || "").trim() || "$";
  const baseCode = String(baseCurrency?.code || "").trim() || "ARS";

  // ✅ NUEVO: formateo visual según regla:
  // - < 1  => hasta 6 decimales (como hoy)
  // - >= 1 => 2 decimales fijos (1 => 1,00)
  function fmtRateSmart(v: number) {
    if (v >= 1) {
      return v.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return v.toLocaleString("es-AR", { maximumFractionDigits: 6 });
  }

  function fmtPrice(row: CurrencyRow) {
    const v = priceOf(row);
    if (!Number.isFinite(v) || v < 0) return row.isBase ? "1" : "Sin tipo";

    const txt = fmtRateSmart(v);
    return baseSym ? `${baseSym} ${txt}` : txt;
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1.5 select-none hover:text-text transition"
        )}
        title="Ordenar"
      >
        <span>{label}</span>
        <SortArrows dir={sortDir} active={active} />
      </button>
    );
  };

  const deletingName = deleteRow
    ? `${deleteRow.code} · ${deleteRow.name}`
    : "esta moneda";

  return (
    <section className="space-y-3">
      <div
        className="rounded-2xl border border-border bg-card p-4"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <div className="flex justify-between items-center">
          <div className="min-w-0">
            <div className="text-lg font-bold text-text">Monedas</div>
            <div className="text-sm text-muted">
              Definí la moneda base y cargá tipos de cambio para las demás.
            </div>
          </div>

          <button
            className="tp-btn-primary h-10 inline-flex items-center gap-2"
            onClick={onOpenCreate}
            disabled={saving}
            title="Nueva moneda"
          >
            <Plus size={16} />
            Nueva
          </button>
        </div>

        {panelErr ? (
          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {panelErr}
          </div>
        ) : null}

        <div className="mt-4 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (código / nombre / símbolo)…"
            className="w-full h-10 rounded-xl border border-border bg-bg text-text pl-9 pr-9 text-sm focus:outline-none focus:ring-4 focus:ring-primary/20"
          />

          {/* ✅ NUEVO: misma X que en metales */}
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

        {baseCurrency ? (
          <div className="mt-3 text-xs text-muted">
            Moneda base actual:{" "}
            <span className="text-text font-semibold">
              {baseCurrency.code} ({baseCurrency.symbol})
            </span>
          </div>
        ) : null}

        <div className="mt-4">
          <TPTableWrap>
            <TPTableEl>
              <table className="w-full">
                <TPThead>
                  <tr>
                    <TPTh className="text-left">
                      <SortBtn k="code" label="Moneda" />
                    </TPTh>

                    <TPTh className="text-right tabular-nums">
                      <span className="inline-flex justify-end w-full">
                        <SortBtn k="price" label="Precio" />
                      </span>
                    </TPTh>

                    <TPTh className="text-left">
                      <SortBtn k="status" label="Estado" />
                    </TPTh>

                    <TPTh className="text-right">Acciones</TPTh>
                  </tr>
                </TPThead>

                <TPTbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-sm text-muted"
                      >
                        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                        Cargando…
                      </td>
                    </tr>
                  ) : list.length === 0 ? (
                    <TPEmptyRow colSpan={4} text="Sin monedas." />
                  ) : (
                    list.map((row) => {
                      const isBase = !!row.isBase;
                      const isActive = row.isActive !== false;

                      const lockActions = saving || deleteBusy; // ✅ evitamos clicks mientras borra

                      return (
                        <TPTr key={row.id}>
                          <TPTd className="text-left">
                            <div className="font-semibold text-text">
                              {row.code}{" "}
                              <span className="text-muted">· {row.name}</span>
                            </div>
                            <div className="text-xs text-muted">
                              {row.symbol}{" "}
                              {isBase ? (
                                <span className="text-yellow-400 font-semibold">
                                  ⭐ Base
                                </span>
                              ) : null}
                            </div>
                          </TPTd>

                          <TPTd className="text-right tabular-nums">
                            <div className="w-full text-right text-sm text-text font-medium">
                              {fmtPrice(row)}
                            </div>
                          </TPTd>

                          <TPTd className="text-left">
                            {isActive ? (
                              <Pill tone="ok">Activa</Pill>
                            ) : (
                              <Pill tone="off">Inactiva</Pill>
                            )}
                          </TPTd>

                          <TPTd className="text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                                title={
                                  isBase ? "Moneda base" : "Marcar como base"
                                }
                                onClick={() => onSetBaseClick(row)}
                                disabled={lockActions || isBase}
                              >
                                <Star
                                  size={16}
                                  className={cn(
                                    isBase
                                      ? "fill-current text-yellow-400"
                                      : "fill-transparent text-text/80"
                                  )}
                                />
                              </button>

                              <button
                                className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                                title="Ver detalle / historial"
                                onClick={() => openView(row.id)}
                                disabled={lockActions}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                                title="Tipos de cambio"
                                onClick={() => onOpenRates(row)}
                                disabled={lockActions || isBase}
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                                title={isActive ? "Desactivar" : "Activar"}
                                onClick={() => onToggle(row)}
                                disabled={lockActions || isBase}
                              >
                                {isActive ? (
                                  <ShieldBan size={16} />
                                ) : (
                                  <ShieldCheck size={16} />
                                )}
                              </button>

                              <button
                                className="tp-btn-secondary h-9 w-9 !p-0 grid place-items-center"
                                title={!onDelete ? "Eliminar (pendiente)" : "Eliminar"}
                                onClick={() => onAskDelete(row)}
                                disabled={lockActions || isBase || !onDelete}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </TPTd>
                        </TPTr>
                      );
                    })
                  )}
                </TPTbody>
              </table>
            </TPTableEl>

            <div className="flex items-center justify-between border-t border-border bg-surface2/30 px-5 py-3 text-xs text-muted">
              <div>
                {list.length} moneda{list.length === 1 ? "" : "s"}
              </div>
              <div>Tip: la base no puede desactivarse ni eliminarse, y su precio es 1.</div>
            </div>
          </TPTableWrap>
        </div>
      </div>

      {/* ✅ Modal View: le pasamos el símbolo/código base REAL */}
      <CurrencyRateHistoryModal
        open={viewOpen}
        onClose={closeView}
        currencyId={viewCurrencyId}
        baseCurrencySymbol={baseSym}
        baseCurrencyCode={baseCode}
      />

      {/* ✅ Confirmación de borrado */}
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