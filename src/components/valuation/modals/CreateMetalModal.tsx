import React, { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import Modal from "../../ui/Modal";
import { TP_INPUT, TP_BTN_PRIMARY, TP_BTN_SECONDARY } from "../../ui/tp";

function fmtNumberLike(v: string) {
  // permite "123", "123.45", "123,45"
  return String(v || "").replace(/[^\d.,-]/g, "");
}

function parseNumber(v: string) {
  const s = String(v || "").trim();
  if (!s) return undefined;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export default function CreateMetalModal({
  open,
  busy,
  onClose,
  onSave,

  // ✅ NUEVO (para editar)
  mode = "CREATE",
  initial,

  // ✅ NUEVO: símbolo moneda base para el input
  baseCurrencySymbol = "$",
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;

  onSave: (data: {
    name: string;
    symbol?: string;
    referenceValue?: number;
  }) => Promise<{ ok: boolean; error?: string }>;

  mode?: "CREATE" | "EDIT";
  initial?: { id: string; name: string; symbol?: string; referenceValue?: number } | null;

  baseCurrencySymbol?: string;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [referenceValue, setReferenceValue] = useState(""); // string para input
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);

    if (mode === "EDIT" && initial) {
      setName(String(initial.name || ""));
      setSymbol(String(initial.symbol || ""));

      // ✅ dejamos editable en input, sin formatear con miles (para no “pelear” con el usuario)
      const rv =
        typeof initial.referenceValue === "number" && Number.isFinite(initial.referenceValue)
          ? String(initial.referenceValue)
          : "";
      setReferenceValue(rv);
    } else {
      setName("");
      setSymbol("");
      setReferenceValue("");
    }
  }, [open, mode, initial]);

  async function submit() {
    const n = String(name || "").trim();
    const s = String(symbol || "").trim();

    if (!n) return setErr("Nombre requerido.");
    if (s.length > 8) return setErr("El símbolo es demasiado largo (máx. 8).");

    const rv = parseNumber(referenceValue);
    if (referenceValue.trim() && rv === undefined) return setErr("Valor de referencia inválido.");
    if (rv !== undefined && rv < 0) return setErr("El valor de referencia no puede ser negativo.");

    setErr(null);

    const r = await onSave({
      name: n,
      symbol: s || undefined,
      referenceValue: rv,
    });

    if (!r.ok) return setErr(r.error || "No se pudo guardar.");
    onClose();
  }

  const title = mode === "EDIT" ? "Editar metal" : "Nuevo metal";
  const symbolBase = String(baseCurrencySymbol || "$").trim() || "$";

  return (
    <Modal
      open={open}
      title={title}
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
        <div className="text-sm text-muted">Metal padre (Oro, Plata, Platino).</div>

        {err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        ) : null}

        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            void submit();
          }}
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Oro"
              disabled={busy}
              autoFocus
              className={TP_INPUT}
            />
          </div>

          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-muted">Símbolo</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Ej: Au"
              disabled={busy}
              className={TP_INPUT}
            />
            <div className="mt-1 text-[11px] text-muted">Se usa como “icono” del metal (Au, Ag, Pt…)</div>
          </div>

          {/* ✅ Valor referencia */}
          <div className="sm:col-span-3">
            <label className="text-xs font-semibold text-muted">Valor de referencia (moneda base)</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-10 px-3 rounded-xl border border-border bg-surface2 text-text/90 grid place-items-center text-sm font-semibold">
                {symbolBase}
              </div>
              <input
                value={referenceValue}
                onChange={(e) => setReferenceValue(fmtNumberLike(e.target.value))}
                placeholder="Ej: 212000"
                disabled={busy}
                className={TP_INPUT}
                inputMode="decimal"
              />
            </div>
            <div className="mt-1 text-[11px] text-muted">
              Se guarda en moneda base. Si cambiás la moneda base, el sistema recalcula este valor para mantener
              equivalencia.
            </div>
          </div>

          <button type="submit" className="hidden" disabled={busy} />
        </form>
      </div>
    </Modal>
  );
}
