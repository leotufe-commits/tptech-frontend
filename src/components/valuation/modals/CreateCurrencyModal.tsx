import React, { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import Modal from "../../ui/Modal";
import { TP_INPUT, TP_BTN_PRIMARY, TP_BTN_SECONDARY } from "../../ui/tp";

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

  async function submit() {
    const c = String(code || "").trim().toUpperCase();
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

  return (
    <Modal
      open={open}
      title="Nueva moneda"
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      busy={busy}
      footer={
        <>
          <button type="button" className={TP_BTN_SECONDARY} onClick={onClose} disabled={busy}>
            Cancelar
          </button>

          <button type="button" className={TP_BTN_PRIMARY} onClick={submit} disabled={busy}>
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
      <div className="space-y-4">
        <div className="text-sm text-muted">Definí el código, nombre y símbolo.</div>

        {err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-muted">Código</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ARS"
              autoFocus
              disabled={busy}
              className={TP_INPUT}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-muted">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Peso Argentino"
              disabled={busy}
              className={TP_INPUT}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted">Símbolo</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="$ / US$ / €"
            disabled={busy}
            className={TP_INPUT}
          />
        </div>
      </div>
    </Modal>
  );
}
