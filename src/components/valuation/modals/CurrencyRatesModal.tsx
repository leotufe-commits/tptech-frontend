// src/components/valuation/modals/CurrencyRatesModal.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DollarSign, Loader2, Save, X, ChevronUp, ChevronDown } from "lucide-react";

import { Input, ModalShell, cn } from "../valuation.ui";

type Row = {
  id: string;
  rate: number;
  effectiveAt?: string;
  createdAt?: string;
};

type CurrencyLite = {
  id: string;
  code: string;
  name?: string;
  symbol: string;
  isBase?: boolean;
};

function safeErrMsg(e: any) {
  const raw =
    typeof e === "string"
      ? e
      : typeof e?.message === "string"
      ? e.message
      : typeof e?.error === "string"
      ? e.error
      : "";

  const s = String(raw || "").trim();
  if (!s) return "Error";

  if (s.includes("<!DOCTYPE") || s.includes("<html") || s.includes("</html>")) {
    return "Error del servidor (endpoint no encontrado o método no permitido).";
  }
  return s;
}

export default function CurrencyRatesModal({
  open,
  busy,
  currency,

  baseCurrencySymbol,
  baseCurrencyCode,

  onClose,
  onLoadRates,
  onAddRate,
  onUpdateCurrency,
}: {
  open: boolean;
  busy: boolean;
  currency: CurrencyLite | null;

  baseCurrencySymbol: string;
  baseCurrencyCode: string;

  onClose: () => void;
  onLoadRates: (
    currencyId: string,
    take?: number
  ) => Promise<{ ok: boolean; rows: Row[]; error?: string }>;
  onAddRate: (
    currencyId: string,
    data: { rate: number; effectiveAt: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCurrency: (
    currencyId: string,
    data: { code: string; name: string; symbol: string }
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // rate
  const [rate, setRate] = useState<string>("");
  const rateRef = useRef<HTMLInputElement | null>(null);

  // ✅ evita “resabios”: solo mostramos rate cuando ya cargó el real para esta moneda
  const [rateHydrated, setRateHydrated] = useState(false);

  // currency fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");

  const currencyId = String(currency?.id || "").trim();
  const isBase = Boolean((currency as any)?.isBase);

  const lastCurrencyIdRef = useRef<string>("");

  // ✅ token para ignorar respuestas viejas (race condition)
  const reqSeqRef = useRef(0);

  const title = useMemo(() => {
    if (!currency) return "Tipo de cambio";
    return `Tipo de cambio · ${currency.code}`;
  }, [currency]);

  const baseSym = String(baseCurrencySymbol || "").trim() || "$";
  const baseCode = String(baseCurrencyCode || "").trim() || "ARS";

  const STEP = 1.0;

  function parseRate(v: string) {
    const s = String(v ?? "").trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtRateForInput(n: number) {
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  function bumpRate(sign: 1 | -1) {
    const cur = parseRate(rate);
    const base = Number.isFinite(cur) ? cur : 0;

    const next = Math.max(0, base + sign * STEP);
    setRate(fmtRateForInput(next));
    setRateHydrated(true); // si el user toca, ya es “real” (no mostrar placeholder)

    requestAnimationFrame(() => {
      rateRef.current?.focus();
      rateRef.current?.select();
    });
  }

  function normCode(v: string) {
    return String(v || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6);
  }
  function normSymbol(v: string) {
    return String(v || "").trim().slice(0, 6);
  }
  function normName(v: string) {
    return String(v || "").trim().slice(0, 40);
  }

  function validateCurrencyFields() {
    const c = normCode(code);
    const n = normName(name);
    const s = normSymbol(symbol);

    if (!c) return "Código requerido.";
    if (c.length < 2) return "Código inválido.";
    if (!n) return "Nombre requerido.";
    if (!s) return "Símbolo requerido.";
    return null;
  }

  async function loadLatest(forCurrencyId: string) {
    if (!forCurrencyId) return;

    const mySeq = ++reqSeqRef.current;
    setErr(null);

    try {
      setLoading(true);
      const r = await onLoadRates(forCurrencyId, 1);

      // ✅ si cambió la moneda mientras cargábamos, ignoramos
      if (reqSeqRef.current !== mySeq) return;

      if (!r.ok) {
        setErr(r.error || "No se pudieron cargar los tipos de cambio.");
        setRateHydrated(false);
        return;
      }

      const latest = (r.rows || [])[0];
      if (latest && Number.isFinite(Number(latest.rate))) {
        setRate(fmtRateForInput(Number(latest.rate)));
        setRateHydrated(true);
      } else {
        // si no hay rate, dejamos vacío pero ya “hidratado”
        setRate("");
        setRateHydrated(true);
      }
    } catch (e: any) {
      if (reqSeqRef.current !== mySeq) return;
      setErr(safeErrMsg(e) || "Error cargando el último tipo de cambio.");
      setRateHydrated(false);
    } finally {
      if (reqSeqRef.current === mySeq) setLoading(false);
    }
  }

  /**
   * ✅ FIX flicker: setear campos + limpiar rate ANTES del paint al abrir/cambiar moneda
   */
  useLayoutEffect(() => {
    if (!open) return;

    const cid = currencyId;

    if (cid && lastCurrencyIdRef.current !== cid) {
      lastCurrencyIdRef.current = cid;

      setErr(null);
      setCode(String(currency?.code || "").trim());
      setName(String(currency?.name || "").trim());
      setSymbol(String(currency?.symbol || "").trim());

      // ✅ clave: limpiar rate para que NO se vea el anterior
      setRate("");
      setRateHydrated(false);
    }

    if (!cid) {
      setErr(null);
      setRate("");
      setRateHydrated(false);
      setCode("");
      setName("");
      setSymbol("");
      lastCurrencyIdRef.current = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currencyId]);

  // al cerrar: reset total
  useEffect(() => {
    if (open) return;
    lastCurrencyIdRef.current = "";
    reqSeqRef.current++; // invalida requests en vuelo
    setRate("");
    setRateHydrated(false);
    setErr(null);
    setLoading(false);
  }, [open]);

  // cargar latest cuando abre/cambia moneda
  useEffect(() => {
    if (!open) return;
    if (!currencyId) return;
    void loadLatest(currencyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currencyId]);

  // foco al rate (solo cuando ya está listo)
  useEffect(() => {
    if (!open || !currency || isBase || busy) return;
    if (!rateHydrated) return;

    const t = window.setTimeout(() => {
      rateRef.current?.focus();
      rateRef.current?.select();
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, currency, isBase, busy, rateHydrated]);

  function onRateBlur() {
    const n = parseRate(rate);
    if (!Number.isFinite(n)) return;
    setRate(fmtRateForInput(n));
    setRateHydrated(true);
  }

  async function submit() {
    if (!currencyId) return setErr("Moneda requerida.");

    const nextCode = normCode(code);
    const nextName = normName(name);
    const nextSymbol = normSymbol(symbol);

    const prevCode = String(currency?.code || "").trim();
    const prevName = String(currency?.name || "").trim();
    const prevSymbol = String(currency?.symbol || "").trim();

    const wantUpdateCurrency =
      nextCode !== prevCode || nextName !== prevName || nextSymbol !== prevSymbol;

    if (wantUpdateCurrency) {
      const msg = validateCurrencyFields();
      if (msg) return setErr(msg);
    }

    if (!isBase) {
      const n = parseRate(rate);
      if (!Number.isFinite(n) || n <= 0) return setErr("Tipo de cambio inválido.");
    }

    setErr(null);

    if (wantUpdateCurrency) {
      try {
        const r1 = await onUpdateCurrency(currencyId, {
          code: nextCode,
          name: nextName,
          symbol: nextSymbol,
        });
        if (!r1.ok) return setErr(r1.error || "No se pudo guardar la moneda.");
      } catch (e: any) {
        return setErr(safeErrMsg(e) || "No se pudo guardar la moneda.");
      }
    }

    if (!isBase) {
      const n = parseRate(rate);
      try {
        const r2 = await onAddRate(currencyId, {
          rate: n,
          effectiveAt: new Date().toISOString(),
        });
        if (!r2.ok) return setErr(r2.error || "No se pudo guardar el tipo de cambio.");
      } catch (e: any) {
        return setErr(safeErrMsg(e) || "No se pudo guardar el tipo de cambio.");
      }
    }

    onClose();
  }

  function onKeyDownEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (busy || loading || !currency) return;
      void submit();
    }
  }

  const numericRate = parseRate(rate);
  const shownCurrencyCode = normCode(code) || String(currency?.code || "").trim() || "—";

  const lockUI = busy || loading;
  const showRateUI = isBase ? true : rateHydrated; // base no depende de rate

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={() => !busy && onClose()}
      busy={busy}
      maxWidth="sm"
      footer={
        <>
          <button
            type="button"
            className="tp-btn-secondary h-10 inline-flex items-center gap-2"
            onClick={onClose}
            disabled={lockUI}
          >
            <X size={16} />
            Cancelar
          </button>

          <button
            type="button"
            className="tp-btn-primary h-10 inline-flex items-center gap-2"
            onClick={submit}
            disabled={lockUI || !currency}
          >
            {lockUI ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[460px]">
        {err && (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        )}

        {!currency ? (
          <div className="text-sm text-muted">Sin moneda seleccionada.</div>
        ) : (
          <div className={cn("grid gap-4", lockUI ? "opacity-70 pointer-events-none" : "")}>
            {/* HEADER / RESUMEN */}
            <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text leading-5">
                    {shownCurrencyCode} · {normName(name) || "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {isBase
                      ? "Moneda base del sistema. No requiere tipo de cambio."
                      : "Editá los datos de la moneda y guardá el último tipo de cambio."}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
                <span className="text-text font-semibold">Referencia:</span>{" "}
                1 {shownCurrencyCode} ={" "}
                {showRateUI && Number.isFinite(numericRate) ? (
                  <span className="text-text font-semibold">
                    {baseCode} {numericRate.toFixed(2)}
                  </span>
                ) : (
                  "—"
                )}
              </div>
            </div>

            {/* DATOS MONEDA */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3">
                <div className="text-sm font-semibold text-text">Datos de la moneda</div>
                <div className="text-xs text-muted">Código, nombre y símbolo visibles en el sistema.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-muted mb-1">Código</div>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(normCode(e.target.value))}
                    placeholder="ARS"
                    disabled={lockUI}
                    className="h-10 text-sm font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="text-[11px] font-semibold text-muted mb-1">Nombre</div>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(normName(e.target.value))}
                    placeholder="Peso Argentino"
                    disabled={lockUI}
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-muted mb-1">Símbolo</div>
                  <Input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(normSymbol(e.target.value))}
                    placeholder="$"
                    disabled={lockUI}
                    className="h-10 text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* TIPO DE CAMBIO */}
            {isBase ? (
              <div className="rounded-2xl border border-border bg-surface2 p-4 text-sm text-muted">
                <div className="flex items-center gap-2 text-text font-semibold">
                  <DollarSign size={16} />
                  Moneda base
                </div>
                <div className="mt-1 text-xs">
                  No necesita tipo de cambio. Siempre vale <span className="text-text font-semibold">1</span>.
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-text">Tipo de cambio</div>
                  <div className="text-xs text-muted">
                    Ingresá cuánto vale <span className="text-text font-semibold">1 {shownCurrencyCode}</span> en{" "}
                    <span className="text-text font-semibold">{baseCode}</span>.
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted select-none">
                    {baseSym}
                  </div>

                  <Input
                    ref={rateRef as any}
                    type="text"
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => {
                      setRate(e.target.value);
                      setRateHydrated(true);
                    }}
                    onBlur={onRateBlur}
                    onKeyDown={onKeyDownEnter}
                    placeholder={loading ? "…" : "0,00"}
                    disabled={busy}
                    className={cn(
                      "h-16 rounded-2xl text-5xl font-bold tabular-nums tracking-tight",
                      "text-center pl-12 pr-[68px]",
                      "focus-visible:ring-2 focus-visible:ring-primary/30"
                    )}
                  />

                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="h-14 w-12 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm flex flex-col">
                      <button
                        type="button"
                        className={cn(
                          "flex-1 grid place-items-center",
                          "hover:bg-surface2 active:scale-[0.98] transition",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          loading ? "opacity-50" : ""
                        )}
                        onClick={() => bumpRate(+1)}
                        disabled={busy || loading}
                        aria-label="Subir 1.00"
                        title="Subir 1.00"
                      >
                        <ChevronUp size={18} />
                      </button>

                      <div className="h-px w-full bg-border" />

                      <button
                        type="button"
                        className={cn(
                          "flex-1 grid place-items-center",
                          "hover:bg-surface2 active:scale-[0.98] transition",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          loading ? "opacity-50" : ""
                        )}
                        onClick={() => bumpRate(-1)}
                        disabled={busy || loading}
                        aria-label="Bajar 1.00"
                        title="Bajar 1.00"
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-muted">
                    Tip: podés usar <span className="text-text font-semibold">Enter</span> para guardar.
                  </div>

                  {loading ? (
                    <div className="text-[11px] text-muted inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Cargando…
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
