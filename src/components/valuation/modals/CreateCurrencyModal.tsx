// src/components/valuation/modals/CreateCurrencyModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import Modal from "../../ui/Modal";
import { TPCard } from "../../ui/TPCard";
import TPInput from "../../ui/TPInput";
import TPNumberInput from "../../ui/TPNumberInput";
import { TP_BTN_PRIMARY, TP_BTN_SECONDARY, cn } from "../../ui/tp";

function normCode(v: string) {
  const up = String(v || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  return up.slice(0, 6);
}

function toNum(v: any, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function CreateCurrencyModal({
  open,
  busy,
  onClose,
  onSave,

  // ✅ NUEVO: si viene, es EDITAR. si no viene, es CREAR.
  currency,

  // ✅ NUEVO: primera moneda => será base, ocultar tipo de cambio
  isFirstCurrency = false,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;

  onSave: (data: {
    currencyId?: string;
    code: string;
    name: string;
    symbol: string;
    initialRate?: number | null;
  }) => Promise<{ ok: boolean; error?: string }>;

  currency?: {
    id: string;
    code: string;
    name: string;
    symbol: string;
    isBase?: boolean;
  } | null;

  isFirstCurrency?: boolean;
}) {
  const isEdit = !!currency?.id;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [initialRate, setInitialRate] = useState<number | null>(null);

  const [err, setErr] = useState<string | null>(null);

  // ✅ para seleccionar TPNumberInput al abrir (cuando aplica)
  const rateRef = useRef<HTMLInputElement>(null);

  // ✅ NUEVO: foco consistente al abrir (primer campo en CREATE)
  const formWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setErr(null);

    if (isEdit && currency) {
      setCode(currency.code || "");
      setName(currency.name || "");
      setSymbol(currency.symbol || "");
      setInitialRate(null); // no usamos rate en editar (por ahora)
      return;
    }

    // create
    setCode("");
    setName("");
    setSymbol("");
    setInitialRate(null);
  }, [open, isEdit, currency]);

  // ✅ NUEVO: al abrir en CREATE => focus en el primer input (Código)
  useEffect(() => {
    if (!open) return;
    if (busy) return;
    if (isEdit) return;

    const t = window.setTimeout(() => {
      const root = formWrapRef.current;
      const el = root?.querySelector("input") as HTMLInputElement | null;
      if (!el) return;
      el.focus();
      // no hacemos selectAll en CREATE (solo foco)
    }, 50);

    return () => window.clearTimeout(t);
  }, [open, busy, isEdit]);

  const codeNorm = useMemo(() => normCode(code), [code]);

  const showInitialRate = !isEdit && !isFirstCurrency;

  const canSubmit = useMemo(() => {
    const c = codeNorm;
    const n = String(name || "").trim();
    const s = String(symbol || "").trim();

    if (!c || !n || !s) return false;
    if (busy) return false;

    // initialRate: solo si se muestra (create y NO primera)
    if (showInitialRate && initialRate != null) {
      const r = toNum(initialRate, NaN);
      if (!Number.isFinite(r) || r <= 0) return false;
    }

    return true;
  }, [busy, codeNorm, name, symbol, showInitialRate, initialRate]);

  async function submit() {
    if (busy) return;

    const c = codeNorm;
    const n = String(name || "").trim();
    const s = String(symbol || "").trim();

    if (!c) return setErr("Código requerido.");
    if (!n) return setErr("Nombre requerido.");
    if (!s) return setErr("Símbolo requerido.");

    // ✅ si cargó rate inicial, validarlo (solo cuando aplica)
    let rateOut: number | null | undefined = undefined;

    if (!isEdit) {
      if (!showInitialRate) {
        // primera moneda => base => no tiene rate
        rateOut = null;
      } else {
        if (initialRate == null) {
          rateOut = null;
        } else {
          const r = toNum(initialRate, NaN);
          if (!Number.isFinite(r) || r <= 0) {
            return setErr("Tipo de cambio inválido. Debe ser mayor a 0.");
          }
          rateOut = r;
        }
      }
    }

    setErr(null);

    const r = await onSave({
      currencyId: currency?.id || undefined,
      code: c,
      name: n,
      symbol: s,
      ...(isEdit ? {} : { initialRate: rateOut }),
    });

    if (!r.ok) return setErr(r.error || "No se pudo guardar.");

    onClose();
  }

  function onKeyDownEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!canSubmit) return;
      void submit(); // ✅ guarda y cierra (submit ya llama onClose)
    }
  }

  const title = isEdit ? `Editar moneda` : "Nueva moneda";

  return (
    <Modal
      open={open}
      title={title}
      maxWidth="md"
      hideHeaderClose
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            className={TP_BTN_SECONDARY}
            onClick={onClose}
            disabled={busy}
          >
            <X size={16} className="inline-block mr-2" />
            Cancelar
          </button>

          <button
            type="button"
            className={cn(TP_BTN_PRIMARY, !canSubmit && "opacity-60")}
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin inline-block mr-2" />
            ) : (
              <Save size={16} className="inline-block mr-2" />
            )}
            Guardar
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          void submit();
        }}
      >
        <TPCard className="p-4 space-y-4">
          <div ref={formWrapRef} className="space-y-4">
            {err ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
                {err}
              </div>
            ) : null}

            {/* ✅ Aviso claro: primera moneda => base */}
            {!isEdit && isFirstCurrency ? (
              <div className="rounded-2xl border border-border bg-surface2/30 px-4 py-3">
                <div className="text-sm font-semibold text-text">
                  Moneda base
                </div>
                <div className="mt-1 text-xs text-muted">
                  Esta es la primera moneda que creás. El sistema la marcará como{" "}
                  <span className="text-text font-semibold">Moneda Base</span> y
                  su valor será siempre{" "}
                  <span className="text-text font-semibold">1</span>.
                </div>
              </div>
            ) : null}

            <TPInput
              label="Código *"
              value={codeNorm}
              onChange={(v) => setCode(v)}
              placeholder="ARS"
              autoFocus
              disabled={busy}
              maxLength={6}
              onKeyDown={onKeyDownEnter as any}
              onFocus={(e) => {
                try {
                  (e.target as HTMLInputElement)?.select?.();
                } catch {}
              }}
            />

            <TPInput
              label="Nombre *"
              value={name}
              onChange={setName}
              placeholder="Peso Argentino"
              disabled={busy}
              onKeyDown={onKeyDownEnter as any}
              onFocus={(e) => {
                try {
                  (e.target as HTMLInputElement)?.select?.();
                } catch {}
              }}
            />

            <TPInput
              label="Símbolo *"
              value={symbol}
              onChange={setSymbol}
              placeholder="$"
              disabled={busy}
              onKeyDown={onKeyDownEnter as any}
              onFocus={(e) => {
                try {
                  (e.target as HTMLInputElement)?.select?.();
                } catch {}
              }}
            />

            {/* ✅ SOLO CREAR y NO primera moneda: rate inicial */}
            {showInitialRate ? (
              <TPNumberInput
                label="Tipo de cambio inicial (opcional)"
                hint="Solo para monedas NO base. Ej: USD = 1000,00 (en moneda base)."
                value={initialRate}
                onChange={setInitialRate}
                decimals={2} // ✅ 0,00
                step={1} // ✅ Step de 1,00
                min={0}
                placeholder="Ej: 1000,00"
                disabled={busy}
                inputRef={rateRef}
                selectAllOnFocus
                onKeyDown={onKeyDownEnter as any} // ✅ Enter guarda y cierra
              />
            ) : null}

            <button type="submit" className="hidden" disabled={!canSubmit} />
          </div>
        </TPCard>
      </form>
    </Modal>
  );
}