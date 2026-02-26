// src/components/valuation/modals/CreateCurrencyModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import Modal from "../../ui/Modal";
import { TPCard } from "../../ui/TPCard";
import TPInput from "../../ui/TPInput";
import { TP_BTN_PRIMARY, TP_BTN_SECONDARY, cn } from "../../ui/tp";

function normCode(v: string) {
  const up = String(v || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  return up.slice(0, 6);
}

export default function CreateCurrencyModal({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (data: { code: string; name: string; symbol: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setCode("");
    setName("");
    setSymbol("");
  }, [open]);

  const codeNorm = useMemo(() => normCode(code), [code]);

  const canSubmit = useMemo(() => {
    return !!codeNorm && !!String(name || "").trim() && !!String(symbol || "").trim() && !busy;
  }, [busy, codeNorm, name, symbol]);

  async function submit() {
    const c = codeNorm;
    const n = String(name || "").trim();
    const s = String(symbol || "").trim();

    if (!c) return setErr("Código requerido.");
    if (!n) return setErr("Nombre requerido.");
    if (!s) return setErr("Símbolo requerido.");

    setErr(null);

    const r = await onSave({ code: c, name: n, symbol: s });
    if (!r.ok) return setErr(r.error || "No se pudo guardar.");

    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) void submit();
    }
  }

  return (
    <Modal
      open={open}
      title="Nueva moneda"
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
            onClick={submit}
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
      <div onKeyDown={onKeyDown}>
        <TPCard className="p-4 space-y-4">
          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
              {err}
            </div>
          ) : null}

          <TPInput
            label="Código"
            value={codeNorm}
            onChange={(v) => setCode(v)}
            placeholder="ARS"
            autoFocus
            disabled={busy}
            maxLength={6}
          />

          <TPInput
            label="Nombre"
            value={name}
            onChange={setName}
            placeholder="Peso Argentino"
            disabled={busy}
          />

          <TPInput
            label="Símbolo"
            value={symbol}
            onChange={setSymbol}
            placeholder="$"
            disabled={busy}
          />
        </TPCard>
      </div>
    </Modal>
  );
}