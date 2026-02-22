// src/components/valuation/modals/CurrencyRateHistoryModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

import { ModalShell, cn } from "../valuation.ui";
import * as valuation from "../../../services/valuation";

import { TPTableWrap, TPTableEl, TPThead, TPTbody, TPTr, TPTh, TPTd } from "../../ui/TPTable";
import { SortArrows } from "../../ui/TPSort";

type Props = {
  open: boolean;
  onClose: () => void;
  currencyId: string | null;
  baseCurrencySymbol?: string;
  baseCurrencyCode?: string;
};

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("es-AR");
}

function fmtRate(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("es-AR", { maximumFractionDigits: 6 });
}

function userLabel(u: any) {
  if (!u) return "—";
  const name = String(u?.name || "").trim();
  const email = String(u?.email || "").trim();
  return name || email || "—";
}

type SortKey = "edited" | "user" | "value" | "created";
type SortDir = "asc" | "desc";

export default function CurrencyRateHistoryModal({
  open,
  onClose,
  currencyId,
  baseCurrencySymbol,
  baseCurrencyCode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [data, setData] = useState<any>(null);

  // data válida para currencyId
  const dataForIdRef = useRef<string | null>(null);

  // ✅ anti “doble effect” / respuestas viejas
  const reqSeqRef = useRef(0);

  const [sortKey, setSortKey] = useState<SortKey>("edited");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const baseSym = String(baseCurrencySymbol || "").trim();
  const baseCode = String(baseCurrencyCode || "").trim();

  const displayData = currencyId && dataForIdRef.current === currencyId ? data : null;

  const currency = displayData?.currency ?? null;

  const title = useMemo(() => {
    if (!currency) return "Detalle";
    return `Detalle · ${currency.code}`;
  }, [currency]);

  const subtitle = useMemo(() => {
    if (!currency) return "Valor actual e historial.";
    return `${currency.code} · ${currency.name}`;
  }, [currency]);

  // loader del contenido (no del ModalShell)
  const showLoading = loading || (open && !!currencyId && !displayData && !err);

  useEffect(() => {
    if (!open) return;
    setErr(null);
  }, [open]);

  useEffect(() => {
    if (!open || !currencyId) return;

    const myReq = ++reqSeqRef.current;
    let alive = true;

    (async () => {
      try {
        // invalida lo visible para evitar flash de data anterior
        dataForIdRef.current = null;

        setErr(null);
        setLoading(true);

        const r = await valuation.getCurrencyRateHistory(currencyId, 80);

        // ✅ ignora si ya vino otra request (StrictMode / cambios rápidos)
        if (!alive || myReq !== reqSeqRef.current) return;

        setData(r);
        dataForIdRef.current = currencyId;
      } catch (e: any) {
        if (!alive || myReq !== reqSeqRef.current) return;
        setErr(e?.message || "Error cargando historial.");
      } finally {
        if (!alive || myReq !== reqSeqRef.current) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, currencyId]);

  const isBase = Boolean(currency?.isBase);

  const currentRaw = displayData?.current ?? null;
  const historyRaw = Array.isArray(displayData?.history) ? displayData.history : [];

  // ✅ HARD GUARD: si es base, por definición es 1 y sin historial
  const current = useMemo(() => {
    if (!isBase) return currentRaw;
    const ts = currency?.updatedAt || currency?.createdAt || new Date().toISOString();
    return {
      id: "base",
      rate: 1,
      effectiveAt: ts,
      createdAt: ts,
      user: null,
    };
  }, [isBase, currentRaw, currency]);

  const currentUserLabel = current?.user ? userLabel(current.user) : "—";

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(k);
    if (k === "edited" || k === "created") setSortDir("desc");
    else setSortDir("asc");
  }

  const history = useMemo(() => {
    // ✅ si es base, no mostramos historial aunque venga algo viejo
    if (isBase) return [];

    const rows = [...historyRaw];
    const dir = sortDir === "asc" ? 1 : -1;

    const asTime = (v: any) => {
      const d = new Date(v);
      const t = d.getTime();
      return Number.isFinite(t) ? t : -Infinity;
    };

    rows.sort((a: any, b: any) => {
      if (sortKey === "edited") return dir * (asTime(a?.effectiveAt) - asTime(b?.effectiveAt));
      if (sortKey === "created") return dir * (asTime(a?.createdAt) - asTime(b?.createdAt));

      if (sortKey === "value") {
        const av = Number(a?.rate);
        const bv = Number(b?.rate);
        return dir * ((Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity));
      }

      if (sortKey === "user") return dir * userLabel(a?.user).localeCompare(userLabel(b?.user));

      return 0;
    });

    return rows;
  }, [historyRaw, sortKey, sortDir, isBase]);

  const ThBtn = ({
    k,
    label,
    align,
  }: {
    k: SortKey;
    label: string;
    align?: "left" | "right";
  }) => {
    const active = sortKey === k;

    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-2 select-none hover:text-text transition",
          align === "right" ? "ml-auto" : ""
        )}
        title="Ordenar"
      >
        <span>{label}</span>
        <SortArrows dir={sortDir} active={active} />
      </button>
    );
  };

  const unitSymbol = String(currency?.symbol || "").trim();
  const currentLabel = unitSymbol
    ? `Valor actual de 1 ${unitSymbol}`
    : currency?.code
    ? `Valor actual de 1 ${currency.code}`
    : "Valor actual";

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={false}
      maxWidth="4xl"
      footer={
        <button
          type="button"
          className="tp-btn-secondary h-10 inline-flex items-center gap-2"
          onClick={onClose}
          disabled={showLoading}
        >
          <X size={16} />
          Cerrar
        </button>
      }
    >
      <div className="w-full">
        {err && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        )}

        {showLoading ? (
          <div className="p-6 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="text-xs text-muted text-center">{currentLabel}</div>

              <div className="mt-2 flex items-center justify-center">
                <div className="rounded-2xl border border-border bg-surface2 px-6 py-5 text-center">
                  <div className="text-4xl font-semibold text-text tabular-nums whitespace-nowrap">
                    {current?.rate != null ? (
                      <>
                        {baseSym ? <span className="mr-2">{baseSym}</span> : null}
                        {fmtRate(current.rate)}
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-muted text-center">
                {isBase ? (
                  <span className="text-text font-semibold">
                    Moneda base del sistema: por definición siempre vale 1.
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold">Última edición</div>
                  <div className="mt-1 text-text tabular-nums whitespace-nowrap">
                    {fmtDateTime(current?.effectiveAt || current?.createdAt)}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold">Usuario</div>
                  <div className="mt-1 text-text truncate" title={currentUserLabel}>
                    {currentUserLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold text-muted">Historial</div>

              {history.length === 0 ? (
                <div className="text-sm text-muted">
                  {isBase ? "Sin historial (moneda base)." : "Sin historial."}
                </div>
              ) : (
                <TPTableWrap>
                  <TPTableEl className="max-h-[420px] overflow-auto">
                    <table className="w-full table-auto text-sm">
                      <TPThead className="sticky top-0 z-20">
                        <tr>
                          <TPTh className="text-left">
                            <ThBtn k="edited" label="Editado" />
                          </TPTh>

                          <TPTh className="text-left">
                            <ThBtn k="user" label="Usuario" />
                          </TPTh>

                          <TPTh className="text-right">
                            <ThBtn k="value" label="Valor" align="right" />
                          </TPTh>

                          <TPTh className="text-left">
                            <ThBtn k="created" label="Creado" />
                          </TPTh>
                        </tr>
                      </TPThead>

                      <TPTbody>
                        {history.map((r: any) => {
                          const uLabel = userLabel(r?.user);
                          return (
                            <TPTr key={r.id}>
                              <TPTd className="tabular-nums whitespace-nowrap">{fmtDateTime(r.effectiveAt)}</TPTd>

                              <TPTd>
                                <div className="max-w-[420px] truncate" title={uLabel}>
                                  {uLabel}
                                </div>
                              </TPTd>

                              <TPTd className="text-right font-semibold tabular-nums whitespace-nowrap">
                                {baseSym ? <span className="mr-1">{baseSym}</span> : null}
                                {fmtRate(r.rate)}
                              </TPTd>

                              <TPTd className="tabular-nums whitespace-nowrap">{fmtDateTime(r.createdAt)}</TPTd>
                            </TPTr>
                          );
                        })}
                      </TPTbody>
                    </table>
                  </TPTableEl>
                </TPTableWrap>
              )}

              {currency && baseCode ? (
                <div className="mt-3 text-[11px] text-muted">
                  Los valores están expresados en {baseCode}.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
