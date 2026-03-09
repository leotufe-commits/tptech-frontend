// src/pages/Divisas.tsx
import React, { useMemo, useState } from "react";

import { useValuation, type MetalRow, type VariantRow } from "../hooks/useValuation";

import CurrenciesPanel from "../components/valuation/modals/CurrenciesPanel";
import MetalsAndVariantsPanel from "../components/valuation/modals/MetalsAndVariantsPanel";

import CreateCurrencyModal from "../components/valuation/modals/CreateCurrencyModal";
import CreateMetalModal from "../components/valuation/modals/CreateMetalModal";
import CreateVariantModal, { type VariantInitial } from "../components/valuation/modals/CreateVariantModal";
import CurrencyRatesModal from "../components/valuation/modals/CurrencyRatesModal";

import VariantValueModal from "../components/valuation/modals/VariantValueModal";

import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import TPSectionShell from "../components/ui/TPSectionShell";

import { toast } from "../lib/toast";

type MetalDraft = { id?: string; name: string; symbol?: string; referenceValue?: number };
type VariantDraft = VariantInitial & { id: string; metalId: string };

function normSku(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

export default function Divisas() {
  const v = useValuation();

  /* =========================
     Monedas
  ========================= */
  const [openCurrency, setOpenCurrency] = useState(false);

  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesCurrency, setRatesCurrency] = useState<any>(null);

  /* =========================
     Metales
  ========================= */
  const [metalModalOpen, setMetalModalOpen] = useState(false);
  const [metalModalMode, setMetalModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [metalEditing, setMetalEditing] = useState<MetalDraft | null>(null);

  const [selectedMetalId, setSelectedMetalId] = useState<string>("");
  const [selectedMetalName, setSelectedMetalName] = useState<string>("");
  const [selectedMetalRef, setSelectedMetalRef] = useState<number | null>(null);

  const selectedMetal = useMemo(
    () => v.metals.find((m) => String(m.id) === String(selectedMetalId)) ?? null,
    [v.metals, selectedMetalId]
  );

  /* =========================
     Variantes
  ========================= */
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [variantEditing, setVariantEditing] = useState<VariantDraft | null>(null);

  const [variantSkuSet, setVariantSkuSet] = useState<Set<string>>(new Set());

  const [variantViewOpen, setVariantViewOpen] = useState(false);
  const [variantViewing, setVariantViewing] = useState<VariantRow | null>(null);

  /* =========================
     Deletes
  ========================= */
  const [confirmDelMetalOpen, setConfirmDelMetalOpen] = useState(false);
  const [confirmDelMetalLoading, setConfirmDelMetalLoading] = useState(false);
  const [metalToDelete, setMetalToDelete] = useState<MetalRow | null>(null);

  const [confirmDelVarOpen, setConfirmDelVarOpen] = useState(false);
  const [confirmDelVarLoading, setConfirmDelVarLoading] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<VariantRow | null>(null);

  /* =========================
     Base currency (UI)
  ========================= */
  const baseCurrencySymbol = String(v.baseCurrency?.symbol || "").trim() || "$";
  const baseCurrencyCode = String(v.baseCurrency?.code || "").trim() || "ARS";

  /* =========================
     Helpers
  ========================= */
  async function refetchIfOk(r: any) {
    if (r?.ok) await v.refetch();
    return r;
  }

  /* =========================
     Currencies handlers
  ========================= */
  async function onAddRate(currencyId: string, data: { rate: number; effectiveAt: string }) {
    const r = await v.addCurrencyRate(currencyId, { rate: data.rate, effectiveAt: data.effectiveAt });
    return await refetchIfOk(r);
  }

  async function onLoadRates(currencyId: string, take = 50) {
    const r = await v.getCurrencyRates(currencyId, take);
    return r.ok ? { ok: true as const, rows: r.rows } : { ok: false as const, error: r.error, rows: [] };
  }

  async function onDeleteCurrency(row: any) {
    const id = String(row?.id || "").trim();
    if (!id) return { ok: false as const, error: "Moneda inválida." };
    if (row?.isBase) return { ok: false as const, error: "No se puede eliminar la moneda base." };
    const r = await v.deleteCurrency(id);
    return await refetchIfOk(r);
  }

  async function onSetBaseCurrency(currencyId: string) {
    const r = await v.setBaseCurrency(currencyId);
    return await refetchIfOk(r);
  }

  async function onToggleCurrencyActive(currencyId: string, isActive: boolean) {
    const r = await v.toggleCurrencyActive(currencyId, isActive);
    return await refetchIfOk(r);
  }

  async function onUpdateCurrency(currencyId: string, data: { code: string; name: string; symbol: string }) {
    const r = await v.updateCurrency(currencyId, data as any);
    return await refetchIfOk(r);
  }

  async function onSaveCurrencyModal(data: {
    currencyId?: string;
    code: string;
    name: string;
    symbol: string;
    initialRate?: number | null;
  }) {
    // EDIT
    if (data.currencyId) {
      const r = await v.updateCurrency(data.currencyId, { code: data.code, name: data.name, symbol: data.symbol });
      if (!r?.ok) return r as any;
      await v.refetch();
      return { ok: true as const };
    }

    // CREATE
    const r1: any = await (v as any).createCurrency({ code: data.code, name: data.name, symbol: data.symbol });
    if (!r1?.ok) return r1;

    const createdId = String(r1?.currencyId || "").trim();

    if (createdId && data.initialRate != null) {
      const r2 = await v.addCurrencyRate(createdId, {
        rate: Number(data.initialRate),
        effectiveAt: new Date().toISOString(),
      });
      if (!r2?.ok) return r2 as any;
    }

    await v.refetch();
    return { ok: true as const };
  }

  /* =========================
     Metals handlers
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
      const r = await v.createMetal(data);
      return await refetchIfOk(r);
    }

    const id = String(metalEditing?.id || "").trim();
    if (!id) return { ok: false as const, error: "Metal inválido." };

    const r = await v.updateMetal(id, data);
    return await refetchIfOk(r);
  }

  async function onMoveMetal(metalId: string, dir: "UP" | "DOWN") {
    const r = await v.moveMetal(metalId, dir);
    return await refetchIfOk(r);
  }

  async function onGetMetalRefHistory(metalId: string, take = 80) {
    return v.getMetalRefHistory(metalId, take);
  }

  async function onAskDeleteMetal(m: any) {
    setMetalToDelete(m);
    setConfirmDelMetalOpen(true);
    return { ok: true as const };
  }

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
        toast.success("Metal eliminado.");
        return;
      }

      toast.error(String(r?.error || "No se pudo eliminar el metal."));
    } catch (e: any) {
      toast.error(String(e?.message || "No se pudo eliminar el metal."));
    } finally {
      setConfirmDelMetalLoading(false);
    }
  }

  /* =========================
     Variants handlers
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

  async function openVariantCreate() {
    setVariantModalMode("CREATE");
    setVariantEditing(null);
    await preloadVariantSkus(String(selectedMetalId));
    setVariantModalOpen(true);
  }

  async function openVariantEdit(row: VariantRow) {
    // cerrar view si estaba abierto
    setVariantViewOpen(false);
    setVariantViewing(null);

    const vv: any = row as any;

    setVariantModalMode("EDIT");
    setVariantEditing({
      id: String(vv.id),
      metalId: String(vv.metalId),
      name: String(vv.name || ""),
      sku: String(vv.sku || ""),
      purity: typeof vv.purity === "number" ? vv.purity : Number(vv.purity || 0.75),
      saleFactor: typeof vv.saleFactor === "number" ? vv.saleFactor : 1.0,
    });

    await preloadVariantSkus(String(vv.metalId));
    setVariantModalOpen(true);
  }

  function openVariantView(row: VariantRow) {
    // cerrar modal edit/create por las dudas
    setVariantModalOpen(false);
    setVariantEditing(null);
    setVariantModalMode("CREATE");
    setVariantSkuSet(new Set());

    setVariantViewing(row);
    setVariantViewOpen(true);
  }

  async function onSaveVariant(p: any) {
    if (variantModalMode === "CREATE") {
      const r = await v.createVariant(p as any);
      return await refetchIfOk(r);
    }

    const id = String(variantEditing?.id || "").trim();
    if (!id) return { ok: false as const, error: "Variante inválida." };

    const r = await (v as any).updateVariant(id, {
      name: p.name,
      sku: p.sku,
      purity: p.purity,
      saleFactor: p.saleFactor,
    });

    return await refetchIfOk(r);
  }

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

    setConfirmDelVarLoading(true);
    try {
      const r = await (v as any).deleteVariant(id);

      if (r?.ok) {
        if (variantViewing?.id === id) {
          setVariantViewOpen(false);
          setVariantViewing(null);
        }

        setConfirmDelVarOpen(false);
        setVariantToDelete(null);
        await v.refetch();
        toast.success("Variante eliminada.");
        return;
      }

      toast.error(String(r?.error || "No se pudo eliminar la variante."));
    } catch (e: any) {
      toast.error(String(e?.message || "No se pudo eliminar la variante."));
    } finally {
      setConfirmDelVarLoading(false);
    }
  }

  /* =========================
     Render
  ========================= */
  return (
    <TPSectionShell title="Divisas" description="Monedas, tipos de cambio y valuación de metales/variantes." className="p-6">
      <div className="space-y-4">
        <CurrenciesPanel
          loading={v.loading}
          saving={v.saving}
          currencies={v.currencies}
          baseCurrency={v.baseCurrency}
          onRefetch={v.refetch}
          onOpenCreate={() => setOpenCurrency(true)}
          onSetBase={onSetBaseCurrency}
          onToggleActive={onToggleCurrencyActive}
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
          setFavoriteVariant={(variantIdOrNull) => v.setFavoriteVariant(variantIdOrNull, selectedMetalId)}
          onOpenMetalCreate={openMetalCreate}
          onOpenVariantCreate={() => void openVariantCreate()}
          onSelectedMetalChange={(metalId, metalName, metalReferenceValue) => {
            setSelectedMetalId(metalId);
            setSelectedMetalName(metalName);
            setSelectedMetalRef(metalReferenceValue ?? null);
          }}
          onOpenMetalEdit={openMetalEdit}
          onToggleMetal={async (metalId, isActive) => await refetchIfOk(await v.toggleMetalActive(metalId, isActive))}
          onDeleteMetal={onAskDeleteMetal}
          onMoveMetal={onMoveMetal}
          getMetalRefHistory={onGetMetalRefHistory}
          onDeleteVariant={onAskDeleteVariant}
          onOpenVariantView={openVariantView}
          onOpenVariantEdit={(row) => void openVariantEdit(row)}
        />

        {/* CREATE/EDIT CURRENCY */}
        <CreateCurrencyModal
          open={openCurrency}
          busy={v.saving}
          onClose={() => setOpenCurrency(false)}
          onSave={onSaveCurrencyModal as any}
          currency={null}
          isFirstCurrency={v.currencies.length === 0}
        />

        {/* EDIT CURRENCY + RATES */}
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
          onUpdateCurrency={onUpdateCurrency as any}
        />

        {/* CREATE/EDIT METAL */}
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

        {/* CREATE/EDIT VARIANT */}
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
          metalId={String(selectedMetalId)}
          metalName={selectedMetalName || undefined}
          metalReferenceValue={(selectedMetal?.referenceValue ?? selectedMetalRef) ?? null}
          mode={variantModalMode}
          initial={
            variantModalMode === "EDIT" && variantEditing
              ? ({
                  id: variantEditing.id,
                  name: variantEditing.name,
                  sku: variantEditing.sku,
                  purity: variantEditing.purity,
                  saleFactor: variantEditing.saleFactor,
                } as any)
              : null
          }
          isSkuTaken={(sku) => {
            const k = normSku(sku);
            return k ? variantSkuSet.has(k) : false;
          }}
        />

        {/* VIEW VARIANT */}
        <VariantValueModal
          open={variantViewOpen && !!variantViewing}
          onClose={() => {
            setVariantViewOpen(false);
            setVariantViewing(null);
          }}
          variant={variantViewing}
          baseCurrencySymbol={baseCurrencySymbol}
        />

        {/* CONFIRM DELETE METAL */}
        <ConfirmDeleteDialog
          open={confirmDelMetalOpen}
          title={metalToDelete?.name ? `Eliminar "${metalToDelete.name}"` : "Eliminar metal"}
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

        {/* CONFIRM DELETE VARIANT */}
        <ConfirmDeleteDialog
          open={confirmDelVarOpen}
          title={variantToDelete?.name ? `Eliminar variante "${variantToDelete.name}"` : "Eliminar variante"}
          description={
            variantToDelete
              ? `Vas a eliminar la variante "${variantToDelete.name}" (SKU: ${(variantToDelete as any)?.sku || "—"}). Esta acción no se puede deshacer.`
              : "Esta acción no se puede deshacer."
          }
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
    </TPSectionShell>
  );
}