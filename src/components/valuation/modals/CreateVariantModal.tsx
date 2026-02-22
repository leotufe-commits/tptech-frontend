// src/components/valuation/modals/CreateVariantModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Save, SlidersHorizontal, X } from "lucide-react";

import Modal from "../../ui/Modal";

import TPInput from "../../ui/TPInput";
import TPNumberInput from "../../ui/TPNumberInput";
import TPAlert from "../../ui/TPAlert";

import { TPButton } from "../../ui/TPButton";
import { TPCard } from "../../ui/TPCard";
import { TPCollapse } from "../../ui/TPCollapse";
import { cn } from "../../ui/tp";

function toNum(v: any, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return n;
  return Math.max(min, Math.min(max, n));
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 6 });
}

type Mode = "CREATE" | "EDIT";

export type VariantInitial = {
  id?: string;
  name: string;
  sku: string;
  purity: number;
  saleFactor?: number;
  salePriceOverride?: number | null;
};

export default function CreateVariantModal({
  open,
  busy,
  onClose,
  onSave,

  metalId,
  metalName,
  metalReferenceValue,

  mode = "CREATE",
  initial = null,
  isSkuTaken,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;

  onSave: (payload: {
    metalId: string;
    name: string;
    sku: string;
    purity: number;

    saleFactor?: number;
    salePriceOverride?: number | null;
  }) => Promise<{ ok: boolean; row?: any; error?: string }>;

  metalId: string;
  metalName?: string;
  metalReferenceValue?: number | null;

  mode?: Mode;
  initial?: VariantInitial | null;

  isSkuTaken?: (sku: string) => boolean;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");

  const [purity, setPurity] = useState(0.75);

  const [err, setErr] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ✅ arranca en 1 (auto)
  const [saleFactor, setSaleFactor] = useState(1.0);

  // "" => AUTO
  const [saleFinal, setSaleFinal] = useState("");

  const ref = useMemo(() => toNum(metalReferenceValue, NaN), [metalReferenceValue]);

  const suggested = useMemo(() => {
    if (!Number.isFinite(ref) || !Number.isFinite(purity)) return NaN;
    if (purity <= 0 || purity > 1) return NaN;
    return ref * purity;
  }, [ref, purity]);

  const calcSaleAuto = useMemo(() => {
    const sfNum = Number(saleFactor);
    if (!Number.isFinite(suggested) || !Number.isFinite(sfNum)) return NaN;
    return suggested * sfNum;
  }, [suggested, saleFactor]);

  const appliedFinal = useMemo(() => {
    const ov = saleFinal.trim() === "" ? NaN : toNum(saleFinal, NaN);
    return Number.isFinite(ov) ? ov : calcSaleAuto;
  }, [saleFinal, calcSaleAuto]);

  const isManual = useMemo(() => saleFinal.trim() !== "", [saleFinal]);
  const modeTxt = isManual ? "Manual" : "Auto";

  function resetToAuto() {
    setSaleFactor(1.0);
    setSaleFinal("");
  }

  function onChangeSaleFinalNumber(v: number | null) {
    if (v === null) {
      setSaleFinal("");
      return;
    }

    const val = Number(v);
    if (!Number.isFinite(val)) return;

    const rounded = Math.round(val);
    setSaleFinal(String(rounded));

    if (Number.isFinite(suggested) && suggested > 0) {
      const nextFactor = clamp(rounded / suggested, 0.0001, 100);
      if (Number.isFinite(nextFactor)) setSaleFactor(Number(nextFactor.toFixed(2)));
    }
  }

  function onChangeSaleFactor(v: number | null) {
    const val = typeof v === "number" && Number.isFinite(v) ? v : 1.0;
    setSaleFactor(val);
    if (saleFinal.trim() !== "") setSaleFinal("");
  }

  // ✅ precarga para EDIT / resetea para CREATE
  useEffect(() => {
    if (!open) return;

    setErr(null);

    if (mode === "EDIT" && initial) {
      setName(String(initial.name || ""));
      setSku(String(initial.sku || ""));
      setPurity(typeof initial.purity === "number" && Number.isFinite(initial.purity) ? initial.purity : 0.75);

      setAdvancedOpen(false);

      const sf = typeof initial.saleFactor === "number" && Number.isFinite(initial.saleFactor) ? initial.saleFactor : 1.0;
      setSaleFactor(sf);

      const ov = initial.salePriceOverride;
      if (ov === null || ov === undefined) {
        setSaleFinal("");
      } else {
        const n = toNum(ov, NaN);
        setSaleFinal(Number.isFinite(n) ? String(Math.round(n)) : "");
      }
      return;
    }

    // CREATE
    setName("");
    setSku("");
    setPurity(0.75);
    setAdvancedOpen(false);
    setSaleFactor(1.0);
    setSaleFinal("");
  }, [open, mode, initial]);

  const title = mode === "EDIT" ? "Editar variante" : "Nueva variante";
  const autoBadge = Number.isFinite(calcSaleAuto) ? fmtMoney(calcSaleAuto) : "—";

  async function submit() {
    const mid = String(metalId || "").trim();
    if (!mid) return setErr("Metal requerido.");

    const n = String(name || "").trim();
    const s = String(sku || "").trim();

    if (!n) return setErr("Nombre requerido.");
    if (!s) return setErr("SKU requerido.");

    // ✅ SKU duplicado (UI)
    if (typeof isSkuTaken === "function") {
      const sameAsOriginal =
        mode === "EDIT" && initial && String(initial.sku || "").trim().toLowerCase() === s.toLowerCase();

      if (!sameAsOriginal && isSkuTaken(s)) {
        return setErr("Ese SKU ya existe. Usá otro SKU para evitar duplicados.");
      }
    }

    if (!Number.isFinite(purity) || purity <= 0 || purity > 1) {
      return setErr("Pureza/Ley inválida. Ej: 0.750 (18k) / 0.585 (14k) / 0.925 (plata).");
    }

    if (!Number.isFinite(saleFactor) || saleFactor <= 0 || saleFactor > 100) {
      return setErr("Ajuste venta (factor) inválido. Ej: 1.00 / 1.05 / 1.10");
    }

    const salOv = saleFinal.trim() === "" ? null : toNum(saleFinal, NaN);

    if (salOv !== null && !Number.isFinite(salOv)) return setErr("Valor final venta inválido.");
    if (salOv !== null && salOv < 0) return setErr("El valor final venta no puede ser negativo.");

    setErr(null);

    const r = await onSave({
      metalId: mid,
      name: n,
      sku: s,
      purity,
      saleFactor,
      salePriceOverride: salOv,
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
          <TPButton variant="secondary" onClick={onClose} disabled={busy} iconLeft={<X size={16} />}>
            Cancelar
          </TPButton>

          <TPButton variant="primary" onClick={submit} disabled={busy} loading={busy} iconLeft={<Save size={16} />}>
            Guardar
          </TPButton>
        </>
      }
    >
      <div className="space-y-4">
        {err ? <TPAlert tone="danger">{err}</TPAlert> : null}

        {/* Nombre + SKU */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TPInput
            label="Nombre"
            value={name}
            onChange={setName}
            placeholder={`${metalName ? `${metalName} ` : ""}18Kts - 750 / 1000`}
            autoFocus
            disabled={busy}
          />
          <TPInput label="SKU" value={sku} onChange={setSku} placeholder="AU18K-750" disabled={busy} />
        </div>

        {/* ✅ FRANJA compacta (reemplaza el primer card) */}
        <div className="rounded-2xl border border-border bg-surface2 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            <div>
              <div className="text-xs font-semibold text-muted">Valor fino (24K)</div>
              <div className="mt-1 tp-input h-[52px] flex items-center tabular-nums">
                {Number.isFinite(ref) ? fmtMoney(ref) : "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted">Moneda base</div>
            </div>

            <div>
              <TPNumberInput
                label="Pureza / Ley"
                value={purity}
                onChange={(v) => setPurity(typeof v === "number" && Number.isFinite(v) ? v : 0.75)}
                step={0.001}
                min={0}
                max={1}
                decimals={3}
                placeholder="0.750"
                disabled={busy}
                className="h-[52px]"
                hint="Ej: 0.750 (18k) / 0.585 (14k) / 0.925 (plata)."
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">Valor sugerido</div>
              <div className="mt-1 tp-input h-[52px] flex items-center tabular-nums">
                {Number.isFinite(suggested) ? fmtMoney(suggested) : "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted">valor fino × pureza</div>
            </div>
          </div>
        </div>

        {/* Avanzados */}
        <TPCollapse
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((x) => !x)}
          disabled={busy}
          iconLeft={<SlidersHorizontal size={16} />}
          title={
            <div className="flex items-center justify-between gap-3">
              <span>Ajustes avanzados (opcional)</span>

              <span className="hidden md:inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted">
                Auto actual: <span className="ml-1 font-semibold tabular-nums text-text">{autoBadge}</span>
              </span>
            </div>
          }
          description="Ajustá el factor comercial o poné un valor final manual. Se sincronizan entre sí."
        >
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TPNumberInput
                label="Ajuste venta (factor)"
                value={saleFactor}
                onChange={onChangeSaleFactor}
                step={0.01}
                min={0.0001}
                max={100}
                decimals={2}
                placeholder="1.00"
                disabled={busy}
                className="h-[52px]"
                hint={Number.isFinite(calcSaleAuto) ? `Auto actual: ${autoBadge}` : "Ej: 1.00 / 1.05 / 1.10"}
              />

              <TPNumberInput
                label="Valor final venta (override opcional)"
                value={saleFinal.trim() === "" ? null : Math.round(toNum(saleFinal, NaN))}
                onChange={onChangeSaleFinalNumber}
                step={1}
                min={0}
                max={Number.isFinite(calcSaleAuto) ? Math.max(calcSaleAuto * 100, 1000000) : 1000000}
                decimals={0}
                placeholder={Number.isFinite(calcSaleAuto) ? autoBadge : "—"}
                disabled={busy}
                className="h-[52px]"
                emptyBaseValue={Number.isFinite(calcSaleAuto) ? Math.round(calcSaleAuto) : 0}
                hint="Vacío = auto. Manual = recalcula factor."
              />
            </div>

            <div className="mt-3 flex justify-end">
              <TPButton variant="secondary" onClick={resetToAuto} disabled={busy}>
                Resetear (Auto)
              </TPButton>
            </div>
          </div>
        </TPCollapse>

        {/* Preview final */}
        <div className="mx-auto w-full max-w-[620px]">
          <TPCard
            title="Preview final"
            className="bg-white border border-border"
            right={
              <span className="text-xs text-muted">
                Modo:{" "}
                <span className={isManual ? "text-yellow-500 font-semibold" : "text-text font-semibold"}>{modeTxt}</span>
              </span>
            }
          >
            <div
              className={cn(
                "rounded-2xl border border-border bg-surface px-6 py-6 transition",
                advancedOpen &&
                  "border-primary/60 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
              )}
            >
              <div className="flex flex-col items-center justify-center text-center gap-2">
                <div className="text-xs text-muted">{isManual ? "Override activo" : "Cálculo automático"}</div>

                <div className="text-4xl md:text-5xl font-normal tracking-tight tabular-nums text-text">
                  {Number.isFinite(appliedFinal) ? fmtMoney(appliedFinal) : "—"}
                </div>

                <div className="text-[11px] text-muted">Valor aplicado</div>
              </div>
            </div>
          </TPCard>
        </div>
      </div>
    </Modal>
  );
}