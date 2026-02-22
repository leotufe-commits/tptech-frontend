import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";

import Modal from "../../ui/Modal";
import { TP_INPUT, TP_SELECT, TP_BTN_PRIMARY, TP_BTN_SECONDARY } from "../../ui/tp";

type CurrencyRow = {
  id: string;
  code: string;
  symbol: string;
  name?: string;
  isBase?: boolean;
  isActive?: boolean;
};

type VariantRow = {
  id: string;
  metalId: string;
  name: string;
  sku: string;
  purity: number;
  isActive: boolean;
  isFavorite?: boolean;
};

export default function AddQuoteModal({
  open,
  busy,
  onClose,
  onSave,
  variant,
  currencies,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;

  onSave: (payload: {
    variantId: string;
    currencyId: string;
    purchasePrice: number;
    salePrice: number;
    effectiveAt: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  variant: VariantRow | null;
  currencies: CurrencyRow[];
}) {
  const [currencyId, setCurrencyId] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const variantId = String(variant?.id || "").trim();

  const currencyOptions = useMemo(() => {
    const rows = [...(currencies || [])];
    // activas primero, base primero, luego por código
    rows.sort((a, b) => {
      const aActive = a.isActive === false ? 1 : 0;
      const bActive = b.isActive === false ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive;

      const aBase = a.isBase ? 0 : 1;
      const bBase = b.isBase ? 0 : 1;
      if (aBase !== bBase) return aBase - bBase;

      return String(a.code || "").localeCompare(String(b.code || ""));
    });
    return rows;
  }, [currencies]);

  function makeNowLocal() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `T${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
  }

  // reset al abrir
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPurchasePrice("");
    setSalePrice("");
    setEffectiveAt(makeNowLocal());

    // preselect: primera moneda activa (idealmente base si existe)
    const firstActive = currencyOptions.find((c) => c.isActive !== false) || currencyOptions[0];
    setCurrencyId(firstActive?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const title = useMemo(() => {
    const sku = (variant as any)?.sku || variant?.id || "";
    return sku ? `Cotización · ${sku}` : "Cotización";
  }, [variant]);

  async function submit() {
    if (!variantId) return setErr("Variante requerida.");
    const cid = String(currencyId || "").trim();
    if (!cid) return setErr("Moneda requerida.");

    const p = Number(purchasePrice);
    const s = Number(salePrice);
    if (!Number.isFinite(p) || p <= 0) return setErr("Precio de compra inválido.");
    if (!Number.isFinite(s) || s <= 0) return setErr("Precio de venta inválido.");
    if (s < p) return setErr("La venta no puede ser menor que la compra.");

    const eff = String(effectiveAt || "").trim();
    if (!eff) return setErr("Fecha/hora requerida.");

    setErr(null);

    const r = await onSave({
      variantId,
      currencyId: cid,
      purchasePrice: p,
      salePrice: s,
      effectiveAt: eff,
    });

    if (!r.ok) return setErr(r.error || "No se pudo guardar.");

    onClose();
  }

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

          <button type="button" className={TP_BTN_PRIMARY} onClick={submit} disabled={busy || !variantId}>
            {busy ? <Loader2 size={16} className="animate-spin inline-block mr-2" /> : <Save size={16} className="inline-block mr-2" />}
            Guardar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        ) : null}

        {!variant ? (
          <div className="text-sm text-muted">Sin variante seleccionada.</div>
        ) : (
          <>
            <div className="text-sm text-muted">
              Variante:{" "}
              <span className="text-text font-semibold">
                {(variant as any)?.sku || variant.id}
              </span>
              {variant.name ? <span className="text-muted"> · {variant.name}</span> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-muted">Moneda</label>
                <select
                  value={currencyId}
                  onChange={(e) => setCurrencyId(e.target.value)}
                  className={TP_SELECT}
                  disabled={busy}
                >
                  {currencyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} {c.symbol ? `(${c.symbol})` : ""} {c.isBase ? "· Base" : ""}{" "}
                      {c.isActive === false ? "· Inactiva" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted">Fecha / Hora</label>
                <input
                  type="datetime-local"
                  value={effectiveAt}
                  onChange={(e) => setEffectiveAt(e.target.value)}
                  className={TP_INPUT}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted">Precio compra</label>
                <input
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Ej: 100000"
                  className={TP_INPUT}
                  disabled={busy}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Precio venta</label>
                <input
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Ej: 120000"
                  className={TP_INPUT}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="text-xs text-muted">
              Tip: guardamos historial por fecha/hora. La última (más reciente) es la que se ve en la tabla.
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
