// src/components/valuation/modals/VariantValueModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X, CalendarClock, Percent, Sigma, Coins } from "lucide-react";

import { ModalShell } from "../valuation.ui";
import TPDateRangeInline, { type TPDateRangeValue } from "../../ui/TPDateRangeInline";

import { apiFetch } from "../../../lib/api";
import {
  TPTableWrap,
  TPTable,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../../ui/TPTable";

import { fmtMoneySmart, fmtNumber2, fmtPurity3 } from "../../../lib/format";

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("es-AR");
}

function toNum(v: any, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function asTime(v: any) {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
}

type HistoryRow = {
  id: string;
  effectiveAt?: string;
  createdAt?: string;

  finalSalePrice?: number | null;
  salePrice?: number | null;
  baseSalePrice?: number | null;

  currency?: {
    id: string;
    code: string;
    symbol: string;
    isBase?: boolean;
    isActive?: boolean;
  } | null;
};

function pickRows(resp: any) {
  return resp?.history ?? resp?.rows ?? resp?.data?.history ?? resp?.data?.rows ?? resp?.data ?? [];
}

function pickCurrent(resp: any) {
  return resp?.current ?? resp?.data?.current ?? null;
}

function InfoCard({
  icon,
  label,
  value,
  valueClassName = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface2 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        {icon}
        <span>{label}</span>
      </div>

      <div className={`mt-1 text-text ${valueClassName}`}>{value}</div>
    </div>
  );
}

export default function VariantValueModal({
  open,
  onClose,
  variant,
  baseCurrencySymbol,
}: {
  open: boolean;
  onClose: () => void;
  variant: any | null;
  baseCurrencySymbol?: string;
}) {
  const [range, setRange] = useState<TPDateRangeValue>({ from: null, to: null });

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [historyRowsAll, setHistoryRowsAll] = useState<HistoryRow[]>([]);
  const [historyCurrent, setHistoryCurrent] = useState<HistoryRow | null>(null);

  useEffect(() => {
    if (!open) return;

    const today = startOfDay(new Date());
    const from = startOfDay(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));

    setRange({ from, to: today });
  }, [open]);

  const name = String(variant?.name || "Variante").trim();
  const sku = String(variant?.sku || "").trim();

  const title = useMemo(() => {
    return sku ? `Detalle · ${name} (${sku})` : `Detalle · ${name}`;
  }, [name, sku]);

  const subtitle = useMemo(() => {
    return sku ? `${name} · SKU ${sku}` : "Valor actual e historial.";
  }, [name, sku]);

  const fallbackBaseSym = String(baseCurrencySymbol || "").trim();

  const ref = toNum(variant?.referenceValue, NaN);
  const purity = toNum(variant?.purity, NaN);
  const saleFactor = toNum(variant?.saleFactor, 1);

  const fallbackFinalSale = useMemo(() => {
    const n = toNum(variant?.finalSalePrice, NaN);

    if (Number.isFinite(n) && n > 0) return n;

    if (!Number.isFinite(ref) || !Number.isFinite(purity)) return NaN;
    if (purity <= 0 || purity > 1) return NaN;

    return ref * purity * saleFactor;
  }, [variant, ref, purity, saleFactor]);

  const updatedAt = variant?.updatedAt || variant?.createdAt || null;

  useEffect(() => {
    if (!open) return;
    if (!variant?.id) return;

    let alive = true;

    setLoadingHistory(true);
    setHistoryErr(null);

    const qs = new URLSearchParams();
    qs.set("take", "200");

    apiFetch(`/valuation/variants/${variant.id}/value-history?${qs.toString()}`)
      .then((r: any) => {
        if (!alive) return;

        const rows: HistoryRow[] = Array.isArray(pickRows(r)) ? (pickRows(r) as any) : [];
        const current: HistoryRow | null = pickCurrent(r);

        setHistoryRowsAll(rows);
        setHistoryCurrent(current);
      })
      .catch((e: any) => {
        if (!alive) return;

        setHistoryErr(String(e?.message || "No se pudo cargar el historial."));
        setHistoryRowsAll([]);
        setHistoryCurrent(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoadingHistory(false);
      });

    return () => {
      alive = false;
    };
  }, [open, variant?.id]);

  const historyRows = useMemo(() => {
    const from = range.from ? startOfDay(range.from).getTime() : null;
    const to = range.to ? endOfDay(range.to).getTime() : null;

    const list = [...(historyRowsAll || [])];

    list.sort((a: any, b: any) => {
      const ta = asTime(a?.effectiveAt || a?.createdAt || 0);
      const tb = asTime(b?.effectiveAt || b?.createdAt || 0);

      return (Number.isFinite(tb) ? tb : -Infinity) - (Number.isFinite(ta) ? ta : -Infinity);
    });

    if (from == null && to == null) return list;

    return list.filter((r: any) => {
      const t = asTime(r?.effectiveAt || r?.createdAt);

      if (!Number.isFinite(t)) return false;
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;

      return true;
    });
  }, [historyRowsAll, range.from, range.to]);

  const currentRow = useMemo(() => {
    if (historyCurrent) return historyCurrent;
    return historyRows[0] ?? null;
  }, [historyCurrent, historyRows]);

  const currentValue = useMemo(() => {
    const v =
      currentRow?.finalSalePrice ??
      currentRow?.salePrice ??
      currentRow?.baseSalePrice;

    const n = toNum(v, NaN);
    return Number.isFinite(n) ? n : fallbackFinalSale;
  }, [currentRow, fallbackFinalSale]);

  const currentSym = String(
    currentRow?.currency?.symbol || fallbackBaseSym || ""
  ).trim();

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={false}
      maxWidth="6xl"
      footer={
        <button
          type="button"
          className="tp-btn-secondary h-10 inline-flex items-center gap-2"
          onClick={onClose}
        >
          <X size={16} />
          Cerrar
        </button>
      }
    >
      <div className="w-full min-w-0">
        {!variant ? (
          <div className="p-6 text-center text-sm text-muted">
            Variante inválida.
          </div>
        ) : (
          <>
            {/* RESUMEN SUPERIOR */}
            <div className="rounded-2xl border border-border bg-card p-5 overflow-hidden">
              <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-5 items-stretch">
                {/* CARD PRINCIPAL */}
                <div className="rounded-2xl border border-border bg-surface2 px-6 py-6 flex min-h-[180px] flex-col justify-center">
                  <div className="text-xs text-muted text-center font-medium">
                    Precio final (venta)
                  </div>

                  <div className="mt-3 text-center">
                    <div className="text-4xl md:text-5xl font-semibold text-text tabular-nums leading-none break-words">
                      {Number.isFinite(currentValue)
                        ? fmtMoneySmart(currentSym, currentValue)
                        : "—"}
                    </div>
                  </div>

                  <div className="mt-4 text-center text-xs text-muted">
                    {sku ? `SKU ${sku}` : "Valor actual calculado / registrado"}
                  </div>
                </div>

                {/* CARDS SECUNDARIAS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoCard
                    icon={<CalendarClock className="h-3.5 w-3.5" />}
                    label="Última edición"
                    value={fmtDateTime(
                      (currentRow?.effectiveAt || currentRow?.createdAt || updatedAt || undefined) as any
                    )}
                    valueClassName="tabular-nums whitespace-nowrap"
                  />

                  <InfoCard
                    icon={<Percent className="h-3.5 w-3.5" />}
                    label="Pureza"
                    value={Number.isFinite(purity) ? fmtPurity3(purity) : "—"}
                    valueClassName="font-medium"
                  />

                  <InfoCard
                    icon={<Sigma className="h-3.5 w-3.5" />}
                    label="Factor de venta"
                    value={Number.isFinite(saleFactor) ? fmtNumber2(saleFactor) : "—"}
                    valueClassName="font-medium tabular-nums"
                  />

                  <InfoCard
                    icon={<Coins className="h-3.5 w-3.5" />}
                    label="Valor de referencia"
                    value={
                      Number.isFinite(ref)
                        ? fmtMoneySmart(currentSym || fallbackBaseSym, ref)
                        : "—"
                    }
                    valueClassName="font-medium tabular-nums whitespace-nowrap"
                  />
                </div>
              </div>
            </div>

            {/* HISTORIAL */}
            <div className="mt-6 min-w-0">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-text">Historial</div>
                  <div className="text-xs text-muted">
                    Evolución del precio final de la variante en el rango elegido.
                  </div>
                </div>

                <div className="w-full md:w-auto md:min-w-[320px]">
                  <TPDateRangeInline value={range} onChange={setRange} />
                </div>
              </div>

              <div className="max-w-full rounded-2xl border border-border bg-card overflow-hidden">
                <div
                  className="max-h-[50vh] overflow-y-auto overscroll-contain touch-pan-y"
                  style={{ WebkitOverflowScrolling: "touch" as any }}
                >
                  <TPTableWrap>
                    <TPTable>
                      <TPTableXScroll>
                        <TPTableElBase responsive="stack">
                          <TPThead className="sticky top-0 z-20">
                            <TPTr>
                              <TPTh className="min-w-[220px]">Fecha</TPTh>
                              <TPTh className="min-w-[180px] text-right">Valor</TPTh>
                              <TPTh className="min-w-[220px]">Creado</TPTh>
                            </TPTr>
                          </TPThead>

                          <TPTbody>
                            {loadingHistory ? (
                              <TPTr>
                                <TPTd colSpan={3}>
                                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
                                    <Loader2 className="animate-spin" size={16} />
                                    Cargando historial...
                                  </div>
                                </TPTd>
                              </TPTr>
                            ) : historyErr ? (
                              <TPTr>
                                <TPTd colSpan={3}>
                                  <div className="py-6 text-center text-sm text-red-400">
                                    {historyErr}
                                  </div>
                                </TPTd>
                              </TPTr>
                            ) : historyRows.length === 0 ? (
                              <TPEmptyRow colSpan={3} text="No hay historial en el rango elegido." />
                            ) : (
                              historyRows.map((r) => {
                                const when = r.effectiveAt || r.createdAt;
                                const value =
                                  r.finalSalePrice ??
                                  r.salePrice ??
                                  r.baseSalePrice;

                                const valueNum = toNum(value, NaN);
                                const rowSym = String(
                                  r?.currency?.symbol || currentSym || fallbackBaseSym || ""
                                ).trim();

                                return (
                                  <TPTr key={r.id}>
                                    <TPTd label="Fecha">
                                      {fmtDateTime(when)}
                                    </TPTd>

                                    <TPTd
                                      label="Valor"
                                      className="text-right font-semibold tabular-nums whitespace-nowrap"
                                    >
                                      {Number.isFinite(valueNum)
                                        ? fmtMoneySmart(rowSym, valueNum)
                                        : "—"}
                                    </TPTd>

                                    <TPTd label="Creado">
                                      {fmtDateTime(r.createdAt)}
                                    </TPTd>
                                  </TPTr>
                                );
                              })
                            )}
                          </TPTbody>
                        </TPTableElBase>
                      </TPTableXScroll>
                    </TPTable>
                  </TPTableWrap>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}