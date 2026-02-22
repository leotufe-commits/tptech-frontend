// src/pages/Divisas.tsx
import React, { useMemo, useState } from "react";

import { useValuation, type MetalRow, type VariantRow } from "../hooks/useValuation";

import CurrenciesPanel from "../components/valuation/modals/CurrenciesPanel";
import MetalsAndVariantsPanel from "../components/valuation/modals/MetalsAndVariantsPanel";

import CreateCurrencyModal from "../components/valuation/modals/CreateCurrencyModal";
import CreateMetalModal from "../components/valuation/modals/CreateMetalModal";
import CreateVariantModal, { type VariantInitial } from "../components/valuation/modals/CreateVariantModal";
import AddQuoteModal from "../components/valuation/modals/AddQuoteModal";
import CurrencyRatesModal from "../components/valuation/modals/CurrencyRatesModal";

import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";

type MetalDraft = { id?: string; name: string; symbol?: string; referenceValue?: number };

// ✅ para editar variante reutilizando CreateVariantModal
type VariantDraft = VariantInitial & { id: string; metalId: string };

function normSku(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

export default function Divisas() {
  const v = useValuation();

  // modals
  const [openCurrency, setOpenCurrency] = useState(false);

  // ✅ unificamos CREATE/EDIT metal en un solo modal
  const [metalModalOpen, setMetalModalOpen] = useState(false);
  const [metalModalMode, setMetalModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [metalEditing, setMetalEditing] = useState<MetalDraft | null>(null);

  // ✅ variante: CREATE/EDIT
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [variantEditing, setVariantEditing] = useState<VariantDraft | null>(null);

  // ✅ para evitar SKU duplicado (cache por metal al abrir modal)
  const [variantSkuSet, setVariantSkuSet] = useState<Set<string>>(new Set());

  // ✅ "View" lo usamos como ver/gestionar cotizaciones
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteVariant, setQuoteVariant] = useState<VariantRow | null>(null);

  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesCurrency, setRatesCurrency] = useState<any>(null);

  const [selectedMetalId, setSelectedMetalId] = useState<string>("");
  const [selectedMetalName, setSelectedMetalName] = useState<string>("");
  const [selectedMetalRef, setSelectedMetalRef] = useState<number | null>(null);

  const selectedMetalNameMemo = useMemo(() => selectedMetalName, [selectedMetalName]);

  // ✅ metal seleccionado (para pasar referenceValue al CreateVariantModal)
  const selectedMetal = useMemo(
    () => v.metals.find((m) => String(m.id) === String(selectedMetalId)) ?? null,
    [v.metals, selectedMetalId]
  );

  // ✅ Confirm delete (metal)
  const [confirmDelMetalOpen, setConfirmDelMetalOpen] = useState(false);
  const [confirmDelMetalLoading, setConfirmDelMetalLoading] = useState(false);
  const [metalToDelete, setMetalToDelete] = useState<MetalRow | null>(null);

  // ✅ Confirm delete (variant)
  const [confirmDelVarOpen, setConfirmDelVarOpen] = useState(false);
  const [confirmDelVarLoading, setConfirmDelVarLoading] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<VariantRow | null>(null);

  const baseCurrencySymbol = String(v.baseCurrency?.symbol || "").trim() || "$";
  const baseCurrencyCode = String(v.baseCurrency?.code || "").trim() || "ARS";

  /* =========================
     mover metal (UP/DOWN)
  ========================= */
  async function onMoveMetal(metalId: string, dir: "UP" | "DOWN") {
    const r = await v.moveMetal(metalId, dir);
    if (r?.ok) await v.refetch();
    return r;
  }

  /* =========================
     historial referenceValue
  ========================= */
  async function onGetMetalRefHistory(metalId: string, take = 80) {
    return v.getMetalRefHistory(metalId, take);
  }

  async function onSaveQuote(payload: {
    variantId: string;
    currencyId: string;
    purchasePrice: number;
    salePrice: number;
    effectiveAt: string;
  }) {
    return v.addQuote(payload);
  }

  async function onAddRate(currencyId: string, data: { rate: number; effectiveAt: string }) {
    return v.addCurrencyRate(currencyId, { rate: data.rate, effectiveAt: data.effectiveAt });
  }

  async function onLoadRates(currencyId: string, take = 50) {
    const r = await v.getCurrencyRates(currencyId, take);
    return r.ok ? { ok: true as const, rows: r.rows } : { ok: false as const, error: r.error, rows: [] };
  }

  async function onDeleteCurrency(row: any) {
    const id = String(row?.id || "").trim();
    if (!id) return { ok: false as const, error: "Moneda inválida." };
    if (row?.isBase) return { ok: false as const, error: "No se puede eliminar la moneda base." };
    return await v.deleteCurrency(id);
  }

  /* =========================
     METAL MODAL HELPERS
  ========================= */

  function openMetalCreate() {
    setMetalModalMode("CREATE");
    setMetalEditing(null);
    setMetalModalOpen(true);
  }

  function openMetalEdit(m: any) {
    setMetalModalMode("EDIT");
    setMetalEditing(
      m
        ? {
            id: m.id,
            name: m.name,
            symbol: m.symbol,
            referenceValue: m.referenceValue,
          }
        : null
    );
    setMetalModalOpen(true);
  }

  async function onSaveMetal(data: { name: string; symbol?: string; referenceValue?: number }) {
    if (metalModalMode === "CREATE") {
      return await v.createMetal(data);
    }

    const id = String(metalEditing?.id || "").trim();
    if (!id) return { ok: false as const, error: "Metal inválido." };

    return await v.updateMetal(id, data);
  }

  // ✅ pedir confirmación (NO elimina acá)
  async function onAskDeleteMetal(m: any) {
    setMetalToDelete(m);
    setConfirmDelMetalOpen(true);
    return { ok: true as const };
  }

  // ✅ confirmar eliminación (SÍ elimina acá)
  async function confirmDeleteMetalNow() {
    const m = metalToDelete;
    const id = String(m?.id || "").trim();

    if (!id) {
      setConfirmDelMetalOpen(false);
      setMetalToDelete(null);
      return;
    }

    setConfirmDelMetalLoading(true);
    try {
      const r = await v.deleteMetal(id);

      if (r?.ok) {
        if (selectedMetalId === id) {
          setSelectedMetalId("");
          setSelectedMetalName("");
          setSelectedMetalRef(null);
        }

        setConfirmDelMetalOpen(false);
        setMetalToDelete(null);
        await v.refetch();
        return;
      }

      const msg = String(r?.error || "No se pudo eliminar el metal.");
      const hint =
        msg.toLowerCase().includes("foreign") ||
        msg.toLowerCase().includes("constraint") ||
        msg.toLowerCase().includes("relacion") ||
        msg.toLowerCase().includes("variants") ||
        msg.toLowerCase().includes("variante")
          ? "Este metal tiene variantes/cotizaciones asociadas. Primero eliminá o mové esas variantes."
          : null;

      alert(hint ? `${msg}\n\n${hint}` : msg);
    } finally {
      setConfirmDelMetalLoading(false);
    }
  }

  /* =========================
     VARIANT DELETE
  ========================= */

  async function onAskDeleteVariant(variant: VariantRow) {
    setVariantToDelete(variant);
    setConfirmDelVarOpen(true);
    return { ok: true as const };
  }

  async function confirmDeleteVariantNow() {
    const vv = variantToDelete;
    const id = String((vv as any)?.id || "").trim();

    if (!id) {
      setConfirmDelVarOpen(false);
      setVariantToDelete(null);
      return;
    }

    if (typeof (v as any).deleteVariant !== "function") {
      alert("Falta implementar v.deleteVariant(id) en useValuation.");
      setConfirmDelVarOpen(false);
      setVariantToDelete(null);
      return;
    }

    setConfirmDelVarLoading(true);
    try {
      const r = await (v as any).deleteVariant(id);

      if (r?.ok) {
        if (quoteVariant?.id === id) {
          setQuoteOpen(false);
          setQuoteVariant(null);
        }

        setConfirmDelVarOpen(false);
        setVariantToDelete(null);
        await v.refetch();
        return;
      }

      const msg = String(r?.error || "No se pudo eliminar la variante.");
      const hint =
        msg.toLowerCase().includes("foreign") ||
        msg.toLowerCase().includes("constraint") ||
        msg.toLowerCase().includes("relacion") ||
        msg.toLowerCase().includes("quotes") ||
        msg.toLowerCase().includes("cotiz")
          ? "Esta variante tiene cotizaciones asociadas. Primero eliminá esas cotizaciones (o habilitamos borrado en cascada si lo decidimos)."
          : null;

      alert(hint ? `${msg}\n\n${hint}` : msg);
    } finally {
      setConfirmDelVarLoading(false);
    }
  }

  const metalDeleteTitle = metalToDelete?.name ? `Eliminar "${metalToDelete.name}"` : "Eliminar metal";
  const variantDeleteTitle = variantToDelete?.name ? `Eliminar variante "${variantToDelete.name}"` : "Eliminar variante";

  const variantDeleteDesc = variantToDelete
    ? `Vas a eliminar la variante "${variantToDelete.name}" (SKU: ${(variantToDelete as any)?.sku || "—"}). Esta acción no se puede deshacer.`
    : "Esta acción no se puede deshacer.";

  // ✅ para el CreateVariantModal: metalId y referenceValue correctos
  const metalIdForVariant = String(selectedMetalId || variantEditing?.metalId || quoteVariant?.metalId || "").trim();
  const metalRefForVariant = (selectedMetal?.referenceValue ?? selectedMetalRef) ?? null;

  /* =========================
     SKU CACHE (para modal)
  ========================= */

  async function preloadVariantSkus(metalId: string) {
    const mid = String(metalId || "").trim();
    if (!mid) {
      setVariantSkuSet(new Set());
      return;
    }

    const r = await v.getVariants(mid, { q: undefined });
    if (!r?.ok) {
      setVariantSkuSet(new Set());
      return;
    }

    const set = new Set<string>();
    for (const row of r.rows || []) {
      const sku = normSku((row as any)?.sku);
      if (sku) set.add(sku);
    }
    setVariantSkuSet(set);
  }

  /* =========================
     VARIANT MODAL HELPERS
  ========================= */

  async function openVariantCreate() {
    setVariantModalMode("CREATE");
    setVariantEditing(null);

    // ✅ precargar SKUs del metal seleccionado
    await preloadVariantSkus(metalIdForVariant);

    setVariantModalOpen(true);
  }

  async function openVariantEdit(row: VariantRow) {
    const vv: any = row as any;

    setVariantModalMode("EDIT");
    setVariantEditing({
      id: String(vv.id),
      metalId: String(vv.metalId),
      name: String(vv.name || ""),
      sku: String(vv.sku || ""),
      purity: typeof vv.purity === "number" ? vv.purity : Number(vv.purity || 0.75),
      saleFactor: typeof vv.saleFactor === "number" ? vv.saleFactor : 1.0,
      salePriceOverride: vv.salePriceOverride ?? null,
    });

    // ✅ precargar SKUs del metal de esa variante
    await preloadVariantSkus(String(vv.metalId));

    setVariantModalOpen(true);
  }

  // "View" => abrimos cotizaciones
  function openVariantView(row: VariantRow) {
    setQuoteVariant(row);
    setQuoteOpen(true);
  }

  async function onSaveVariant(p: {
    metalId: string;
    name: string;
    sku: string;
    purity: number;
    saleFactor?: number;
    salePriceOverride?: number | null;
  }) {
    if (variantModalMode === "CREATE") {
      const r = await v.createVariant(p as any);
      if (r?.ok) await v.refetch();
      return r as any;
    }

    // EDIT
    const id = String(variantEditing?.id || "").trim();
    if (!id) return { ok: false as const, error: "Variante inválida." };

    if (typeof (v as any).updateVariant !== "function") {
      return {
        ok: false as const,
        error: 'Falta implementar v.updateVariant(id, data) en useValuation (ya lo tenés).',
      };
    }

    const r = await (v as any).updateVariant(id, {
      name: p.name,
      sku: p.sku,
      purity: p.purity,
      saleFactor: p.saleFactor,
      salePriceOverride: p.salePriceOverride ?? null,
    });

    if (r?.ok) await v.refetch();
    return r as any;
  }

  return (
    <div className="p-6 space-y-4">
      <CurrenciesPanel
        loading={v.loading}
        saving={v.saving}
        currencies={v.currencies}
        baseCurrency={v.baseCurrency}
        onRefetch={v.refetch}
        onOpenCreate={() => setOpenCurrency(true)}
        onSetBase={v.setBaseCurrency}
        onToggleActive={v.toggleCurrencyActive}
        onOpenRates={(c: any) => {
          setRatesCurrency(c);
          setRatesOpen(true);
        }}
        onDelete={onDeleteCurrency}
      />

      <MetalsAndVariantsPanel
        loading={v.loading}
        saving={v.saving}
        metals={v.metals}
        baseCurrencySymbol={baseCurrencySymbol}
        getVariants={v.getVariants}
        createVariant={v.createVariant}
        toggleVariantActive={v.toggleVariantActive}
        /**
         * ✅ FIX FAVORITO:
         * MetalsAndVariantsPanel llama setFavoriteVariant(null) cuando quiere limpiar.
         * Nuestro hook necesita metalId para eso.
         */
        setFavoriteVariant={(variantIdOrNull) => v.setFavoriteVariant(variantIdOrNull, selectedMetalId)}
        onOpenMetalCreate={openMetalCreate}
        onOpenVariantCreate={() => void openVariantCreate()}
        onSelectedMetalChange={(metalId, metalName, metalReferenceValue) => {
          setSelectedMetalId(metalId);
          setSelectedMetalName(metalName);
          setSelectedMetalRef(metalReferenceValue ?? null);
        }}
        onOpenMetalEdit={openMetalEdit}
        onToggleMetal={v.toggleMetalActive}
        onDeleteMetal={onAskDeleteMetal}
        onMoveMetal={onMoveMetal}
        getMetalRefHistory={onGetMetalRefHistory}
        onDeleteVariant={onAskDeleteVariant}
        onOpenVariantView={openVariantView}
        onOpenVariantEdit={(row) => void openVariantEdit(row)}
      />

      {/* Modals */}
      <CreateCurrencyModal open={openCurrency} busy={v.saving} onClose={() => setOpenCurrency(false)} onSave={v.createCurrency} />

      <CurrencyRatesModal
        open={ratesOpen}
        busy={v.saving}
        currency={ratesCurrency}
        baseCurrencySymbol={baseCurrencySymbol}
        baseCurrencyCode={baseCurrencyCode}
        onClose={() => {
          setRatesOpen(false);
          setRatesCurrency(null);
        }}
        onLoadRates={onLoadRates}
        onAddRate={onAddRate}
        onUpdateCurrency={v.updateCurrency}
      />

      <CreateMetalModal
        open={metalModalOpen}
        busy={v.saving}
        baseCurrencySymbol={baseCurrencySymbol}
        onClose={() => {
          setMetalModalOpen(false);
          setMetalEditing(null);
        }}
        onSave={onSaveMetal}
        mode={metalModalMode}
        initial={metalModalMode === "EDIT" ? (metalEditing as any) : null}
      />

      <CreateVariantModal
        open={variantModalOpen}
        busy={v.saving}
        onClose={() => {
          setVariantModalOpen(false);
          setVariantEditing(null);
          setVariantModalMode("CREATE");
          setVariantSkuSet(new Set());
        }}
        onSave={onSaveVariant as any}
        metalId={metalIdForVariant}
        metalName={selectedMetalNameMemo || undefined}
        metalReferenceValue={metalRefForVariant}
        mode={variantModalMode}
        initial={
          variantModalMode === "EDIT" && variantEditing
            ? ({
                id: variantEditing.id,
                name: variantEditing.name,
                sku: variantEditing.sku,
                purity: variantEditing.purity,
                saleFactor: variantEditing.saleFactor,
                salePriceOverride: variantEditing.salePriceOverride ?? null,
              } as any)
            : null
        }
        /**
         * ✅ SKU duplicado (solo UI, rápido)
         * - En EDIT, el modal ya excluye el SKU original.
         */
        isSkuTaken={(sku) => {
          const k = normSku(sku);
          return k ? variantSkuSet.has(k) : false;
        }}
      />

      <AddQuoteModal
        open={quoteOpen && !!quoteVariant}
        busy={v.saving}
        onClose={() => {
          setQuoteOpen(false);
          setQuoteVariant(null);
        }}
        onSave={onSaveQuote}
        variant={quoteVariant}
        currencies={v.currencies}
      />

      {/* Confirm Delete Metal */}
      <ConfirmDeleteDialog
        open={confirmDelMetalOpen}
        title={metalDeleteTitle}
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        requireTypeToConfirm
        typeToConfirmText="ELIMINAR"
        dangerHint="Si este metal tiene variantes o cotizaciones asociadas, el sistema puede impedir su eliminación."
        loading={confirmDelMetalLoading}
        onClose={() => {
          if (confirmDelMetalLoading) return;
          setConfirmDelMetalOpen(false);
          setMetalToDelete(null);
        }}
        onConfirm={confirmDeleteMetalNow}
      />

      {/* Confirm Delete Variant */}
      <ConfirmDeleteDialog
        open={confirmDelVarOpen}
        title={variantDeleteTitle}
        description={variantDeleteDesc}
        confirmText="Eliminar"
        cancelText="Cancelar"
        requireTypeToConfirm
        typeToConfirmText="ELIMINAR"
        dangerHint="Si esta variante tiene cotizaciones asociadas, el sistema puede impedir su eliminación."
        loading={confirmDelVarLoading}
        onClose={() => {
          if (confirmDelVarLoading) return;
          setConfirmDelVarOpen(false);
          setVariantToDelete(null);
        }}
        onConfirm={confirmDeleteVariantNow}
      />
    </div>
  );
}