// src/components/valuation/modals/CreateVariantModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Mode = "CREATE" | "EDIT";
type PricingMode = "AUTO" | "OVERRIDE";

function normPricingMode(v: any): PricingMode | null {
  const s = String(v || "").toUpperCase().trim();
  if (s === "AUTO") return "AUTO";
  if (s === "OVERRIDE") return "OVERRIDE";
  return null;
}

export type VariantInitial = {
  id?: string;
  name: string;
  sku: string;
  purity: number;

  saleFactor?: number;
  salePriceOverride?: number | null;

  pricingMode?: PricingMode | string | null;
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

    pricingMode?: PricingMode;
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

  const [saleFactor, setSaleFactor] = useState(1.0);
  const [saleFinal, setSaleFinal] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("AUTO");

  const nameRef = useRef<HTMLInputElement | null>(null);
  const purityRef = useRef<HTMLInputElement | null>(null);

  const ref = useMemo(() => toNum(metalReferenceValue, NaN), [metalReferenceValue]);

  const suggested = useMemo(() => {
    if (!Number.isFinite(ref) || !Number.isFinite(purity)) return NaN;
    if (purity <= 0 || purity > 10) return NaN;
    return ref * purity;
  }, [ref, purity]);

  const calcSaleAuto = useMemo(() => {
    const sfNum = Number(saleFactor);
    if (!Number.isFinite(suggested) || !Number.isFinite(sfNum)) return NaN;
    return suggested * sfNum;
  }, [suggested, saleFactor]);

  const overrideNumber = useMemo(() => {
    const t = saleFinal.trim();
    if (!t) return NaN;
    return toNum(t, NaN);
  }, [saleFinal]);

  const hasManualValue = Number.isFinite(overrideNumber);
  const isManual = pricingMode === "OVERRIDE" && hasManualValue;

  const appliedFinal = useMemo(() => {
    if (isManual) return overrideNumber;
    return calcSaleAuto;
  }, [isManual, overrideNumber, calcSaleAuto]);

  const modeTxt = isManual ? "Manual" : "Auto";

  function syncFromFactor(v: number | null) {
    const val = typeof v === "number" && Number.isFinite(v) ? v : 1.0;
    const nextFactor = clamp(val, 0.0001, 100);

    setSaleFactor(Number(nextFactor.toFixed(2)));

    if (Number.isFinite(suggested)) {
      const nextFinal = suggested * nextFactor;
      if (Number.isFinite(nextFinal)) {
        setSaleFinal(nextFinal.toFixed(2));
      } else {
        setSaleFinal("");
      }
    } else {
      setSaleFinal("");
    }

    setPricingMode("AUTO");
  }

  function syncFromFinal(v: number | null) {
    if (v === null) {
      setSaleFinal("");
      if (Number.isFinite(suggested) && suggested > 0 && Number.isFinite(saleFactor)) {
        setPricingMode("AUTO");
      }
      return;
    }

    const val = Number(v);
    if (!Number.isFinite(val)) return;

    setSaleFinal(val.toFixed(2));

    if (Number.isFinite(suggested) && suggested > 0) {
      const nextFactor = clamp(val / suggested, 0.0001, 100);
      if (Number.isFinite(nextFactor)) setSaleFactor(Number(nextFactor.toFixed(2)));
    }

    setPricingMode("OVERRIDE");
  }

  const lastInitIdRef = useRef<string>("");
  const justOpenedRef = useRef(false);
  const dirtyRef = useRef(false);

  function markDirty() {
    dirtyRef.current = true;
  }

  useEffect(() => {
    if (open) {
      justOpenedRef.current = true;
      dirtyRef.current = false;
      setErr(null);
    } else {
      justOpenedRef.current = false;
      dirtyRef.current = false;
      lastInitIdRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const initId = mode === "EDIT" ? String(initial?.id || "") : "";
    const idChanged = initId && initId !== lastInitIdRef.current;

    const shouldHydrate =
      mode === "CREATE" ? justOpenedRef.current : (justOpenedRef.current || idChanged) && !dirtyRef.current;

    if (!shouldHydrate) return;

    justOpenedRef.current = false;
    setErr(null);

    if (mode === "EDIT" && initial) {
      lastInitIdRef.current = String(initial.id || "");

      setName(String(initial.name || ""));
      setSku(String(initial.sku || ""));
      setPurity(typeof initial.purity === "number" && Number.isFinite(initial.purity) ? initial.purity : 0.75);

      const sf =
        typeof initial.saleFactor === "number" && Number.isFinite(initial.saleFactor) ? initial.saleFactor : 1.0;
      setSaleFactor(sf);

      const pm = normPricingMode((initial as any)?.pricingMode);
      const inferred: PricingMode =
        pm ?? (initial.salePriceOverride === null || initial.salePriceOverride === undefined ? "AUTO" : "OVERRIDE");
      setPricingMode(inferred);

      if (initial.salePriceOverride === null || initial.salePriceOverride === undefined) {
        if (Number.isFinite(ref) && Number.isFinite(initial.purity) && Number.isFinite(sf)) {
          const sug = Number(ref) * Number(initial.purity);
          const fin = sug * sf;
          setSaleFinal(Number.isFinite(fin) ? fin.toFixed(2) : "");
        } else {
          setSaleFinal("");
        }
      } else {
        const n = toNum(initial.salePriceOverride, NaN);
        setSaleFinal(Number.isFinite(n) ? Number(n).toFixed(2) : "");
      }

      const hasOverride = initial.salePriceOverride !== null && initial.salePriceOverride !== undefined;
      const hasFactor = typeof sf === "number" && Number.isFinite(sf) && Math.abs(sf - 1) > 0.000001;
      const shouldOpenAdvanced = inferred === "OVERRIDE" || hasOverride || hasFactor;
      setAdvancedOpen(shouldOpenAdvanced);
      return;
    }

    lastInitIdRef.current = "";
    setName("");
    setSku("");
    setPurity(0.75);
    setSaleFactor(1.0);
    setSaleFinal("");
    setPricingMode("AUTO");
    setAdvancedOpen(false);
  }, [open, mode, initial, ref]);

  useEffect(() => {
    if (!open || busy) return;

    const t = window.setTimeout(() => {
      if (mode === "EDIT") {
        purityRef.current?.focus();
        purityRef.current?.select?.();
      } else {
        nameRef.current?.focus();
      }
    }, 70);

    return () => window.clearTimeout(t);
  }, [open, mode, busy, initial?.id]);

  useEffect(() => {
    if (!open) return;
    if (!Number.isFinite(suggested)) return;
    if (dirtyRef.current) return;

    if (pricingMode === "AUTO") {
      const nextFinal = suggested * saleFactor;
      setSaleFinal(Number.isFinite(nextFinal) ? nextFinal.toFixed(2) : "");
    }
  }, [open, suggested, saleFactor, pricingMode]);

  const title = mode === "EDIT" ? "Editar variante" : "Nueva variante";
  const autoBadge = Number.isFinite(calcSaleAuto) ? fmtMoney(calcSaleAuto) : "—";

  async function submit() {
    const mid = String(metalId || "").trim();
    if (!mid) return setErr("Metal requerido.");

    const n = String(name || "").trim();
    const s = String(sku || "").trim();

    if (!n) return setErr("Nombre requerido.");
    if (!s) return setErr("SKU requerido.");

    if (typeof isSkuTaken === "function") {
      const sameAsOriginal =
        mode === "EDIT" && initial && String(initial.sku || "").trim().toLowerCase() === s.toLowerCase();

      if (!sameAsOriginal && isSkuTaken(s)) {
        return setErr("Ese SKU ya existe. Usá otro SKU para evitar duplicados.");
      }
    }

    if (!Number.isFinite(purity) || purity <= 0 || purity > 10) {
      return setErr("Pureza/Ley inválida. Ej: 0.750 (18k) / 0.585 (14k) / 0.925 (plata).");
    }

    if (!Number.isFinite(saleFactor) || saleFactor <= 0 || saleFactor > 100) {
      return setErr("Factor inválido. Ej: 1.00 / 1.05 / 1.10");
    }

    let salOv: number | null = null;

    if (saleFinal.trim() !== "") {
      const v = toNum(saleFinal, NaN);
      if (!Number.isFinite(v)) return setErr("Precio final inválido.");
      if (v < 0) return setErr("El precio final no puede ser negativo.");

      if (Number.isFinite(calcSaleAuto)) {
        const autoRounded = Number(calcSaleAuto.toFixed(2));
        const manualRounded = Number(v.toFixed(2));
        if (manualRounded !== autoRounded) {
          salOv = v;
        }
      } else {
        salOv = v;
      }
    }

    const effectivePricingMode: PricingMode = salOv == null ? "AUTO" : "OVERRIDE";

    setErr(null);

    const r = await onSave({
      metalId: mid,
      name: n,
      sku: s,
      purity,
      saleFactor,
      salePriceOverride: salOv,
      pricingMode: effectivePricingMode,
    });

    if (!r.ok) return setErr(r.error || "No se pudo guardar.");

    onClose();
  }

  function onKeyDownEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (busy) return;
      void submit();
    }
  }

  const topValueLabel = metalName ? `Valor ${metalName}` : "Valor";

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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TPInput
            label="Nombre *"
            value={name}
            onChange={(v) => {
              markDirty();
              setName(v);
            }}
            placeholder={`${metalName ? `${metalName} ` : ""}18Kts - 750 / 1000`}
            disabled={busy}
            inputRef={nameRef}
            onKeyDown={onKeyDownEnter as any}
          />
          <TPInput
            label="SKU *"
            value={sku}
            onChange={(v) => {
              markDirty();
              setSku(v);
            }}
            placeholder="AU18K-750"
            disabled={busy}
            onKeyDown={onKeyDownEnter as any}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-stretch">
            <div className="h-full rounded-2xl border border-border bg-card p-3 flex flex-col">
              <div className="text-xs font-semibold text-muted text-left">{topValueLabel}</div>

              <div className="mt-2 tp-input h-[52px] flex items-center justify-start tabular-nums text-left">
                {Number.isFinite(ref) ? fmtMoney(ref) : "—"}
              </div>

              <div className="mt-auto pt-2 text-[11px] text-muted text-left">Moneda base</div>
            </div>

            <div className="h-full rounded-2xl border border-border bg-card p-3 flex flex-col">
              <div className="text-xs font-semibold text-muted text-left">Pureza / Ley</div>

              <div className="mt-2">
                <TPNumberInput
                  label={undefined}
                  hint={undefined}
                  value={purity}
                  onChange={(v) => {
                    if (typeof v === "number" && Number.isFinite(v)) {
                      markDirty();
                      setPurity(v);
                    }
                  }}
                  step={0.001}
                  min={0}
                  max={10}
                  decimals={3}
                  placeholder="0.750"
                  disabled={busy}
                  className={cn("h-[52px]", "text-left")}
                  wrapClassName="space-y-0"
                  inputRef={purityRef}
                  selectAllOnFocus
                  onKeyDown={onKeyDownEnter as any}
                />
              </div>

              <div className="mt-auto pt-2 text-[11px] text-muted text-left">
                Ej: 0.750 (18k) / 0.585 (14k) / 0.925 (plata).
              </div>
            </div>

            <div className="h-full rounded-2xl border border-border bg-card p-3 flex flex-col">
              <div className="text-xs font-semibold text-muted text-right">Valor sugerido</div>

              <div className="mt-2 tp-input h-[52px] flex items-center justify-end tabular-nums">
                {Number.isFinite(suggested) ? fmtMoney(suggested) : "—"}
              </div>

              <div className="mt-auto pt-2 text-[11px] text-muted text-right">valor × pureza</div>
            </div>
          </div>
        </div>

        <TPCollapse
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((x) => !x)}
          disabled={busy}
          iconLeft={<SlidersHorizontal size={16} />}
          title={
            <div className="flex items-center justify-between gap-3">
              <span>Ingresar valor no sugerido</span>

              <span className="hidden md:inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted">
                Auto actual: <span className="ml-1 font-semibold tabular-nums text-text">{autoBadge}</span>
              </span>
            </div>
          }
          description="Podés modificar el factor o el precio final. Al cambiar uno, se actualiza el otro."
        >
          <div className="mt-3 rounded-2xl border border-border bg-card p-3 space-y-3">
            <TPAlert tone="info">
              <div className="mt-1 text-sm">
                Podés escribir tanto el <b>factor</b> como el <b>precio final</b>. El sistema mantiene ambos
                sincronizados.
              </div>
            </TPAlert>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TPNumberInput
                label="Factor"
                value={Number.isFinite(saleFactor) ? saleFactor : null}
                onChange={(v) => {
                  markDirty();
                  syncFromFactor(v);
                }}
                step={0.01}
                min={0.0001}
                max={100}
                decimals={2}
                placeholder="1,00"
                disabled={busy}
                className="h-[52px]"
                onKeyDown={onKeyDownEnter as any}
                hint={Number.isFinite(calcSaleAuto) ? `Auto actual: ${autoBadge}` : "Ej: 1.00 / 1.05 / 1.10"}
              />

              <TPNumberInput
                label="Precio final"
                value={Number.isFinite(calcSaleAuto) ? calcSaleAuto : null}
                onChange={() => {}}
                disabled
                decimals={2}
                className="h-[52px]"
                hint="Calculado automáticamente desde el factor."
              />
            </div>
          </div>
        </TPCollapse>

        <div className="mx-auto w-full max-w-[620px]">
          <TPCard
            title="Precio final"
            className="border border-border"
            right={
              <span className="text-xs text-muted">
                Modo:{" "}
                <span className={isManual ? "text-yellow-500 font-semibold" : "text-text font-semibold"}>
                  {modeTxt}
                </span>
              </span>
            }
          >
            <div
              className={cn(
                "rounded-2xl border border-border bg-card px-6 py-6 transition",
                advancedOpen &&
                  "border-primary/60 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
              )}
            >
              <div className="flex flex-col items-center justify-center text-center gap-2">
                <div className="text-xs text-muted">{isManual ? "Precio manual activo" : "Cálculo automático"}</div>

                <div className="text-4xl md:text-5xl font-normal tracking-tight tabular-nums text-text">
                  {Number.isFinite(appliedFinal) ? fmtMoney(appliedFinal) : "—"}
                </div>

                <div className="text-[11px] text-muted">Precio final</div>
              </div>
            </div>
          </TPCard>
        </div>
      </div>
    </Modal>
  );
}