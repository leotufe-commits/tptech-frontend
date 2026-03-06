// src/components/valuation/modals/VariantValueModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { ModalShell, cn } from "../valuation.ui";
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

function roundTo(n: number, decimals: number) {
  const p = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * p) / p;
}

function leyOf(purity: any) {
  const p = toNum(purity, NaN);
  if (!Number.isFinite(p) || p <= 0) return "—";
  return String(Math.round(roundTo(p, 3) * 1000));
}

function normalizeOverride(v: any) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

type QuoteRow = {
  id: string;
  variantId: string;
  currencyId: string;

  purchasePrice: number;
  salePrice: number;

  basePurchasePrice?: number | null;
  baseSalePrice?: number | null;

  effectiveAt?: string;
  createdAt?: string;

  currency?: { id: string; code: string; symbol: string };
};

function pickRows(resp: any) {
  return resp?.rows ?? resp?.data?.rows ?? resp?.data ?? resp ?? [];
}

function asTime(v: any) {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export default function VariantValueModal({
  open,
  onClose,
  variant,
  baseCurrencySymbol,
  baseCurrencyCode,
}: {
  open: boolean;
  onClose: () => void;
  variant: any | null;
  baseCurrencySymbol?: string;
  baseCurrencyCode?: string;
}) {
  const [range, setRange] = useState<TPDateRangeValue>({ from: null, to: null });

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [quoteRowsAll, setQuoteRowsAll] = useState<QuoteRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const today = startOfDay(new Date());
    const from = startOfDay(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
    setRange({ from, to: today });
  }, [open]);

  const name = String(variant?.name || "Variante").trim();
  const sku = String(variant?.sku || "").trim();

  const title = useMemo(() => (sku ? `Detalle · ${name} (${sku})` : `Detalle · ${name}`), [name, sku]);

  const subtitle = useMemo(
    () => (sku ? `${name || "Variante"} · SKU ${sku}` : "Valor actual y configuración."),
    [name, sku]
  );

  const baseSym = String(baseCurrencySymbol || "").trim();
  const baseCode = String(baseCurrencyCode || "").trim();

  const ref = toNum(variant?.referenceValue, NaN);
  const purity = toNum(variant?.purity, NaN);

  const suggested = useMemo(() => {
    const s = toNum(variant?.suggestedPrice, NaN);
    if (Number.isFinite(s)) return s;
    if (!Number.isFinite(ref) || !Number.isFinite(purity)) return NaN;
    if (purity <= 0 || purity > 1) return NaN;
    return ref * purity;
  }, [variant, ref, purity]);

  const buyFactor = toNum(variant?.buyFactor, 1);
  const saleFactor = toNum(variant?.saleFactor, 1);

  const purchaseOverride = normalizeOverride(variant?.purchasePriceOverride);
  const saleOverride = normalizeOverride(variant?.salePriceOverride);

  const finalSale = useMemo(() => {
    const n = toNum(variant?.finalSalePrice, NaN);
    if (Number.isFinite(n) && n > 0) return n;

    if (saleOverride !== null) return saleOverride;

    if (!Number.isFinite(suggested) || !Number.isFinite(saleFactor)) return NaN;
    return suggested * saleFactor;
  }, [variant, suggested, saleFactor, saleOverride]);

  const updatedAt = variant?.updatedAt || variant?.createdAt || null;

  useEffect(() => {
    if (!open) return;
    if (!variant?.id) return;

    let alive = true;
    setLoadingHistory(true);
    setHistoryErr(null);

    const qs = new URLSearchParams();
    qs.set("take", "200");

    apiFetch(`/valuation/variants/${variant.id}/quotes?` + qs.toString())
      .then((r: any) => {
        if (!alive) return;
        const rows: QuoteRow[] = Array.isArray(pickRows(r)) ? (pickRows(r) as any) : [];
        setQuoteRowsAll(rows);
      })
      .catch((e: any) => {
        if (!alive) return;
        setHistoryErr(String(e?.message || "No se pudo cargar el historial."));
        setQuoteRowsAll([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoadingHistory(false);
      });

    return () => {
      alive = false;
    };
  }, [open, variant?.id]);

  const quoteRows = useMemo(() => {
    const from = range.from ? startOfDay(range.from).getTime() : null;
    const to = range.to ? endOfDay(range.to).getTime() : null;

    const list = [...(quoteRowsAll || [])];

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
  }, [quoteRowsAll, range.from, range.to]);

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={false}
      maxWidth="4xl"
      footer={
        <button type="button" className="tp-btn-secondary h-10 inline-flex items-center gap-2" onClick={onClose}>
          <X size={16} />
          Cerrar
        </button>
      }
    >
      <div className="w-full">
        {!variant ? (
          <div className="p-6 text-center text-sm text-muted">Variante inválida.</div>
        ) : (
          <>
            {/* TARJETA SUPERIOR */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="text-xs text-muted text-center">Precio final (venta)</div>

              <div className="mt-2 flex items-center justify-center">
                <div className="rounded-2xl border border-border bg-surface2 px-6 py-5 text-center">
                  <div className="text-4xl font-semibold text-text tabular-nums whitespace-nowrap">
                    {Number.isFinite(finalSale) ? fmtMoneySmart(baseSym, finalSale) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold">Última edición</div>
                  <div className="mt-1 text-text tabular-nums whitespace-nowrap">
                    {fmtDateTime(updatedAt || undefined)}
                  </div>
                </div>
              </div>
            </div>

            {/* HISTORIAL */}
            <div className="mt-6">
              <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                {loadingHistory ? (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="animate-spin" size={16} />
                    Cargando historial...
                  </div>
                ) : historyErr ? (
                  <div className="text-sm text-red-400">{historyErr}</div>
                ) : quoteRows.length === 0 ? (
                  <div className="text-sm text-muted">No hay cotizaciones en el rango elegido.</div>
                ) : (
                  <TPTableWrap>
                    <TPTable>
                      <TPTableXScroll>
                        <TPTableElBase responsive="stack">
                          <TPThead>
                            <TPTr>
                              <TPTh>Fecha</TPTh>
                              <TPTh className="text-right">Valor</TPTh>
                              <TPTh>Creado</TPTh>
                            </TPTr>
                          </TPThead>

                          <TPTbody>
                            {quoteRows.map((r) => {
                              const when = r.effectiveAt || r.createdAt;
                              const value = r.salePrice ?? r.purchasePrice;

                              return (
                                <TPTr key={r.id}>
                                  <TPTd label="Fecha">{fmtDateTime(when)}</TPTd>

                                  <TPTd label="Valor" className="text-right">
                                    {fmtMoneySmart(baseSym, value)}
                                  </TPTd>

                                  <TPTd label="Creado">{fmtDateTime(r.createdAt)}</TPTd>
                                </TPTr>
                              );
                            })}
                          </TPTbody>
                        </TPTableElBase>
                      </TPTableXScroll>
                    </TPTable>
                  </TPTableWrap>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}