// src/components/valuation/modals/CreateMetalModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import Modal from "../../ui/Modal";
import { TPCard } from "../../ui/TPCard";
import TPInput from "../../ui/TPInput";
import TPNumberInput from "../../ui/TPNumberInput";
import { TP_BTN_PRIMARY, TP_BTN_SECONDARY, cn } from "../../ui/tp";

function MoneyAddon({ symbol }: { symbol: string }) {
  return <span className="text-xs font-semibold text-text/70 tabular-nums">{symbol}</span>;
}

export default function CreateMetalModal({
  open,
  busy,
  onClose,
  onSave,

  mode = "CREATE",
  initial,

  baseCurrencySymbol = "$",
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;

  onSave: (data: { name: string; symbol?: string; referenceValue?: number }) => Promise<{
    ok: boolean;
    error?: string;
  }>;

  mode?: "CREATE" | "EDIT";
  initial?: { id: string; name: string; symbol?: string; referenceValue?: number } | null;

  baseCurrencySymbol?: string;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [referenceValue, setReferenceValue] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ✅ CREATE: focus primer campo (Nombre)
  const nameRef = useRef<HTMLInputElement | null>(null);

  // ✅ EDIT: focus + selectall en TPNumberInput (Valor ref)
  const refValueRef = useRef<HTMLInputElement | null>(null);

  const title = mode === "EDIT" ? "Editar metal" : "Nuevo metal";
  const baseSym = useMemo(() => String(baseCurrencySymbol || "$").trim() || "$", [baseCurrencySymbol]);

  useEffect(() => {
    if (!open) return;

    setErr(null);

    if (mode === "EDIT" && initial) {
      setName(String(initial.name || ""));
      setSymbol(String(initial.symbol || ""));
      setReferenceValue(
        typeof initial.referenceValue === "number" && Number.isFinite(initial.referenceValue)
          ? initial.referenceValue
          : null
      );
    } else {
      setName("");
      setSymbol("");
      setReferenceValue(null);
    }

    // ✅ Focus behavior:
    // - CREATE => focus Nombre
    // - EDIT => focus + selectAll Valor de referencia
    const t = window.setTimeout(() => {
      if (busy) return;

      if (mode === "EDIT") {
        refValueRef.current?.focus();
        refValueRef.current?.select?.();
      } else {
        nameRef.current?.focus();
      }
    }, 50);

    return () => window.clearTimeout(t);
  }, [open, mode, initial, busy]);

  const canSubmit = useMemo(() => {
    const n = String(name || "").trim();
    const s = String(symbol || "").trim();
    if (!n) return false;
    if (s.length > 8) return false;
    if (referenceValue !== null && referenceValue < 0) return false;
    return !busy;
  }, [name, symbol, referenceValue, busy]);

  async function submit() {
    if (busy) return;

    const n = String(name || "").trim();
    const s = String(symbol || "").trim();

    if (!n) return setErr("Nombre requerido.");
    if (s.length > 8) return setErr("El símbolo es demasiado largo (máx. 8).");
    if (referenceValue !== null && referenceValue < 0) return setErr("El valor de referencia no puede ser negativo.");

    setErr(null);

    const r = await onSave({
      name: n,
      symbol: s || undefined,
      referenceValue: referenceValue === null ? undefined : referenceValue,
    });

    if (!r.ok) return setErr(r.error || "No se pudo guardar.");
    onClose();
  }

  function onKeyDownEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!canSubmit) return;
      void submit(); // ✅ guarda y cierra
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      subtitle="Metal padre (Oro, Plata, Platino)"
      description="Definí nombre, símbolo y el valor de referencia por gramo en moneda base."
      maxWidth="md"
      hideHeaderClose
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      busy={busy}
      footer={
        <>
          <button type="button" className={TP_BTN_SECONDARY} onClick={onClose} disabled={busy}>
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
          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
              {err}
            </div>
          ) : null}

          <TPInput
            label="Nombre *"
            value={name}
            onChange={setName}
            placeholder="Ej: Oro"
            disabled={busy}
            inputRef={nameRef}
            onKeyDown={onKeyDownEnter as any}
          />

          <TPInput
            label="Símbolo"
            value={symbol}
            onChange={setSymbol}
            placeholder="Ej: Au"
            disabled={busy}
            onKeyDown={onKeyDownEnter as any}
          />

          <TPNumberInput
            label="Valor de referencia (moneda base)"
            value={referenceValue}
            onChange={setReferenceValue}
            placeholder="Ej: 15000,00"
            disabled={busy}
            leftIcon={<MoneyAddon symbol={baseSym} />}
            step={0.01}
            min={0}
            decimals={2}
            inputRef={refValueRef}
            selectAllOnFocus
            onKeyDown={onKeyDownEnter as any}
            showArrows
          />

          <button type="submit" className="hidden" disabled={!canSubmit} />
        </TPCard>
      </form>
    </Modal>
  );
}