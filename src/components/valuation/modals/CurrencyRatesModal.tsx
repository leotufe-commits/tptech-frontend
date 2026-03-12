// src/components/valuation/modals/CurrencyRatesModal.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import Modal from "../../ui/Modal";
import { TPCard } from "../../ui/TPCard";
import { TPButton } from "../../ui/TPButton";
import TPInput from "../../ui/TPInput";
import TPNumberInput from "../../ui/TPNumberInput";
import { cn } from "../../ui/tp";

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
  onLoadRates: (currencyId: string, take?: number) => Promise<{ ok: boolean; rows: Row[]; error?: string }>;
  onAddRate: (currencyId: string, data: { rate: number; effectiveAt: string }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCurrency: (currencyId: string, data: { code: string; name: string; symbol: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ number | null
  const [rate, setRate] = useState<number | null>(null);
  const rateRef = useRef<HTMLInputElement | null>(null);

  // ✅ para focus/select cuando ya está listo el valor
  const [rateHydrated, setRateHydrated] = useState(false);

  // ✅ campos editables de moneda
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");

  const currencyId = String(currency?.id || "").trim();
  const isBase = Boolean((currency as any)?.isBase);

  const lastCurrencyIdRef = useRef<string>("");
  const reqSeqRef = useRef(0);

  const title = useMemo(() => {
    if (!currency) return "Editar moneda";
    return `Editar moneda · ${currency.code}`;
  }, [currency]);

  const baseSym = String(baseCurrencySymbol || "").trim() || "$";
  const baseCode = String(baseCurrencyCode || "").trim() || "ARS";

  function normCode(v: string) {
    return String(v || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9]/g, "")
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

      if (reqSeqRef.current !== mySeq) return;

      if (!r.ok) {
        setErr(r.error || "No se pudieron cargar los tipos de cambio.");
        setRate(null);
        setRateHydrated(false);
        return;
      }

      const latest = (r.rows || [])[0];
      if (latest && Number.isFinite(Number(latest.rate))) {
        setRate(Number(latest.rate));
        setRateHydrated(true);
      } else {
        setRate(null);
        setRateHydrated(true);
      }
    } catch (e: any) {
      if (reqSeqRef.current !== mySeq) return;
      setErr(safeErrMsg(e) || "Error cargando el último tipo de cambio.");
      setRate(null);
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

      setRate(null);
      setRateHydrated(false);
    }

    if (!cid) {
      setErr(null);
      setRate(null);
      setRateHydrated(false);
      setCode("");
      setName("");
      setSymbol("");
      lastCurrencyIdRef.current = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currencyId]);

  useEffect(() => {
    if (open) return;
    lastCurrencyIdRef.current = "";
    reqSeqRef.current++;
    setRate(null);
    setRateHydrated(false);
    setErr(null);
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!currencyId) return;
    void loadLatest(currencyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currencyId]);

  // ✅ al abrir y cuando ya está hidratado: focus + select del rate
  useEffect(() => {
    if (!open || !currency || isBase || busy) return;
    if (!rateHydrated) return;

    const t = window.setTimeout(() => {
      rateRef.current?.focus();
      rateRef.current?.select();
    }, 60);

    return () => window.clearTimeout(t);
  }, [open, currency, isBase, busy, rateHydrated]);

  async function submit() {
    if (!currencyId) return setErr("Moneda requerida.");

    const nextCode = normCode(code);
    const nextName = normName(name);
    const nextSymbol = normSymbol(symbol);

    const prevCode = String(currency?.code || "").trim();
    const prevName = String(currency?.name || "").trim();
    const prevSymbol = String(currency?.symbol || "").trim();

    const wantUpdateCurrency = nextCode !== prevCode || nextName !== prevName || nextSymbol !== prevSymbol;

    if (wantUpdateCurrency) {
      const msg = validateCurrencyFields();
      if (msg) return setErr(msg);
    }

    if (!isBase) {
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        return setErr("Tipo de cambio inválido.");
      }
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
      try {
        const r2 = await onAddRate(currencyId, {
          rate: rate as number,
          effectiveAt: new Date().toISOString(),
        });
        if (!r2.ok) return setErr(r2.error || "No se pudo guardar el tipo de cambio.");
      } catch (e: any) {
        return setErr(safeErrMsg(e) || "No se pudo guardar el tipo de cambio.");
      }
    }

    onClose();
  }

  function onKeyDownEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (busy || loading || !currency) return;
      void submit();
    }
  }

  const shownCurrencyCode = normCode(code) || String(currency?.code || "").trim() || "—";
  const lockUI = busy || loading;

  return (
    <Modal
      open={open}
      title={title}
      maxWidth="sm"
      onClose={() => !busy && onClose()}
      busy={busy}
      closeLabel="" // ✅ elimina el texto "Cerrar"
      bodyClassName="overscroll-contain touch-pan-y"
      footer={
        <>
          <TPButton variant="secondary" onClick={onClose} disabled={lockUI} iconLeft={<X size={16} />}>
            Cancelar
          </TPButton>

          <TPButton variant="primary" onClick={submit} disabled={lockUI || !currency} loading={lockUI} iconLeft={<Save size={16} />}>
            Guardar
          </TPButton>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[460px]">
        {err ? (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        ) : null}

        {!currency ? (
          <div className="text-sm text-muted">Sin moneda seleccionada.</div>
        ) : (
          <TPCard className={cn("p-5 space-y-4", lockUI ? "opacity-70 pointer-events-none" : "")}>
            {/* ✅ Campos moneda (editar) */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <TPInput
                  label="Código *"
                  value={code}
                  onChange={setCode}
                  placeholder="USD"
                  disabled={busy}
                  maxLength={6}
                  onKeyDown={onKeyDownEnter as any}
                  onFocus={(e) => {
                    try {
                      (e.target as HTMLInputElement)?.select?.();
                    } catch {}
                  }}
                />
              </div>

              <div className="col-span-5">
                <TPInput
                  label="Nombre *"
                  value={name}
                  onChange={setName}
                  placeholder="Dólar"
                  disabled={busy}
                  maxLength={40}
                  onKeyDown={onKeyDownEnter as any}
                  onFocus={(e) => {
                    try {
                      (e.target as HTMLInputElement)?.select?.();
                    } catch {}
                  }}
                />
              </div>

              <div className="col-span-3">
                <TPInput
                  label="Símbolo *"
                  value={symbol}
                  onChange={setSymbol}
                  placeholder="US$"
                  disabled={busy}
                  maxLength={6}
                  onKeyDown={onKeyDownEnter as any}
                  onFocus={(e) => {
                    try {
                      (e.target as HTMLInputElement)?.select?.();
                    } catch {}
                  }}
                />
              </div>
            </div>

            {/* ✅ Tipo de cambio */}
            {isBase ? (
              <div className="rounded-2xl border border-border bg-surface2/30 px-4 py-3">
                <div className="text-sm font-semibold text-text">Moneda base</div>
                <div className="mt-1 text-xs text-muted">
                  No necesita tipo de cambio. Siempre vale <span className="text-text font-semibold">1</span>.
                </div>
              </div>
            ) : (
              <>
                <div className="pt-1">
                  <div className="text-sm font-semibold text-text">Tipo de cambio</div>
                  <div className="text-xs text-muted">
                    Ingresá cuánto vale <span className="text-text font-semibold">1 {shownCurrencyCode}</span> en{" "}
                    <span className="text-text font-semibold">{baseCode}</span>.
                  </div>
                </div>

                <div className="relative">
                  <TPNumberInput
                    inputRef={rateRef as any}
                    leftIcon={<span className="text-sm font-semibold text-muted">{baseSym}</span>}
                    value={rate}
                    onChange={(v) => {
                      setRate(v);
                      setRateHydrated(true);
                    }}
                    placeholder={loading ? "…" : "15000,00"}
                    disabled={busy}
                    decimals={2}
                    step={0.01}
                    wrapClassName="w-full"
                    className={cn(
                      "h-16 rounded-2xl text-3xl font-semibold tabular-nums tracking-tight",
                      "text-center"
                    )}
                    onKeyDown={onKeyDownEnter as any}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
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
              </>
            )}
          </TPCard>
        )}
      </div>
    </Modal>
  );
}